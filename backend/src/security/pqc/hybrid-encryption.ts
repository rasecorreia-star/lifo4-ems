/**
 * Hybrid Encryption Service
 * Combines classical (ECDH/RSA) with post-quantum (ML-KEM) for defense-in-depth
 * Provides quantum-safe encryption while maintaining classical security
 */

import { randomBytes, createCipheriv, createDecipheriv, createECDH, createHash } from 'crypto';
import { logger } from '../../utils/logger.js';
import { MLKEMService, MLKEMSecurityLevel, mlkemService } from './ml-kem.js';

// ============================================
// TYPES
// ============================================

export enum HybridMode {
  CLASSICAL_ONLY = 'classical',
  PQC_ONLY = 'pqc',
  HYBRID = 'hybrid',  // Recommended: Both classical + PQC
}

export interface HybridKeyPair {
  classical: {
    publicKey: Buffer;
    privateKey: Buffer;
    algorithm: string;
  };
  pqc: {
    publicKey: Buffer;
    privateKey: Buffer;
    algorithm: MLKEMSecurityLevel;
  };
  mode: HybridMode;
  keyId: string;
  createdAt: Date;
}

export interface HybridEncapsulation {
  classicalCiphertext?: Buffer;
  pqcCiphertext?: Buffer;
  combinedSecret: Buffer;
  mode: HybridMode;
}

export interface HybridEncryptedData {
  ciphertext: Buffer;
  iv: Buffer;
  authTag: Buffer;
  classicalKem?: Buffer;
  pqcKem?: Buffer;
  mode: HybridMode;
  algorithm: string;
  keyId?: string;
}

// ============================================
// HYBRID ENCRYPTION SERVICE
// ============================================

export class HybridEncryptionService {
  private mlkem: MLKEMService;
  private defaultMode: HybridMode = HybridMode.HYBRID;
  private defaultPQCLevel: MLKEMSecurityLevel = MLKEMSecurityLevel.MLKEM768;
  private classicalCurve: string = 'secp384r1';  // NIST P-384

  constructor(mlkemService?: MLKEMService) {
    this.mlkem = mlkemService || new MLKEMService();
  }

  /**
   * Generate hybrid key pair (classical ECDH + ML-KEM)
   */
  async generateKeyPair(
    mode: HybridMode = this.defaultMode,
    pqcLevel: MLKEMSecurityLevel = this.defaultPQCLevel
  ): Promise<HybridKeyPair> {
    const keyId = randomBytes(16).toString('hex');

    try {
      let classicalKeys = { publicKey: Buffer.alloc(0), privateKey: Buffer.alloc(0), algorithm: '' };
      let pqcKeys = { publicKey: Buffer.alloc(0), privateKey: Buffer.alloc(0), algorithm: pqcLevel };

      // Generate classical ECDH keys
      if (mode === HybridMode.CLASSICAL_ONLY || mode === HybridMode.HYBRID) {
        const ecdh = createECDH(this.classicalCurve);
        ecdh.generateKeys();
        classicalKeys = {
          publicKey: ecdh.getPublicKey(),
          privateKey: ecdh.getPrivateKey(),
          algorithm: `ECDH-${this.classicalCurve}`,
        };
      }

      // Generate ML-KEM keys
      if (mode === HybridMode.PQC_ONLY || mode === HybridMode.HYBRID) {
        const mlkemKeyPair = await this.mlkem.generateKeyPair(pqcLevel);
        pqcKeys = {
          publicKey: mlkemKeyPair.publicKey,
          privateKey: mlkemKeyPair.privateKey,
          algorithm: pqcLevel,
        };
      }

      logger.info(`Hybrid key pair generated: ${mode}, keyId: ${keyId}`);

      return {
        classical: classicalKeys,
        pqc: pqcKeys,
        mode,
        keyId,
        createdAt: new Date(),
      };
    } catch (error) {
      logger.error('Hybrid key generation failed', { error });
      throw error;
    }
  }

