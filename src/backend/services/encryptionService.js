const crypto = require('crypto');

class EncryptionService {
  constructor() {
    this.algorithm = 'aes-256-gcm';
    this.keyLength = 32;
    this.ivLength = 16;
    this.tagLength = 16;
    this.saltLength = 32;
  }

  generateEncryptionKey() {
    return crypto.randomBytes(this.keyLength);
  }

  generateFileHash(buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  encryptFile(fileBuffer, encryptionKey = null) {
    try {
      if (!encryptionKey) {
        encryptionKey = this.generateEncryptionKey();
      }

      const iv = crypto.randomBytes(this.ivLength);
      const cipher = crypto.createCipheriv(this.algorithm, encryptionKey, iv);

      let encrypted = cipher.update(fileBuffer);
      encrypted = Buffer.concat([encrypted, cipher.final()]);

      const tag = cipher.getAuthTag();

      const result = {
        encryptedData: Buffer.concat([iv, tag, encrypted]),
        encryptionKey: encryptionKey.toString('hex'),
        iv: iv.toString('hex'),
        tag: tag.toString('hex'),
        algorithm: this.algorithm,
        originalSize: fileBuffer.length,
        encryptedSize: encrypted.length + iv.length + tag.length
      };

      return result;
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error(`File encryption failed: ${error.message}`);
    }
  }

  decryptFile(encryptedBuffer, encryptionKey) {
    try {
      if (typeof encryptionKey === 'string') {
        encryptionKey = Buffer.from(encryptionKey, 'hex');
      }

      const iv = encryptedBuffer.slice(0, this.ivLength);
      const tag = encryptedBuffer.slice(this.ivLength, this.ivLength + this.tagLength);
      const encrypted = encryptedBuffer.slice(this.ivLength + this.tagLength);

      const decipher = crypto.createDecipheriv(this.algorithm, encryptionKey, iv);
      decipher.setAuthTag(tag);

      let decrypted = decipher.update(encrypted);
      decrypted = Buffer.concat([decrypted, decipher.final()]);

      return {
        decryptedData: decrypted,
        originalSize: decrypted.length
      };
    } catch (error) {
      console.error('Decryption error:', error);
      throw new Error(`File decryption failed: ${error.message}`);
    }
  }

  encryptPatientData(patientInfo, encryptionKey = null) {
    try {
      if (!encryptionKey) {
        encryptionKey = this.generateEncryptionKey();
      }

      const dataString = JSON.stringify(patientInfo);
      const dataBuffer = Buffer.from(dataString, 'utf8');

      const iv = crypto.randomBytes(this.ivLength);
      const cipher = crypto.createCipheriv(this.algorithm, encryptionKey, iv);

      let encrypted = cipher.update(dataBuffer);
      encrypted = Buffer.concat([encrypted, cipher.final()]);

      const tag = cipher.getAuthTag();

      return {
        encryptedData: Buffer.concat([iv, tag, encrypted]).toString('base64'),
        encryptionKey: encryptionKey.toString('hex'),
        iv: iv.toString('hex'),
        tag: tag.toString('hex')
      };
    } catch (error) {
      console.error('Patient data encryption error:', error);
      throw new Error(`Patient data encryption failed: ${error.message}`);
    }
  }

  decryptPatientData(encryptedData, encryptionKey) {
    try {
      if (typeof encryptionKey === 'string') {
        encryptionKey = Buffer.from(encryptionKey, 'hex');
      }

      const encryptedBuffer = Buffer.from(encryptedData, 'base64');

      const iv = encryptedBuffer.slice(0, this.ivLength);
      const tag = encryptedBuffer.slice(this.ivLength, this.ivLength + this.tagLength);
      const encrypted = encryptedBuffer.slice(this.ivLength + this.tagLength);

      const decipher = crypto.createDecipheriv(this.algorithm, encryptionKey, iv);
      decipher.setAuthTag(tag);

      let decrypted = decipher.update(encrypted);
      decrypted = Buffer.concat([decrypted, decipher.final()]);

      const dataString = decrypted.toString('utf8');
      return JSON.parse(dataString);
    } catch (error) {
      console.error('Patient data decryption error:', error);
      throw new Error(`Patient data decryption failed: ${error.message}`);
    }
  }

  generatePasswordHash(password, salt = null) {
    try {
      if (!salt) {
        salt = crypto.randomBytes(this.saltLength);
      } else if (typeof salt === 'string') {
        salt = Buffer.from(salt, 'hex');
      }

      const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha256');

      return {
        hash: hash.toString('hex'),
        salt: salt.toString('hex')
      };
    } catch (error) {
      console.error('Password hashing error:', error);
      throw new Error(`Password hashing failed: ${error.message}`);
    }
  }

  verifyPassword(password, hash, salt) {
    try {
      const result = this.generatePasswordHash(password, salt);
      return result.hash === hash;
    } catch (error) {
      console.error('Password verification error:', error);
      return false;
    }
  }

  generateSecureToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  generateHMAC(data, secret) {
    try {
      const hmac = crypto.createHmac('sha256', secret);
      hmac.update(JSON.stringify(data));
      return hmac.digest('hex');
    } catch (error) {
      console.error('HMAC generation error:', error);
      throw new Error(`HMAC generation failed: ${error.message}`);
    }
  }

  verifyHMAC(data, signature, secret) {
    try {
      const expectedSignature = this.generateHMAC(data, secret);
      return crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );
    } catch (error) {
      console.error('HMAC verification error:', error);
      return false;
    }
  }

