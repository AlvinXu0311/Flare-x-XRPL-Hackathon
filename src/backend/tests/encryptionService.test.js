const crypto = require('crypto');
const EncryptionService = require('../services/encryptionService');

describe('EncryptionService', () => {
  let testData;
  let testKey;

  beforeEach(() => {
    testData = Buffer.from('Hello, World! This is test data for encryption.', 'utf8');
    testKey = EncryptionService.generateEncryptionKey();
  });

  describe('generateEncryptionKey', () => {
    test('should generate a 32-byte encryption key', () => {
      const key = EncryptionService.generateEncryptionKey();
      expect(key).toBeInstanceOf(Buffer);
      expect(key.length).toBe(32);
    });

    test('should generate different keys each time', () => {
      const key1 = EncryptionService.generateEncryptionKey();
      const key2 = EncryptionService.generateEncryptionKey();
      expect(key1.equals(key2)).toBe(false);
    });
  });

  describe('generateFileHash', () => {
    test('should generate SHA256 hash of buffer', () => {
      const hash = EncryptionService.generateFileHash(testData);
      expect(typeof hash).toBe('string');
      expect(hash.length).toBe(64); // SHA256 hex string length
    });

    test('should generate same hash for same data', () => {
      const hash1 = EncryptionService.generateFileHash(testData);
      const hash2 = EncryptionService.generateFileHash(testData);
      expect(hash1).toBe(hash2);
    });

    test('should generate different hash for different data', () => {
      const data2 = Buffer.from('Different data', 'utf8');
      const hash1 = EncryptionService.generateFileHash(testData);
      const hash2 = EncryptionService.generateFileHash(data2);
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('encryptFile', () => {
    test('should encrypt file buffer successfully', () => {
      const result = EncryptionService.encryptFile(testData, testKey);

      expect(result).toHaveProperty('encryptedData');
      expect(result).toHaveProperty('encryptionKey');
      expect(result).toHaveProperty('iv');
      expect(result).toHaveProperty('tag');
      expect(result).toHaveProperty('algorithm', 'aes-256-gcm');
      expect(result).toHaveProperty('originalSize', testData.length);
      expect(result).toHaveProperty('encryptedSize');

      expect(result.encryptedData).toBeInstanceOf(Buffer);
      expect(result.encryptionKey).toBe(testKey.toString('hex'));
      expect(result.iv.length).toBe(32); // 16 bytes * 2 for hex
      expect(result.tag.length).toBe(32); // 16 bytes * 2 for hex
    });

    test('should generate new key if none provided', () => {
      const result = EncryptionService.encryptFile(testData);

      expect(result.encryptionKey).toBeDefined();
      expect(result.encryptionKey.length).toBe(64); // 32 bytes * 2 for hex
    });

    test('should produce different encrypted data for same input', () => {
      const result1 = EncryptionService.encryptFile(testData, testKey);
      const result2 = EncryptionService.encryptFile(testData, testKey);

      expect(result1.encryptedData.equals(result2.encryptedData)).toBe(false);
      expect(result1.iv).not.toBe(result2.iv);
    });

    test('should handle empty buffer', () => {
      const emptyBuffer = Buffer.alloc(0);
      const result = EncryptionService.encryptFile(emptyBuffer, testKey);

      expect(result.originalSize).toBe(0);
      expect(result.encryptedData).toBeInstanceOf(Buffer);
    });

    test('should throw error for invalid input', () => {
      expect(() => {
        EncryptionService.encryptFile(null, testKey);
      }).toThrow();
    });
  });

  describe('decryptFile', () => {
    test('should decrypt encrypted file successfully', () => {
      const encrypted = EncryptionService.encryptFile(testData, testKey);
      const decrypted = EncryptionService.decryptFile(encrypted.encryptedData, testKey);

      expect(decrypted).toHaveProperty('decryptedData');
      expect(decrypted).toHaveProperty('originalSize');
      expect(decrypted.decryptedData.equals(testData)).toBe(true);
      expect(decrypted.originalSize).toBe(testData.length);
    });

    test('should handle hex string encryption key', () => {
      const encrypted = EncryptionService.encryptFile(testData, testKey);
      const hexKey = testKey.toString('hex');
      const decrypted = EncryptionService.decryptFile(encrypted.encryptedData, hexKey);

      expect(decrypted.decryptedData.equals(testData)).toBe(true);
    });

    test('should throw error with wrong key', () => {
      const encrypted = EncryptionService.encryptFile(testData, testKey);
      const wrongKey = EncryptionService.generateEncryptionKey();

      expect(() => {
        EncryptionService.decryptFile(encrypted.encryptedData, wrongKey);
      }).toThrow(/decryption failed/i);
    });

    test('should throw error with corrupted data', () => {
      const encrypted = EncryptionService.encryptFile(testData, testKey);
      const corruptedData = Buffer.from(encrypted.encryptedData);
      corruptedData[10] = corruptedData[10] ^ 1; // Flip a bit

      expect(() => {
        EncryptionService.decryptFile(corruptedData, testKey);
      }).toThrow(/decryption failed/i);
    });

    test('should throw error with insufficient data', () => {
      const shortBuffer = Buffer.alloc(10);

      expect(() => {
        EncryptionService.decryptFile(shortBuffer, testKey);
      }).toThrow();
    });
  });

  describe('encryptPatientData', () => {
    const patientInfo = {
      id: 'patient123',
      name: 'John Doe',
      age: 35,
      diagnosis: 'Hypertension'
    };

    test('should encrypt patient data successfully', () => {
      const result = EncryptionService.encryptPatientData(patientInfo, testKey);

      expect(result).toHaveProperty('encryptedData');
      expect(result).toHaveProperty('encryptionKey');
      expect(result).toHaveProperty('iv');
      expect(result).toHaveProperty('tag');

      expect(typeof result.encryptedData).toBe('string');
      expect(result.encryptionKey).toBe(testKey.toString('hex'));
    });

    test('should generate new key if none provided', () => {
      const result = EncryptionService.encryptPatientData(patientInfo);

      expect(result.encryptionKey).toBeDefined();
      expect(result.encryptionKey.length).toBe(64);
    });

    test('should handle complex patient data', () => {
      const complexData = {
        ...patientInfo,
        medications: ['Lisinopril', 'Metformin'],
        visits: [
          { date: '2024-01-01', notes: 'Regular checkup' },
          { date: '2024-02-01', notes: 'Follow-up' }
        ]
      };

      const result = EncryptionService.encryptPatientData(complexData, testKey);
      expect(result.encryptedData).toBeDefined();
    });
  });

  describe('decryptPatientData', () => {
    const patientInfo = {
      id: 'patient123',
      name: 'John Doe',
      age: 35,
      diagnosis: 'Hypertension'
    };

    test('should decrypt patient data successfully', () => {
      const encrypted = EncryptionService.encryptPatientData(patientInfo, testKey);
      const decrypted = EncryptionService.decryptPatientData(encrypted.encryptedData, testKey);

      expect(decrypted).toEqual(patientInfo);
    });

    test('should handle hex string encryption key', () => {
      const encrypted = EncryptionService.encryptPatientData(patientInfo, testKey);
      const hexKey = testKey.toString('hex');
      const decrypted = EncryptionService.decryptPatientData(encrypted.encryptedData, hexKey);

      expect(decrypted).toEqual(patientInfo);
    });

    test('should throw error with wrong key', () => {
      const encrypted = EncryptionService.encryptPatientData(patientInfo, testKey);
      const wrongKey = EncryptionService.generateEncryptionKey();

      expect(() => {
        EncryptionService.decryptPatientData(encrypted.encryptedData, wrongKey);
      }).toThrow(/decryption failed/i);
    });
  });

  describe('generatePasswordHash', () => {
    const password = 'testPassword123!';

    test('should generate password hash with salt', () => {
      const result = EncryptionService.generatePasswordHash(password);

      expect(result).toHaveProperty('hash');
      expect(result).toHaveProperty('salt');
      expect(result.hash.length).toBe(128); // 64 bytes * 2 for hex
      expect(result.salt.length).toBe(64); // 32 bytes * 2 for hex
    });

    test('should use provided salt', () => {
      const salt = crypto.randomBytes(32);
      const result = EncryptionService.generatePasswordHash(password, salt);

      expect(result.salt).toBe(salt.toString('hex'));
    });

    test('should handle hex string salt', () => {
      const salt = crypto.randomBytes(32).toString('hex');
      const result = EncryptionService.generatePasswordHash(password, salt);

      expect(result.salt).toBe(salt);
    });

    test('should generate same hash for same password and salt', () => {
      const salt = crypto.randomBytes(32);
      const result1 = EncryptionService.generatePasswordHash(password, salt);
      const result2 = EncryptionService.generatePasswordHash(password, salt);

      expect(result1.hash).toBe(result2.hash);
    });

    test('should generate different hash for different passwords', () => {
      const salt = crypto.randomBytes(32);
      const result1 = EncryptionService.generatePasswordHash(password, salt);
      const result2 = EncryptionService.generatePasswordHash('differentPassword', salt);

      expect(result1.hash).not.toBe(result2.hash);
    });
  });

  describe('verifyPassword', () => {
    const password = 'testPassword123!';

    test('should verify correct password', () => {
      const hashResult = EncryptionService.generatePasswordHash(password);
      const isValid = EncryptionService.verifyPassword(password, hashResult.hash, hashResult.salt);

      expect(isValid).toBe(true);
    });

    test('should reject incorrect password', () => {
      const hashResult = EncryptionService.generatePasswordHash(password);
      const isValid = EncryptionService.verifyPassword('wrongPassword', hashResult.hash, hashResult.salt);

      expect(isValid).toBe(false);
    });

    test('should handle verification errors gracefully', () => {
      const isValid = EncryptionService.verifyPassword('password', 'invalidhash', 'invalidsalt');

      expect(isValid).toBe(false);
    });
  });

  describe('generateSecureToken', () => {
    test('should generate token with default length', () => {
      const token = EncryptionService.generateSecureToken();

      expect(typeof token).toBe('string');
      expect(token.length).toBe(64); // 32 bytes * 2 for hex
    });

    test('should generate token with custom length', () => {
      const token = EncryptionService.generateSecureToken(16);

      expect(token.length).toBe(32); // 16 bytes * 2 for hex
    });

    test('should generate different tokens each time', () => {
      const token1 = EncryptionService.generateSecureToken();
      const token2 = EncryptionService.generateSecureToken();

      expect(token1).not.toBe(token2);
    });
  });

  describe('generateHMAC', () => {
    const data = { user: 'test', action: 'login' };
    const secret = 'secretKey123';

    test('should generate HMAC signature', () => {
      const hmac = EncryptionService.generateHMAC(data, secret);

      expect(typeof hmac).toBe('string');
      expect(hmac.length).toBe(64); // SHA256 hex string
    });

    test('should generate same HMAC for same data and secret', () => {
      const hmac1 = EncryptionService.generateHMAC(data, secret);
      const hmac2 = EncryptionService.generateHMAC(data, secret);

      expect(hmac1).toBe(hmac2);
    });

    test('should generate different HMAC for different data', () => {
      const data2 = { user: 'test2', action: 'logout' };
      const hmac1 = EncryptionService.generateHMAC(data, secret);
      const hmac2 = EncryptionService.generateHMAC(data2, secret);

      expect(hmac1).not.toBe(hmac2);
    });
  });

  describe('verifyHMAC', () => {
    const data = { user: 'test', action: 'login' };
    const secret = 'secretKey123';

    test('should verify correct HMAC', () => {
      const hmac = EncryptionService.generateHMAC(data, secret);
      const isValid = EncryptionService.verifyHMAC(data, hmac, secret);

      expect(isValid).toBe(true);
    });

    test('should reject incorrect HMAC', () => {
      const hmac = EncryptionService.generateHMAC(data, secret);
      const isValid = EncryptionService.verifyHMAC(data, 'wronghmac', secret);

      expect(isValid).toBe(false);
    });

    test('should reject HMAC with wrong secret', () => {
      const hmac = EncryptionService.generateHMAC(data, secret);
      const isValid = EncryptionService.verifyHMAC(data, hmac, 'wrongSecret');

      expect(isValid).toBe(false);
    });
  });

  describe('generateKeyPair', () => {
    test('should generate RSA key pair', () => {
      const keyPair = EncryptionService.generateKeyPair();

      expect(keyPair).toHaveProperty('publicKey');
      expect(keyPair).toHaveProperty('privateKey');
      expect(keyPair.publicKey).toContain('-----BEGIN PUBLIC KEY-----');
      expect(keyPair.privateKey).toContain('-----BEGIN PRIVATE KEY-----');
    });

    test('should generate different key pairs each time', () => {
      const keyPair1 = EncryptionService.generateKeyPair();
      const keyPair2 = EncryptionService.generateKeyPair();

      expect(keyPair1.publicKey).not.toBe(keyPair2.publicKey);
      expect(keyPair1.privateKey).not.toBe(keyPair2.privateKey);
    });
  });

  describe('encryptWithPublicKey and decryptWithPrivateKey', () => {
    const testData = { message: 'Secret data', timestamp: Date.now() };
    let keyPair;

    beforeEach(() => {
      keyPair = EncryptionService.generateKeyPair();
    });

    test('should encrypt and decrypt with key pair', () => {
      const encrypted = EncryptionService.encryptWithPublicKey(testData, keyPair.publicKey);
      const decrypted = EncryptionService.decryptWithPrivateKey(encrypted, keyPair.privateKey);

      expect(decrypted).toEqual(testData);
    });

    test('should produce different encrypted data for same input', () => {
      const encrypted1 = EncryptionService.encryptWithPublicKey(testData, keyPair.publicKey);
      const encrypted2 = EncryptionService.encryptWithPublicKey(testData, keyPair.publicKey);

      expect(encrypted1).not.toBe(encrypted2);
    });

    test('should throw error with wrong private key', () => {
      const wrongKeyPair = EncryptionService.generateKeyPair();
      const encrypted = EncryptionService.encryptWithPublicKey(testData, keyPair.publicKey);

      expect(() => {
        EncryptionService.decryptWithPrivateKey(encrypted, wrongKeyPair.privateKey);
      }).toThrow();
    });
  });

  describe('createDigitalSignature and verifyDigitalSignature', () => {
    const testData = 'Important document content';
    let keyPair;

    beforeEach(() => {
      keyPair = EncryptionService.generateKeyPair();
    });

    test('should create and verify digital signature', () => {
      const signature = EncryptionService.createDigitalSignature(testData, keyPair.privateKey);
      const isValid = EncryptionService.verifyDigitalSignature(testData, signature, keyPair.publicKey);

      expect(typeof signature).toBe('string');
      expect(isValid).toBe(true);
    });

    test('should handle object data', () => {
      const objectData = { document: 'test', version: 1 };
      const signature = EncryptionService.createDigitalSignature(objectData, keyPair.privateKey);
      const isValid = EncryptionService.verifyDigitalSignature(objectData, signature, keyPair.publicKey);

      expect(isValid).toBe(true);
    });

    test('should reject signature with wrong public key', () => {
      const wrongKeyPair = EncryptionService.generateKeyPair();
      const signature = EncryptionService.createDigitalSignature(testData, keyPair.privateKey);
      const isValid = EncryptionService.verifyDigitalSignature(testData, signature, wrongKeyPair.publicKey);

      expect(isValid).toBe(false);
    });

    test('should reject modified data', () => {
      const signature = EncryptionService.createDigitalSignature(testData, keyPair.privateKey);
      const isValid = EncryptionService.verifyDigitalSignature('Modified content', signature, keyPair.publicKey);

      expect(isValid).toBe(false);
    });
  });

  describe('generateSessionKey', () => {
    test('should generate session key with expiration', () => {
      const sessionKey = EncryptionService.generateSessionKey();

      expect(sessionKey).toHaveProperty('key');
      expect(sessionKey).toHaveProperty('iv');
      expect(sessionKey).toHaveProperty('expiresAt');

      expect(sessionKey.key.length).toBe(64); // 32 bytes * 2 for hex
      expect(sessionKey.iv.length).toBe(32); // 16 bytes * 2 for hex
      expect(sessionKey.expiresAt).toBeInstanceOf(Date);
      expect(sessionKey.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    test('should generate different session keys each time', () => {
      const key1 = EncryptionService.generateSessionKey();
      const key2 = EncryptionService.generateSessionKey();

      expect(key1.key).not.toBe(key2.key);
      expect(key1.iv).not.toBe(key2.iv);
    });
  });

  describe('encryptSessionData and decryptSessionData', () => {
    const sessionData = { userId: '123', role: 'admin', permissions: ['read', 'write'] };
    let sessionKey;

    beforeEach(() => {
      sessionKey = EncryptionService.generateSessionKey();
    });

    test('should encrypt and decrypt session data', () => {
      const encrypted = EncryptionService.encryptSessionData(sessionData, sessionKey);
      const decrypted = EncryptionService.decryptSessionData(encrypted, sessionKey);

      expect(typeof encrypted).toBe('string');
      expect(decrypted).toEqual(sessionData);
    });

    test('should throw error with wrong session key', () => {
      const wrongKey = EncryptionService.generateSessionKey();
      const encrypted = EncryptionService.encryptSessionData(sessionData, sessionKey);

      expect(() => {
        EncryptionService.decryptSessionData(encrypted, wrongKey);
      }).toThrow(/decryption failed/i);
    });
  });

  describe('Integration Tests', () => {
    test('should handle large file encryption/decryption', () => {
      const largeData = Buffer.alloc(1024 * 1024, 'A'); // 1MB of 'A's
      const encrypted = EncryptionService.encryptFile(largeData, testKey);
      const decrypted = EncryptionService.decryptFile(encrypted.encryptedData, testKey);

      expect(decrypted.decryptedData.equals(largeData)).toBe(true);
      expect(decrypted.originalSize).toBe(largeData.length);
    });

    test('should handle binary file data', () => {
      const binaryData = crypto.randomBytes(5000);
      const encrypted = EncryptionService.encryptFile(binaryData, testKey);
      const decrypted = EncryptionService.decryptFile(encrypted.encryptedData, testKey);

      expect(decrypted.decryptedData.equals(binaryData)).toBe(true);
    });

    test('should handle multiple encryption/decryption cycles', () => {
      let data = testData;

      for (let i = 0; i < 5; i++) {
        const encrypted = EncryptionService.encryptFile(data, testKey);
        const decrypted = EncryptionService.decryptFile(encrypted.encryptedData, testKey);
        data = decrypted.decryptedData;
      }

      expect(data.equals(testData)).toBe(true);
    });
  });
});