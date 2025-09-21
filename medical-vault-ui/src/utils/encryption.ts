import CryptoJS from 'crypto-js'
import { ethers } from 'ethers'

// Encryption key derivation from password and salt
export function deriveKey(password: string, salt: string): string {
  return CryptoJS.PBKDF2(password, salt, {
    keySize: 256 / 32,
    iterations: 10000
  }).toString()
}

// Encrypt file content
export function encryptFile(fileContent: ArrayBuffer, password: string, salt: string): string {
  try {
    const key = deriveKey(password, salt)

    // Convert ArrayBuffer to WordArray
    const wordArray = CryptoJS.lib.WordArray.create(fileContent)

    // Encrypt
    const encrypted = CryptoJS.AES.encrypt(wordArray, key).toString()

    return encrypted
  } catch (error) {
    throw new Error(`Encryption failed: ${error}`)
  }
}

// Decrypt file content
export function decryptFile(encryptedContent: string, password: string, salt: string): ArrayBuffer {
  try {
    const key = deriveKey(password, salt)

    // Decrypt
    const decrypted = CryptoJS.AES.decrypt(encryptedContent, key)

    // Convert back to ArrayBuffer
    const typedArray = new Uint8Array(decrypted.sigBytes)
    for (let i = 0; i < decrypted.sigBytes; i++) {
      typedArray[i] = (decrypted.words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff
    }

    return typedArray.buffer
  } catch (error) {
    throw new Error(`Decryption failed: ${error}`)
  }
}

// Encrypt text/JSON
export function encryptText(text: string, password: string, salt: string): string {
  try {
    const key = deriveKey(password, salt)
    return CryptoJS.AES.encrypt(text, key).toString()
  } catch (error) {
    throw new Error(`Text encryption failed: ${error}`)
  }
}

// Decrypt text/JSON
export function decryptText(encryptedText: string, password: string, salt: string): string {
  try {
    const key = deriveKey(password, salt)
    const bytes = CryptoJS.AES.decrypt(encryptedText, key)
    return bytes.toString(CryptoJS.enc.Utf8)
  } catch (error) {
    throw new Error(`Text decryption failed: ${error}`)
  }
}

// Generate secure random salt
export function generateSalt(): string {
  return CryptoJS.lib.WordArray.random(256 / 8).toString()
}

// Hash function for patient ID generation
export function hashPatientId(mrn: string, salt: string): string {
  return ethers.utils.keccak256(ethers.utils.toUtf8Bytes(`${mrn}|${salt}`))
}

// Generate unique patient ID using timestamp and random data
export function generateUniquePatientId(): string {
  const timestamp = Date.now().toString()
  const random = ethers.utils.randomBytes(16)
  const combined = `${timestamp}_${ethers.utils.hexlify(random)}`
  return ethers.utils.keccak256(ethers.utils.toUtf8Bytes(combined))
}

// Alias for backward compatibility
export function generatePatientId(mrn: string, salt: string): string {
  return hashPatientId(mrn, salt)
}