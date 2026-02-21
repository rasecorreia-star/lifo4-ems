/**
 * Post-Quantum Cryptography Key Management Service
 * Handles key generation, storage, rotation, and lifecycle management
 * for quantum-resistant cryptographic keys
 */

import { randomBytes, createHash, createCipheriv, createDecipheriv } from 'crypto';
import { EventEmitter } from 'events';
import { logger } from '../../utils/logger.js';
import { MLKEMService, MLKEMSecurityLevel, MLKEMKeyPair, mlkemService } from './ml-kem.js';
import { MLDSAService, MLDSASecurityLevel, MLDSAKeyPair, mldsaService } from './ml-dsa.js';
import { SLHDSAService, SLHDSASecurityLevel, SLHDSAKeyPair, slhdsaService } from './slh-dsa.js';
import { HybridEncryptionService, HybridKeyPair, HybridMode, hybridEncryptionService } from './hybrid-encryption.js';

// ============================================
// TYPES
// ============================================

export enum KeyType {
  ML_KEM = 'ML-KEM',
  ML_DSA = 'ML-DSA',
  SLH_DSA = 'SLH-DSA',
  HYBRID = 'HYBRID',
}

export enum KeyPurpose {
  ENCRYPTION = 'encryption',
  SIGNING = 'signing',
  KEY_EXCHANGE = 'key_exchange',
  AUTHENTICATION = 'authentication',
}

export enum KeyStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  COMPROMISED = 'compromised',
  EXPIRED = 'expired',
  PENDING_ROTATION = 'pending_rotation',
  REVOKED = 'revoked',
}

export interface ManagedKey {
  id: string;
  type: KeyType;
  purpose: KeyPurpose;
  status: KeyStatus;
  securityLevel: string;
  publicKey: Buffer;
  encryptedPrivateKey: Buffer;  // Always stored encrypted
  keyEncryptionKeyId: string;
  createdAt: Date;
  expiresAt: Date;
  lastUsedAt?: Date;
  rotationSchedule?: {
    intervalDays: number;
    nextRotation: Date;
  };
  metadata: Record<string, string>;
}

export interface KeyRotationResult {
  oldKeyId: string;
  newKeyId: string;
  rotatedAt: Date;
  gracePeriodEnd: Date;
}

export interface KeyUsagePolicy {
  maxUsageCount?: number;
  maxAgeDays: number;
  allowedPurposes: KeyPurpose[];
  requireRotation: boolean;
  rotationIntervalDays: number;
}

// ============================================
// KEY MANAGEMENT SERVICE
// ============================================

export class PQCKeyManagementService extends EventEmitter {
  private keys: Map<string, ManagedKey> = new Map();
  private masterKeyEncryptionKey: Buffer;
  private mlkem: MLKEMService;
  private mldsa: MLDSAService;
  private slhdsa: SLHDSAService;
  private hybridEncryption: HybridEncryptionService;

  private defaultPolicies: Record<KeyType, KeyUsagePolicy> = {
    [KeyType.ML_KEM]: {
      maxAgeDays: 365,
      allowedPurposes: [KeyPurpose.ENCRYPTION, KeyPurpose.KEY_EXCHANGE],
      requireRotation: true,
      rotationIntervalDays: 90,
    },
    [KeyType.ML_DSA]: {
      maxAgeDays: 730,
      allowedPurposes: [KeyPurpose.SIGNING, KeyPurpose.AUTHENTICATION],
      requireRotation: true,
      rotationIntervalDays: 180,
    },
    [KeyType.SLH_DSA]: {
      maxAgeDays: 1825,  // 5 years - conservative hash-based
      allowedPurposes: [KeyPurpose.SIGNING],
      requireRotation: true,
      rotationIntervalDays: 365,
    },
    [KeyType.HYBRID]: {
      maxAgeDays: 365,
      allowedPurposes: [KeyPurpose.ENCRYPTION, KeyPurpose.KEY_EXCHANGE],
      requireRotation: true,
      rotationIntervalDays: 90,
    },
  };

  constructor(
    mlkemService?: MLKEMService,
    mldsaService?: MLDSAService,
    slhdsaService?: SLHDSAService,
    hybridService?: HybridEncryptionService
  ) {
    super();
    this.mlkem = mlkemService || new MLKEMService();
    this.mldsa = mldsaService || new MLDSAService();
    this.slhdsa = slhdsaService || new SLHDSAService();
    this.hybridEncryption = hybridService || new HybridEncryptionService();

    // In production, this should come from HSM or secure key store
    this.masterKeyEncryptionKey = this.deriveMasterKey();

    // Start rotation checker
    this.startRotationChecker();
  }