  encryptWithPublicKey(data, publicKey) {
    try {
      const buffer = Buffer.from(JSON.stringify(data), 'utf8');
      const encrypted = crypto.publicEncrypt(publicKey, buffer);
      return encrypted.toString('base64');
    } catch (error) {
      console.error('Public key encryption error:', error);
      throw new Error(`Public key encryption failed: ${error.message}`);
    }
  }

  decryptWithPrivateKey(encryptedData, privateKey) {
    try {
      const buffer = Buffer.from(encryptedData, 'base64');
      const decrypted = crypto.privateDecrypt(privateKey, buffer);
      return JSON.parse(decrypted.toString('utf8'));
    } catch (error) {
      console.error('Private key decryption error:', error);
      throw new Error(`Private key decryption failed: ${error.message}`);
    }
  }

  generateKeyPair() {
    try {
      const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: {
          type: 'spki',
          format: 'pem'
        },
        privateKeyEncoding: {
          type: 'pkcs8',
          format: 'pem'
        }
      });

      return { publicKey, privateKey };
    } catch (error) {
      console.error('Key pair generation error:', error);
      throw new Error(`Key pair generation failed: ${error.message}`);
    }
  }

  createDigitalSignature(data, privateKey) {
    try {
      const dataString = typeof data === 'string' ? data : JSON.stringify(data);
      const sign = crypto.createSign('SHA256');
      sign.update(dataString);
      sign.end();

      const signature = sign.sign(privateKey, 'base64');
      return signature;
    } catch (error) {
      console.error('Digital signature error:', error);
      throw new Error(`Digital signature creation failed: ${error.message}`);
    }
  }

  verifyDigitalSignature(data, signature, publicKey) {
    try {
      const dataString = typeof data === 'string' ? data : JSON.stringify(data);
      const verify = crypto.createVerify('SHA256');
      verify.update(dataString);
      verify.end();

      return verify.verify(publicKey, signature, 'base64');
    } catch (error) {
      console.error('Digital signature verification error:', error);
      return false;
    }
  }

  generateSessionKey() {
    return {
      key: crypto.randomBytes(32).toString('hex'),
      iv: crypto.randomBytes(16).toString('hex'),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000)
    };
  }

  encryptSessionData(sessionData, sessionKey) {
    try {
      const key = Buffer.from(sessionKey.key, 'hex');
      const iv = Buffer.from(sessionKey.iv, 'hex');

      const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);

      let encrypted = cipher.update(JSON.stringify(sessionData), 'utf8', 'hex');
      encrypted += cipher.final('hex');

      return encrypted;
    } catch (error) {
      console.error('Session encryption error:', error);
      throw new Error(`Session encryption failed: ${error.message}`);
    }
  }

  decryptSessionData(encryptedSessionData, sessionKey) {
    try {
      const key = Buffer.from(sessionKey.key, 'hex');
      const iv = Buffer.from(sessionKey.iv, 'hex');

      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);

      let decrypted = decipher.update(encryptedSessionData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return JSON.parse(decrypted);
    } catch (error) {
      console.error('Session decryption error:', error);
      throw new Error(`Session decryption failed: ${error.message}`);
    }
  }
}

module.exports = new EncryptionService();