/**
 * Post-Quantum Cryptography Authentication Middleware
 * Provides quantum-resistant authentication using hybrid signatures
 */

import { Request, Response, NextFunction } from 'express';
import { createHash } from 'crypto';
import { logger } from '../utils/logger.js';
import {
  MLDSAService,
  MLDSASecurityLevel,
  mldsaService,
  SLHDSAService,
  SLHDSASecurityLevel,
  slhdsaService,
  PQCKeyManagementService,
  pqcKeyManagement,
  KeyType,
  KeyPurpose,
  KeyStatus,
} from '../security/pqc/index.js';

// ============================================
// TYPES
// ============================================

export interface PQCAuthConfig {
  enabled: boolean;
  signatureAlgorithm: 'ML-DSA' | 'SLH-DSA' | 'hybrid';
  securityLevel: MLDSASecurityLevel | SLHDSASecurityLevel;
  requireTimestamp: boolean;
  maxTimestampAge: number;  // milliseconds
  nonceValidityPeriod: number;  // milliseconds
  allowClassicalFallback: boolean;
}

export interface PQCAuthenticatedRequest extends Request {
  pqcAuth?: {
    keyId: string;
    algorithm: string;
    verified: boolean;
    timestamp: Date;
    clientId?: string;
  };
}

interface SignaturePayload {
  timestamp: string;
  nonce: string;
  method: string;
  path: string;
  bodyHash?: string;
  keyId: string;
}

// ============================================
// NONCE CACHE
// ============================================

class NonceCache {
  private nonces: Map<string, number> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor(private validityPeriod: number) {
    // Cleanup expired nonces every minute
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  add(nonce: string): void {
    this.nonces.set(nonce, Date.now());
  }

  isUsed(nonce: string): boolean {
    return this.nonces.has(nonce);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [nonce, timestamp] of this.nonces.entries()) {
      if (now - timestamp > this.validityPeriod) {
        this.nonces.delete(nonce);
      }
    }
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.nonces.clear();
  }
}

// ============================================
// PQC AUTH MIDDLEWARE
// ============================================

const defaultConfig: PQCAuthConfig = {
  enabled: true,
  signatureAlgorithm: 'ML-DSA',
  securityLevel: MLDSASecurityLevel.MLDSA65,
  requireTimestamp: true,
  maxTimestampAge: 5 * 60 * 1000,  // 5 minutes
  nonceValidityPeriod: 10 * 60 * 1000,  // 10 minutes
  allowClassicalFallback: true,
};

const nonceCache = new NonceCache(defaultConfig.nonceValidityPeriod);

/**
 * Extract PQC signature from request headers
 */
function extractPQCSignature(req: Request): {
  signature: string;
  keyId: string;
  algorithm: string;
  timestamp: string;
  nonce: string;
} | null {
  const signature = req.headers['x-pqc-signature'] as string;
  const keyId = req.headers['x-pqc-key-id'] as string;
  const algorithm = req.headers['x-pqc-algorithm'] as string;
  const timestamp = req.headers['x-pqc-timestamp'] as string;
  const nonce = req.headers['x-pqc-nonce'] as string;

  if (!signature || !keyId || !algorithm) {
    return null;
  }

  return { signature, keyId, algorithm, timestamp, nonce };
}

/**
 * Build the message that was signed
 */
function buildSignedMessage(req: Request, payload: SignaturePayload): Buffer {
  const message = JSON.stringify({
    timestamp: payload.timestamp,
    nonce: payload.nonce,
    method: req.method,
    path: req.path,
    bodyHash: payload.bodyHash,
    keyId: payload.keyId,
  });

  return Buffer.from(message, 'utf-8');
}

/**
 * Verify PQC signature
 */
async function verifySignature(
  message: Buffer,
  signature: Buffer,
  publicKey: Buffer,
  algorithm: string,
  config: PQCAuthConfig
): Promise<boolean> {
  try {
    if (algorithm.startsWith('ML-DSA')) {
      const level = algorithm as MLDSASecurityLevel;
      return await mldsaService.verify(message, signature, publicKey, level);
    } else if (algorithm.startsWith('SLH-DSA')) {
      const level = algorithm as SLHDSASecurityLevel;
      return await slhdsaService.verify(message, signature, publicKey, level);
    } else if (algorithm === 'hybrid') {
      // Hybrid: verify with both ML-DSA and SLH-DSA
      const mldsaValid = await mldsaService.verify(
        message,
        signature.slice(0, signature.length / 2),
        publicKey.slice(0, publicKey.length / 2),
        MLDSASecurityLevel.MLDSA65
      );
      const slhdsaValid = await slhdsaService.verify(
        message,
        signature.slice(signature.length / 2),
        publicKey.slice(publicKey.length / 2),
        SLHDSASecurityLevel.SLHDSA_SHA2_128F
      );
      return mldsaValid && slhdsaValid;
    }

    return false;
  } catch (error) {
    logger.error('PQC signature verification error', { error, algorithm });
    return false;
  }
}