  /**
   * Generate and store a new managed key
   */
  async generateKey(
    type: KeyType,
    purpose: KeyPurpose,
    options: {
      securityLevel?: string;
      expirationDays?: number;
      rotationIntervalDays?: number;
      metadata?: Record<string, string>;
    } = {}
  ): Promise<ManagedKey> {
    const policy = this.defaultPolicies[type];

    if (!policy.allowedPurposes.includes(purpose)) {
      throw new Error(`Key type ${type} cannot be used for purpose ${purpose}`);
    }

    const keyId = this.generateKeyId();
    let publicKey: Buffer;
    let privateKey: Buffer;
    let securityLevel: string;

    try {
      switch (type) {
        case KeyType.ML_KEM: {
          const level = (options.securityLevel as MLKEMSecurityLevel) || MLKEMSecurityLevel.MLKEM768;
          const keyPair = await this.mlkem.generateKeyPair(level);
          publicKey = keyPair.publicKey;
          privateKey = keyPair.privateKey;
          securityLevel = level;
          break;
        }
        case KeyType.ML_DSA: {
          const level = (options.securityLevel as MLDSASecurityLevel) || MLDSASecurityLevel.MLDSA65;
          const keyPair = await this.mldsa.generateKeyPair(level);
          publicKey = keyPair.publicKey;
          privateKey = keyPair.privateKey;
          securityLevel = level;
          break;
        }
        case KeyType.SLH_DSA: {
          const level = (options.securityLevel as SLHDSASecurityLevel) || SLHDSASecurityLevel.SLHDSA_SHA2_128F;
          const keyPair = await this.slhdsa.generateKeyPair(level);
          publicKey = keyPair.publicKey;
          privateKey = keyPair.privateKey;
          securityLevel = level;
          break;
        }
        case KeyType.HYBRID: {
          const keyPair = await this.hybridEncryption.generateKeyPair(HybridMode.HYBRID);
          // Combine classical and PQC public keys
          publicKey = Buffer.concat([
            Buffer.from([keyPair.classical.publicKey.length]),
            keyPair.classical.publicKey,
            keyPair.pqc.publicKey,
          ]);
          privateKey = Buffer.concat([
            Buffer.from([keyPair.classical.privateKey.length]),
            keyPair.classical.privateKey,
            keyPair.pqc.privateKey,
          ]);
          securityLevel = `${keyPair.classical.algorithm}+${keyPair.pqc.algorithm}`;
          break;
        }
        default:
          throw new Error(`Unknown key type: ${type}`);
      }

      // Encrypt private key before storage
      const encryptedPrivateKey = this.encryptPrivateKey(privateKey, keyId);

      const now = new Date();
      const expirationDays = options.expirationDays || policy.maxAgeDays;
      const rotationDays = options.rotationIntervalDays || policy.rotationIntervalDays;

      const managedKey: ManagedKey = {
        id: keyId,
        type,
        purpose,
        status: KeyStatus.ACTIVE,
        securityLevel,
        publicKey,
        encryptedPrivateKey,
        keyEncryptionKeyId: 'master',
        createdAt: now,
        expiresAt: new Date(now.getTime() + expirationDays * 24 * 60 * 60 * 1000),
        rotationSchedule: policy.requireRotation ? {
          intervalDays: rotationDays,
          nextRotation: new Date(now.getTime() + rotationDays * 24 * 60 * 60 * 1000),
        } : undefined,
        metadata: options.metadata || {},
      };

      this.keys.set(keyId, managedKey);

      // Clear private key from memory
      privateKey.fill(0);

      logger.info(`PQC key generated: ${keyId}, type: ${type}, purpose: ${purpose}`);
      this.emit('keyGenerated', { keyId, type, purpose });

      return managedKey;
    } catch (error) {
      logger.error('Key generation failed', { error, type, purpose });
      throw error;
    }
  }

  /**
   * Get key by ID
   */
  getKey(keyId: string): ManagedKey | undefined {
    const key = this.keys.get(keyId);
    if (key) {
      key.lastUsedAt = new Date();
    }
    return key;
  }