  /**
   * Encapsulate - Generate shared secret using hybrid KEM
   */
  async encapsulate(
    recipientPublicKey: HybridKeyPair['classical'] & { pqcPublicKey?: Buffer },
    pqcPublicKey: Buffer,
    mode: HybridMode = this.defaultMode,
    pqcLevel: MLKEMSecurityLevel = this.defaultPQCLevel
  ): Promise<HybridEncapsulation> {
    try {
      let classicalSecret = Buffer.alloc(0);
      let classicalCiphertext: Buffer | undefined;
      let pqcSecret = Buffer.alloc(0);
      let pqcCiphertext: Buffer | undefined;

      // Classical ECDH key agreement
      if (mode === HybridMode.CLASSICAL_ONLY || mode === HybridMode.HYBRID) {
        const ephemeral = createECDH(this.classicalCurve);
        ephemeral.generateKeys();
        classicalSecret = ephemeral.computeSecret(recipientPublicKey.publicKey);
        classicalCiphertext = ephemeral.getPublicKey();
      }

      // ML-KEM encapsulation
      if (mode === HybridMode.PQC_ONLY || mode === HybridMode.HYBRID) {
        const pqcResult = await this.mlkem.encapsulate(pqcPublicKey, pqcLevel);
        pqcSecret = pqcResult.sharedSecret;
        pqcCiphertext = pqcResult.ciphertext;
      }

      // Combine secrets using HKDF-like derivation
      const combinedSecret = this.combineSecrets(classicalSecret, pqcSecret, mode);

      return {
        classicalCiphertext,
        pqcCiphertext,
        combinedSecret,
        mode,
      };
    } catch (error) {
      logger.error('Hybrid encapsulation failed', { error });
      throw error;
    }
  }

  /**
   * Decapsulate - Recover shared secret using hybrid KEM
   */
  async decapsulate(
    encapsulation: { classicalCiphertext?: Buffer; pqcCiphertext?: Buffer; mode: HybridMode },
    keyPair: HybridKeyPair,
    pqcLevel: MLKEMSecurityLevel = this.defaultPQCLevel
  ): Promise<Buffer> {
    try {
      let classicalSecret = Buffer.alloc(0);
      let pqcSecret = Buffer.alloc(0);

      // Classical ECDH key agreement
      if ((encapsulation.mode === HybridMode.CLASSICAL_ONLY || encapsulation.mode === HybridMode.HYBRID)
          && encapsulation.classicalCiphertext) {
        const ecdh = createECDH(this.classicalCurve);
        ecdh.setPrivateKey(keyPair.classical.privateKey);
        classicalSecret = ecdh.computeSecret(encapsulation.classicalCiphertext);
      }

      // ML-KEM decapsulation
      if ((encapsulation.mode === HybridMode.PQC_ONLY || encapsulation.mode === HybridMode.HYBRID)
          && encapsulation.pqcCiphertext) {
        pqcSecret = await this.mlkem.decapsulate(
          encapsulation.pqcCiphertext,
          keyPair.pqc.privateKey,
          pqcLevel
        );
      }

      // Combine secrets
      return this.combineSecrets(classicalSecret, pqcSecret, encapsulation.mode);
    } catch (error) {
      logger.error('Hybrid decapsulation failed', { error });
      throw error;
    }
  }

  /**
   * Encrypt data using hybrid encryption
   */
  async encrypt(
    plaintext: Buffer,
    recipientPublicKey: { classical: Buffer; pqc: Buffer },
    mode: HybridMode = this.defaultMode,
    pqcLevel: MLKEMSecurityLevel = this.defaultPQCLevel
  ): Promise<HybridEncryptedData> {
    try {
      // Encapsulate to get shared secret
      const encapsulation = await this.encapsulate(
        { publicKey: recipientPublicKey.classical, privateKey: Buffer.alloc(0), algorithm: '' },
        recipientPublicKey.pqc,
        mode,
        pqcLevel
      );

      // Derive encryption key from combined secret
      const encryptionKey = createHash('sha256')
        .update(encapsulation.combinedSecret)
        .update(Buffer.from('encryption'))
        .digest();

      // Encrypt with AES-256-GCM
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', encryptionKey, iv);

      const ciphertext = Buffer.concat([
        cipher.update(plaintext),
        cipher.final(),
      ]);
      const authTag = cipher.getAuthTag();

      return {
        ciphertext,
        iv,
        authTag,
        classicalKem: encapsulation.classicalCiphertext,
        pqcKem: encapsulation.pqcCiphertext,
        mode,
        algorithm: `AES-256-GCM+${mode === HybridMode.HYBRID ? 'ECDH+ML-KEM' : mode === HybridMode.PQC_ONLY ? 'ML-KEM' : 'ECDH'}`,
      };
    } catch (error) {
      logger.error('Hybrid encryption failed', { error });
      throw error;
    }
  }

  /**
   * Decrypt data using hybrid encryption
   */
  async decrypt(
    encryptedData: HybridEncryptedData,
    keyPair: HybridKeyPair,
    pqcLevel: MLKEMSecurityLevel = this.defaultPQCLevel
  ): Promise<Buffer> {
    try {
      // Decapsulate to recover shared secret
      const combinedSecret = await this.decapsulate(
        {
          classicalCiphertext: encryptedData.classicalKem,
          pqcCiphertext: encryptedData.pqcKem,
          mode: encryptedData.mode,
        },
        keyPair,
        pqcLevel
      );

      // Derive decryption key
      const decryptionKey = createHash('sha256')
        .update(combinedSecret)
        .update(Buffer.from('encryption'))
        .digest();

      // Decrypt with AES-256-GCM
      const decipher = createDecipheriv('aes-256-gcm', decryptionKey, encryptedData.iv);
      decipher.setAuthTag(encryptedData.authTag);

      const plaintext = Buffer.concat([
        decipher.update(encryptedData.ciphertext),
        decipher.final(),
      ]);

      return plaintext;
    } catch (error) {
      logger.error('Hybrid decryption failed', { error });
      throw error;
    }
  }