/**
 * Main PQC authentication middleware
 */
export function pqcAuthMiddleware(config: Partial<PQCAuthConfig> = {}) {
  const mergedConfig = { ...defaultConfig, ...config };

  return async (req: PQCAuthenticatedRequest, res: Response, next: NextFunction) => {
    // Skip if PQC auth is disabled
    if (!mergedConfig.enabled) {
      return next();
    }

    // Extract signature from headers
    const pqcData = extractPQCSignature(req);

    if (!pqcData) {
      // Check if classical auth is allowed as fallback
      if (mergedConfig.allowClassicalFallback) {
        return next();
      }
      return res.status(401).json({
        error: 'PQC authentication required',
        message: 'Missing X-PQC-Signature header',
      });
    }

    try {
      // Validate timestamp
      if (mergedConfig.requireTimestamp) {
        if (!pqcData.timestamp) {
          return res.status(401).json({
            error: 'PQC authentication failed',
            message: 'Missing timestamp',
          });
        }

        const timestampDate = new Date(pqcData.timestamp);
        const age = Date.now() - timestampDate.getTime();

        if (age > mergedConfig.maxTimestampAge || age < -60000) {
          return res.status(401).json({
            error: 'PQC authentication failed',
            message: 'Timestamp out of range',
          });
        }
      }

      // Validate nonce (replay protection)
      if (pqcData.nonce) {
        if (nonceCache.isUsed(pqcData.nonce)) {
          return res.status(401).json({
            error: 'PQC authentication failed',
            message: 'Nonce already used (replay attack detected)',
          });
        }
        nonceCache.add(pqcData.nonce);
      }

      // Get public key from key management
      const managedKey = pqcKeyManagement.getKey(pqcData.keyId);
      if (!managedKey) {
        return res.status(401).json({
          error: 'PQC authentication failed',
          message: 'Unknown key ID',
        });
      }

      if (managedKey.status !== KeyStatus.ACTIVE) {
        return res.status(401).json({
          error: 'PQC authentication failed',
          message: `Key is ${managedKey.status}`,
        });
      }

      // Build the signed message
      const bodyHash = req.body
        ? createHash('sha256').update(JSON.stringify(req.body)).digest('hex')
        : undefined;

      const signedMessage = buildSignedMessage(req, {
        timestamp: pqcData.timestamp,
        nonce: pqcData.nonce,
        method: req.method,
        path: req.path,
        bodyHash,
        keyId: pqcData.keyId,
      });

      // Verify signature
      const signature = Buffer.from(pqcData.signature, 'base64');
      const isValid = await verifySignature(
        signedMessage,
        signature,
        managedKey.publicKey,
        pqcData.algorithm,
        mergedConfig
      );

      if (!isValid) {
        logger.warn('PQC signature verification failed', {
          keyId: pqcData.keyId,
          algorithm: pqcData.algorithm,
          path: req.path,
        });

        return res.status(401).json({
          error: 'PQC authentication failed',
          message: 'Invalid signature',
        });
      }

      // Attach auth info to request
      req.pqcAuth = {
        keyId: pqcData.keyId,
        algorithm: pqcData.algorithm,
        verified: true,
        timestamp: new Date(pqcData.timestamp),
        clientId: managedKey.metadata.clientId,
      };

      logger.debug('PQC authentication successful', {
        keyId: pqcData.keyId,
        algorithm: pqcData.algorithm,
      });

      next();
    } catch (error) {
      logger.error('PQC authentication error', { error });
      return res.status(500).json({
        error: 'PQC authentication error',
        message: 'Internal server error during authentication',
      });
    }
  };
}

/**
 * Middleware to require PQC authentication (no fallback)
 */
export function requirePQCAuth(config: Partial<PQCAuthConfig> = {}) {
  return pqcAuthMiddleware({
    ...config,
    enabled: true,
    allowClassicalFallback: false,
  });
}