  /**
   * Get active keys by type and purpose
   */
  getActiveKeys(type?: KeyType, purpose?: KeyPurpose): ManagedKey[] {
    return Array.from(this.keys.values()).filter(key => {
      if (key.status !== KeyStatus.ACTIVE) return false;
      if (type && key.type !== type) return false;
      if (purpose && key.purpose !== purpose) return false;
      return true;
    });
  }

  /**
   * Get decrypted private key (use with caution)
   */
  getPrivateKey(keyId: string): Buffer {
    const key = this.keys.get(keyId);
    if (!key) {
      throw new Error(`Key not found: ${keyId}`);
    }
    if (key.status !== KeyStatus.ACTIVE) {
      throw new Error(`Key is not active: ${keyId}, status: ${key.status}`);
    }

    return this.decryptPrivateKey(key.encryptedPrivateKey, keyId);
  }

  /**
   * Rotate a key
   */
  async rotateKey(keyId: string): Promise<KeyRotationResult> {
    const oldKey = this.keys.get(keyId);
    if (!oldKey) {
      throw new Error(`Key not found: ${keyId}`);
    }

    // Generate new key with same parameters
    const newKey = await this.generateKey(oldKey.type, oldKey.purpose, {
      securityLevel: oldKey.securityLevel,
      metadata: { ...oldKey.metadata, previousKeyId: keyId },
    });

    // Mark old key for rotation
    oldKey.status = KeyStatus.PENDING_ROTATION;

    const now = new Date();
    const gracePeriodEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

    logger.info(`Key rotated: ${keyId} -> ${newKey.id}`);
    this.emit('keyRotated', { oldKeyId: keyId, newKeyId: newKey.id });

    return {
      oldKeyId: keyId,
      newKeyId: newKey.id,
      rotatedAt: now,
      gracePeriodEnd,
    };
  }

  /**
   * Revoke a key
   */
  revokeKey(keyId: string, reason: string): void {
    const key = this.keys.get(keyId);
    if (!key) {
      throw new Error(`Key not found: ${keyId}`);
    }

    key.status = KeyStatus.REVOKED;
    key.metadata.revokedAt = new Date().toISOString();
    key.metadata.revocationReason = reason;

    logger.warn(`Key revoked: ${keyId}, reason: ${reason}`);
    this.emit('keyRevoked', { keyId, reason });
  }

  /**
   * Mark key as compromised
   */
  markCompromised(keyId: string, details: string): void {
    const key = this.keys.get(keyId);
    if (!key) {
      throw new Error(`Key not found: ${keyId}`);
    }

    key.status = KeyStatus.COMPROMISED;
    key.metadata.compromisedAt = new Date().toISOString();
    key.metadata.compromiseDetails = details;

    logger.error(`Key marked as compromised: ${keyId}`, { details });
    this.emit('keyCompromised', { keyId, details });
  }

  /**
   * Export public key in various formats
   */
  exportPublicKey(keyId: string, format: 'raw' | 'base64' | 'pem' = 'raw'): string | Buffer {
    const key = this.keys.get(keyId);
    if (!key) {
      throw new Error(`Key not found: ${keyId}`);
    }

    switch (format) {
      case 'raw':
        return key.publicKey;
      case 'base64':
        return key.publicKey.toString('base64');
      case 'pem':
        const b64 = key.publicKey.toString('base64');
        const lines = b64.match(/.{1,64}/g) || [];
        return `-----BEGIN ${key.type} PUBLIC KEY-----\n${lines.join('\n')}\n-----END ${key.type} PUBLIC KEY-----`;
      default:
        throw new Error(`Unknown format: ${format}`);
    }
  }

  /**
   * Import a public key
   */
  async importPublicKey(
    publicKey: Buffer,
    type: KeyType,
    purpose: KeyPurpose,
    metadata?: Record<string, string>
  ): Promise<string> {
    const keyId = this.generateKeyId();

    const managedKey: ManagedKey = {
      id: keyId,
      type,
      purpose,
      status: KeyStatus.ACTIVE,
      securityLevel: 'imported',
      publicKey,
      encryptedPrivateKey: Buffer.alloc(0),  // No private key for imports
      keyEncryptionKeyId: 'none',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      metadata: { ...metadata, imported: 'true' },
    };

    this.keys.set(keyId, managedKey);

    logger.info(`Public key imported: ${keyId}`);
    return keyId;
  }

