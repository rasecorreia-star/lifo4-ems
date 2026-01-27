/**
 * Post-Quantum Cryptography Module
 * Implements NIST PQC standards for quantum-resistant security
 *
 * Algorithms:
 * - ML-KEM (FIPS 203): Key Encapsulation Mechanism (formerly Kyber)
 * - ML-DSA (FIPS 204): Digital Signature Algorithm (formerly Dilithium)
 * - SLH-DSA (FIPS 205): Stateless Hash-Based Digital Signature (formerly SPHINCS+)
 */

// Re-export all types and classes
export * from './ml-kem.js';
export * from './ml-dsa.js';
export * from './slh-dsa.js';
export * from './hybrid-encryption.js';
export * from './key-management.js';

// Import singleton instances
import { MLKEMService, mlkemService, MLKEMSecurityLevel } from './ml-kem.js';
import { MLDSAService, mldsaService, MLDSASecurityLevel } from './ml-dsa.js';
import { SLHDSAService, slhdsaService, SLHDSASecurityLevel } from './slh-dsa.js';
import { HybridEncryptionService, hybridEncryptionService, HybridMode } from './hybrid-encryption.js';
import { PQCKeyManagementService, pqcKeyManagement, KeyType, KeyPurpose, KeyStatus } from './key-management.js';

// Named exports for services
export {
  // ML-KEM (Key Encapsulation)
  MLKEMService,
  mlkemService,
  MLKEMSecurityLevel,

  // ML-DSA (Digital Signatures)
  MLDSAService,
  mldsaService,
  MLDSASecurityLevel,

  // SLH-DSA (Hash-Based Signatures)
  SLHDSAService,
  slhdsaService,
  SLHDSASecurityLevel,

  // Hybrid Encryption
  HybridEncryptionService,
  hybridEncryptionService,
  HybridMode,

  // Key Management
  PQCKeyManagementService,
  pqcKeyManagement,
  KeyType,
  KeyPurpose,
  KeyStatus,
};

/**
 * PQC Module Summary
 *
 * Usage Examples:
 *
 * 1. Key Exchange (ML-KEM):
 *    const keyPair = await mlkemService.generateKeyPair(MLKEMSecurityLevel.MLKEM768);
 *    const { ciphertext, sharedSecret } = await mlkemService.encapsulate(keyPair.publicKey);
 *
 * 2. Digital Signatures (ML-DSA):
 *    const keyPair = await mldsaService.generateKeyPair(MLDSASecurityLevel.MLDSA65);
 *    const signature = await mldsaService.sign(message, keyPair.privateKey);
 *    const valid = await mldsaService.verify(message, signature.signature, keyPair.publicKey);
 *
 * 3. Hybrid Encryption:
 *    const keyPair = await hybridEncryptionService.generateKeyPair(HybridMode.HYBRID);
 *    const encrypted = await hybridEncryptionService.encrypt(plaintext, {
 *      classical: keyPair.classical.publicKey,
 *      pqc: keyPair.pqc.publicKey,
 *    });
 *
 * 4. Key Management:
 *    const key = await pqcKeyManagement.generateKey(KeyType.ML_KEM, KeyPurpose.ENCRYPTION);
 *    await pqcKeyManagement.rotateKey(key.id);
 */