/**
 * Middleware to require specific PQC algorithm
 */
export function requirePQCAlgorithm(algorithm: 'ML-DSA' | 'SLH-DSA' | 'hybrid') {
  return async (req: PQCAuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.pqcAuth) {
      return res.status(401).json({
        error: 'PQC authentication required',
        message: 'PQC authentication not performed',
      });
    }

    if (!req.pqcAuth.algorithm.startsWith(algorithm) && req.pqcAuth.algorithm !== algorithm) {
      return res.status(401).json({
        error: 'PQC algorithm mismatch',
        message: `Required algorithm: ${algorithm}, provided: ${req.pqcAuth.algorithm}`,
      });
    }

    next();
  };
}

/**
 * Helper to sign requests (for clients)
 */
export async function signRequest(
  method: string,
  path: string,
  body: object | undefined,
  privateKey: Buffer,
  keyId: string,
  algorithm: MLDSASecurityLevel | SLHDSASecurityLevel = MLDSASecurityLevel.MLDSA65
): Promise<{
  'X-PQC-Signature': string;
  'X-PQC-Key-Id': string;
  'X-PQC-Algorithm': string;
  'X-PQC-Timestamp': string;
  'X-PQC-Nonce': string;
}> {
  const timestamp = new Date().toISOString();
  const nonce = createHash('sha256')
    .update(Date.now().toString())
    .update(Math.random().toString())
    .digest('hex')
    .substring(0, 32);

  const bodyHash = body
    ? createHash('sha256').update(JSON.stringify(body)).digest('hex')
    : undefined;

  const payload: SignaturePayload = {
    timestamp,
    nonce,
    method,
    path,
    bodyHash,
    keyId,
  };

  const message = Buffer.from(JSON.stringify(payload), 'utf-8');

  let signature: Buffer;
  if (algorithm.toString().startsWith('ML-DSA')) {
    const result = await mldsaService.sign(message, privateKey, algorithm as MLDSASecurityLevel);
    signature = result.signature;
  } else {
    const result = await slhdsaService.sign(message, privateKey, algorithm as SLHDSASecurityLevel);
    signature = result.signature;
  }

  return {
    'X-PQC-Signature': signature.toString('base64'),
    'X-PQC-Key-Id': keyId,
    'X-PQC-Algorithm': algorithm,
    'X-PQC-Timestamp': timestamp,
    'X-PQC-Nonce': nonce,
  };
}

/**
 * Express router with PQC auth helpers
 */
export const pqcAuthHelpers = {
  /**
   * Check if request has valid PQC auth
   */
  isPQCAuthenticated(req: PQCAuthenticatedRequest): boolean {
    return !!req.pqcAuth?.verified;
  },

  /**
   * Get PQC auth info from request
   */
  getAuthInfo(req: PQCAuthenticatedRequest) {
    return req.pqcAuth;
  },

  /**
   * Register a client's public key
   */
  async registerClientKey(
    publicKey: Buffer,
    clientId: string,
    algorithm: 'ML-DSA' | 'SLH-DSA'
  ): Promise<string> {
    const keyType = algorithm === 'ML-DSA' ? KeyType.ML_DSA : KeyType.SLH_DSA;
    return await pqcKeyManagement.importPublicKey(
      publicKey,
      keyType,
      KeyPurpose.AUTHENTICATION,
      { clientId }
    );
  },

  /**
   * Generate a key pair for a new client
   */
  async generateClientKeyPair(
    clientId: string,
    algorithm: 'ML-DSA' | 'SLH-DSA' = 'ML-DSA'
  ): Promise<{ keyId: string; publicKey: string; privateKey: string }> {
    const keyType = algorithm === 'ML-DSA' ? KeyType.ML_DSA : KeyType.SLH_DSA;
    const securityLevel = algorithm === 'ML-DSA'
      ? MLDSASecurityLevel.MLDSA65
      : SLHDSASecurityLevel.SLHDSA_SHA2_128F;

    const managedKey = await pqcKeyManagement.generateKey(
      keyType,
      KeyPurpose.AUTHENTICATION,
      {
        securityLevel,
        metadata: { clientId },
      }
    );

    const privateKey = pqcKeyManagement.getPrivateKey(managedKey.id);

    return {
      keyId: managedKey.id,
      publicKey: managedKey.publicKey.toString('base64'),
      privateKey: privateKey.toString('base64'),
    };
  },
};

export default pqcAuthMiddleware;