  /**
   * Get key usage statistics
   */
  getKeyStatistics(): {
    total: number;
    byType: Record<KeyType, number>;
    byStatus: Record<KeyStatus, number>;
    pendingRotation: number;
    expiringSoon: number;
  } {
    const stats = {
      total: this.keys.size,
      byType: {} as Record<KeyType, number>,
      byStatus: {} as Record<KeyStatus, number>,
      pendingRotation: 0,
      expiringSoon: 0,
    };

    const now = new Date();
    const soonThreshold = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    for (const key of this.keys.values()) {
      stats.byType[key.type] = (stats.byType[key.type] || 0) + 1;
      stats.byStatus[key.status] = (stats.byStatus[key.status] || 0) + 1;

      if (key.rotationSchedule && key.rotationSchedule.nextRotation < now) {
        stats.pendingRotation++;
      }
      if (key.expiresAt < soonThreshold) {
        stats.expiringSoon++;
      }
    }

    return stats;
  }

  /**
   * Clean up expired and revoked keys
   */
  cleanupKeys(): { removed: number; archived: string[] } {
    const toRemove: string[] = [];
    const toArchive: string[] = [];
    const now = new Date();
    const archiveThreshold = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    for (const [keyId, key] of this.keys.entries()) {
      if (key.status === KeyStatus.REVOKED || key.status === KeyStatus.COMPROMISED) {
        if (key.createdAt < archiveThreshold) {
          toArchive.push(keyId);
          toRemove.push(keyId);
        }
      } else if (key.status === KeyStatus.EXPIRED) {
        toRemove.push(keyId);
      } else if (key.expiresAt < now) {
        key.status = KeyStatus.EXPIRED;
      }
    }

    for (const keyId of toRemove) {
      this.keys.delete(keyId);
    }

    logger.info(`Key cleanup: removed ${toRemove.length}, archived ${toArchive.length}`);
    return { removed: toRemove.length, archived: toArchive };
  }

  // ============================================
  // PRIVATE METHODS
  // ============================================

  private generateKeyId(): string {
    const timestamp = Date.now().toString(36);
    const random = randomBytes(8).toString('hex');
    return `pqc-${timestamp}-${random}`;
  }

  private deriveMasterKey(): Buffer {
    // In production: use HSM, Vault, or AWS KMS
    // This is a placeholder for development
    const seed = process.env.PQC_MASTER_KEY_SEED || 'development-only-seed';
    return createHash('sha256')
      .update(seed)
      .update('pqc-key-encryption')
      .digest();
  }

  private encryptPrivateKey(privateKey: Buffer, keyId: string): Buffer {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.masterKeyEncryptionKey, iv);
    cipher.setAAD(Buffer.from(keyId));

    const encrypted = Buffer.concat([
      cipher.update(privateKey),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return Buffer.concat([iv, authTag, encrypted]);
  }

  private decryptPrivateKey(encryptedKey: Buffer, keyId: string): Buffer {
    const iv = encryptedKey.slice(0, 12);
    const authTag = encryptedKey.slice(12, 28);
    const ciphertext = encryptedKey.slice(28);

    const decipher = createDecipheriv('aes-256-gcm', this.masterKeyEncryptionKey, iv);
    decipher.setAAD(Buffer.from(keyId));
    decipher.setAuthTag(authTag);

    return Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
  }

  private startRotationChecker(): void {
    // Check every hour for keys needing rotation
    setInterval(() => {
      this.checkRotationSchedule();
    }, 60 * 60 * 1000);
  }

  private checkRotationSchedule(): void {
    const now = new Date();

    for (const [keyId, key] of this.keys.entries()) {
      if (key.status !== KeyStatus.ACTIVE) continue;

      if (key.rotationSchedule && key.rotationSchedule.nextRotation < now) {
        logger.warn(`Key ${keyId} is due for rotation`);
        this.emit('rotationDue', { keyId, dueDate: key.rotationSchedule.nextRotation });
      }

      if (key.expiresAt < now) {
        key.status = KeyStatus.EXPIRED;
        logger.warn(`Key ${keyId} has expired`);
        this.emit('keyExpired', { keyId });
      }
    }
  }
}

export const pqcKeyManagement = new PQCKeyManagementService(
  mlkemService,
  mldsaService,
  slhdsaService,
  hybridEncryptionService
);