  /**
   * Encrypt JSON object
   */
  async encryptObject<T extends object>(
    obj: T,
    recipientPublicKey: { classical: Buffer; pqc: Buffer },
    mode: HybridMode = this.defaultMode
  ): Promise<{ encrypted: HybridEncryptedData; metadata: { type: string; timestamp: string } }> {
    const plaintext = Buffer.from(JSON.stringify(obj), 'utf-8');
    const encrypted = await this.encrypt(plaintext, recipientPublicKey, mode);

    return {
      encrypted,
      metadata: {
        type: 'json',
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Decrypt JSON object
   */
  async decryptObject<T extends object>(
    encryptedData: HybridEncryptedData,
    keyPair: HybridKeyPair
  ): Promise<T> {
    const plaintext = await this.decrypt(encryptedData, keyPair);
    return JSON.parse(plaintext.toString('utf-8')) as T;
  }

  /**
   * Combine classical and PQC secrets
   * Uses domain separation and proper key derivation
   */
  private combineSecrets(
    classicalSecret: Buffer,
    pqcSecret: Buffer,
    mode: HybridMode
  ): Buffer {
    // Domain separation labels
    const domainSeparator = Buffer.from(`HybridKEM-${mode}`);

    if (mode === HybridMode.CLASSICAL_ONLY) {
      return createHash('sha256')
        .update(domainSeparator)
        .update(classicalSecret)
        .digest();
    }

    if (mode === HybridMode.PQC_ONLY) {
      return createHash('sha256')
        .update(domainSeparator)
        .update(pqcSecret)
        .digest();
    }

    // Hybrid: XOR the hashes of both secrets, then hash again
    // This ensures security if either component is secure
    const classicalHash = createHash('sha256')
      .update(Buffer.from('classical'))
      .update(classicalSecret)
      .digest();

    const pqcHash = createHash('sha256')
      .update(Buffer.from('pqc'))
      .update(pqcSecret)
      .digest();

    const xored = Buffer.alloc(32);
    for (let i = 0; i < 32; i++) {
      xored[i] = classicalHash[i] ^ pqcHash[i];
    }

    return createHash('sha256')
      .update(domainSeparator)
      .update(xored)
      .update(classicalSecret)
      .update(pqcSecret)
      .digest();
  }

  /**
   * Serialize encrypted data for transport
   */
  serializeEncryptedData(data: HybridEncryptedData): Buffer {
    const json = {
      ciphertext: data.ciphertext.toString('base64'),
      iv: data.iv.toString('base64'),
      authTag: data.authTag.toString('base64'),
      classicalKem: data.classicalKem?.toString('base64'),
      pqcKem: data.pqcKem?.toString('base64'),
      mode: data.mode,
      algorithm: data.algorithm,
      keyId: data.keyId,
    };
    return Buffer.from(JSON.stringify(json));
  }

  /**
   * Deserialize encrypted data from transport
   */
  deserializeEncryptedData(serialized: Buffer): HybridEncryptedData {
    const json = JSON.parse(serialized.toString());
    return {
      ciphertext: Buffer.from(json.ciphertext, 'base64'),
      iv: Buffer.from(json.iv, 'base64'),
      authTag: Buffer.from(json.authTag, 'base64'),
      classicalKem: json.classicalKem ? Buffer.from(json.classicalKem, 'base64') : undefined,
      pqcKem: json.pqcKem ? Buffer.from(json.pqcKem, 'base64') : undefined,
      mode: json.mode,
      algorithm: json.algorithm,
      keyId: json.keyId,
    };
  }

  /**
   * Get recommended mode based on security requirements
   */
  getRecommendedMode(requirements: {
    quantumResistant: boolean;
    backwardsCompatible: boolean;
    performanceCritical: boolean;
  }): HybridMode {
    if (requirements.quantumResistant && requirements.backwardsCompatible) {
      return HybridMode.HYBRID;
    }
    if (requirements.quantumResistant && requirements.performanceCritical) {
      return HybridMode.PQC_ONLY;
    }
    if (!requirements.quantumResistant) {
      return HybridMode.CLASSICAL_ONLY;
    }
    return HybridMode.HYBRID;
  }
}

export const hybridEncryptionService = new HybridEncryptionService(mlkemService);
