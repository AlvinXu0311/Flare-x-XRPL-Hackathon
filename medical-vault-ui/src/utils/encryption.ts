import CryptoJS from 'crypto-js'
import { ethers } from 'ethers'
import { patientIdExists } from './patient-storage'

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

// Enhanced patient ID generation strategies
export enum IdGenerationStrategy {
  TIMESTAMP_RANDOM = 'timestamp_random',
  UUID_BLOCKCHAIN = 'uuid_blockchain',
  CRYPTO_SEQUENTIAL = 'crypto_sequential',
  HIGH_ENTROPY = 'high_entropy',
  DETERMINISTIC = 'deterministic'
}

export interface IdGenerationOptions {
  strategy?: IdGenerationStrategy
  walletAddress?: string
  collisionCheck?: boolean
  maxRetries?: number
  customEntropy?: string
}

// Generate unique patient ID using timestamp and random data (original method)
export function generateUniquePatientId(): string {
  const timestamp = Date.now().toString()
  const random = ethers.utils.randomBytes(16)
  const combined = `${timestamp}_${ethers.utils.hexlify(random)}`
  return ethers.utils.keccak256(ethers.utils.toUtf8Bytes(combined))
}

// Enhanced patient ID generation with collision detection and multiple strategies
export function generatePatientIdAdvanced(options: IdGenerationOptions = {}): string {
  const {
    strategy = IdGenerationStrategy.TIMESTAMP_RANDOM,
    walletAddress,
    collisionCheck = true,
    maxRetries = 10,
    customEntropy = ''
  } = options

  let attempts = 0
  let patientId: string

  do {
    attempts++

    switch (strategy) {
      case IdGenerationStrategy.UUID_BLOCKCHAIN:
        patientId = generateUuidBlockchainId(customEntropy)
        break

      case IdGenerationStrategy.CRYPTO_SEQUENTIAL:
        patientId = generateCryptoSequentialId(walletAddress, customEntropy)
        break

      case IdGenerationStrategy.HIGH_ENTROPY:
        patientId = generateHighEntropyId(customEntropy)
        break

      case IdGenerationStrategy.DETERMINISTIC:
        patientId = generateDeterministicId(walletAddress, customEntropy)
        break

      case IdGenerationStrategy.TIMESTAMP_RANDOM:
      default:
        patientId = generateTimestampRandomId(customEntropy)
        break
    }

    // Skip collision check if not requested or no wallet provided
    if (!collisionCheck || !walletAddress) {
      break
    }

    // Check for collision in local storage
    if (!patientIdExists(patientId, walletAddress)) {
      break
    }

    console.warn(`Patient ID collision detected (attempt ${attempts}), retrying...`)

    if (attempts >= maxRetries) {
      throw new Error(`Failed to generate unique patient ID after ${maxRetries} attempts`)
    }
  } while (attempts < maxRetries)

  return patientId
}

// Strategy 1: UUID v4 + Blockchain Context
function generateUuidBlockchainId(customEntropy: string = ''): string {
  // Generate UUID v4 equivalent using crypto
  const uuid = ethers.utils.randomBytes(16)
  // Set version and variant bits for UUID v4
  uuid[6] = (uuid[6] & 0x0f) | 0x40 // Version 4
  uuid[8] = (uuid[8] & 0x3f) | 0x80 // Variant bits

  const timestamp = Date.now()
  const blockHint = Math.floor(timestamp / 15000) // Rough 15-second block estimate
  const combined = `uuid_${ethers.utils.hexlify(uuid)}_block_${blockHint}_${customEntropy}`

  return ethers.utils.keccak256(ethers.utils.toUtf8Bytes(combined))
}

// Strategy 2: Crypto Sequential with Node ID
function generateCryptoSequentialId(walletAddress: string = '', customEntropy: string = ''): string {
  const timestamp = Date.now()
  const highPrecisionTime = performance.now()
  const randomSeed = ethers.utils.randomBytes(8)

  // Create a pseudo-sequential component
  const sequential = timestamp + Math.floor(highPrecisionTime * 1000)

  // Add browser/session fingerprint
  const sessionId = getSessionFingerprint()

  const combined = `seq_${sequential}_wallet_${walletAddress}_session_${sessionId}_${ethers.utils.hexlify(randomSeed)}_${customEntropy}`

  return ethers.utils.keccak256(ethers.utils.toUtf8Bytes(combined))
}

// Strategy 3: Maximum Entropy ID
function generateHighEntropyId(customEntropy: string = ''): string {
  const random1 = ethers.utils.randomBytes(32)
  const random2 = ethers.utils.randomBytes(32)
  const timestamp = Date.now()
  const highPrecisionTime = performance.now()
  const nanoTime = timestamp * 1000000 + Math.floor(highPrecisionTime * 1000)

  // Use multiple entropy sources
  const entropy = `entropy_${ethers.utils.hexlify(random1)}_${ethers.utils.hexlify(random2)}_nano_${nanoTime}_custom_${customEntropy}`

  return ethers.utils.keccak256(ethers.utils.toUtf8Bytes(entropy))
}

// Strategy 4: Deterministic but Unique ID
function generateDeterministicId(walletAddress: string = '', customEntropy: string = ''): string {
  const timestamp = Date.now()
  const dateString = new Date(timestamp).toISOString()
  const counter = getAndIncrementCounter()

  const combined = `deterministic_${walletAddress}_${dateString}_counter_${counter}_${customEntropy}`

  return ethers.utils.keccak256(ethers.utils.toUtf8Bytes(combined))
}

// Strategy 5: Enhanced Timestamp + Random (improved original)
function generateTimestampRandomId(customEntropy: string = ''): string {
  const timestamp = Date.now()
  const highPrecisionTime = performance.now()
  const random = ethers.utils.randomBytes(24) // Increased from 16 to 24 bytes

  // Add sub-millisecond precision
  const preciseTime = timestamp + (highPrecisionTime % 1)

  const combined = `enhanced_${preciseTime}_${ethers.utils.hexlify(random)}_${customEntropy}`

  return ethers.utils.keccak256(ethers.utils.toUtf8Bytes(combined))
}

// Helper: Get browser/session fingerprint
function getSessionFingerprint(): string {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.textBaseline = 'top'
    ctx.font = '14px Arial'
    ctx.fillText('Medical Vault Fingerprint', 2, 2)
  }

  const fingerprint = [
    navigator.userAgent,
    navigator.language,
    screen.width + 'x' + screen.height,
    new Date().getTimezoneOffset(),
    canvas.toDataURL(),
    Math.random().toString()
  ].join('|')

  return ethers.utils.keccak256(ethers.utils.toUtf8Bytes(fingerprint)).slice(0, 18)
}

// Helper: Atomic counter for deterministic IDs
function getAndIncrementCounter(): number {
  const COUNTER_KEY = 'medicalVault_idCounter'

  let counter = 1
  try {
    const stored = localStorage.getItem(COUNTER_KEY)
    if (stored) {
      counter = parseInt(stored, 10) + 1
    }
  } catch (error) {
    console.warn('Error accessing counter:', error)
  }

  try {
    localStorage.setItem(COUNTER_KEY, counter.toString())
  } catch (error) {
    console.warn('Error storing counter:', error)
  }

  return counter
}

// Validate patient ID format and strength
export function validatePatientId(patientId: string): { valid: boolean; strength: 'weak' | 'medium' | 'strong'; issues: string[] } {
  const issues: string[] = []

  // Check format
  if (!ethers.utils.isHexString(patientId)) {
    issues.push('Not a valid hex string')
  }

  if (patientId.length !== 66) { // 0x + 64 hex chars
    issues.push('Invalid length (should be 66 characters)')
  }

  // Check for obvious patterns
  const hex = patientId.slice(2) // Remove 0x prefix

  // Check for repeated patterns
  if (/(.{4})\1{3,}/.test(hex)) {
    issues.push('Contains repeated patterns')
  }

  // Check for all zeros or ones
  if (/^0+$/.test(hex) || /^f+$/i.test(hex)) {
    issues.push('Contains only zeros or ones')
  }

  // Check entropy (simplified)
  const uniqueChars = new Set(hex.toLowerCase()).size
  let strength: 'weak' | 'medium' | 'strong' = 'strong'

  if (uniqueChars < 8) {
    strength = 'weak'
    issues.push('Low entropy (few unique characters)')
  } else if (uniqueChars < 12) {
    strength = 'medium'
    issues.push('Medium entropy')
  }

  return {
    valid: issues.length === 0 || (issues.length === 1 && issues[0] === 'Medium entropy'),
    strength,
    issues
  }
}

// Batch generate multiple IDs (for testing uniqueness)
export function generateBatchPatientIds(count: number, options: IdGenerationOptions = {}): string[] {
  const ids: string[] = []
  const seen = new Set<string>()

  for (let i = 0; i < count; i++) {
    let attempts = 0
    let id: string

    do {
      id = generatePatientIdAdvanced(options)
      attempts++

      if (attempts > 10) {
        throw new Error(`Failed to generate unique ID ${i + 1} after 10 attempts`)
      }
    } while (seen.has(id))

    seen.add(id)
    ids.push(id)
  }

  return ids
}

// Alias for backward compatibility
export function generatePatientId(mrn: string, salt: string): string {
  return hashPatientId(mrn, salt)
}

// ========================================
// WALLET-BASED ENCRYPTION FUNCTIONS
// ========================================

/**
 * Generate encryption key from wallet signature
 * Uses a deterministic message that the user signs with their wallet
 */
export async function deriveKeyFromWallet(
  signer: any,
  patientId: string,
  salt: string
): Promise<string> {
  try {
    // Create a deterministic message for signing
    const timestamp = Math.floor(Date.now() / 10000) * 10000 // Round to 10-second intervals for consistency
    const message = `Medical Vault Encryption Key\nPatient ID: ${patientId}\nSalt: ${salt}\nTimestamp: ${timestamp}`

    // Sign the message with the wallet
    const signature = await signer.signMessage(message)

    // Derive encryption key from signature
    const key = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(signature))

    return key
  } catch (error) {
    console.error('Wallet key derivation error:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to derive key from wallet: ${errorMessage}`)
  }
}

/**
 * Encrypt file using wallet-derived key
 */
export async function encryptFileWithWallet(
  fileContent: ArrayBuffer,
  signer: any,
  patientId: string,
  salt: string
): Promise<{encryptedContent: string, metadata: any}> {
  try {
    // Derive key from wallet signature
    const walletKey = await deriveKeyFromWallet(signer, patientId, salt)

    // Convert ArrayBuffer to WordArray
    const wordArray = CryptoJS.lib.WordArray.create(fileContent)

    // Encrypt using the wallet-derived key
    const encrypted = CryptoJS.AES.encrypt(wordArray, walletKey).toString()

    // Create metadata for verification
    const metadata = {
      patientId,
      salt,
      walletAddress: await signer.getAddress(),
      encryptedAt: Date.now(),
      keyDerivationMethod: 'wallet-signature'
    }

    return {
      encryptedContent: encrypted,
      metadata
    }
  } catch (error) {
    throw new Error(`Wallet encryption failed: ${error}`)
  }
}

/**
 * Decrypt file using wallet signature verification
 */
export async function decryptFileWithWallet(
  encryptedContent: string,
  signer: any,
  metadata: any
): Promise<ArrayBuffer> {
  try {
    // Verify wallet address matches
    const currentAddress = await signer.getAddress()
    if (currentAddress.toLowerCase() !== metadata.walletAddress.toLowerCase()) {
      throw new Error('Wallet address mismatch - you are not authorized to decrypt this file')
    }

    // Derive the same key using wallet signature
    const walletKey = await deriveKeyFromWallet(signer, metadata.patientId, metadata.salt)

    // Decrypt
    const decrypted = CryptoJS.AES.decrypt(encryptedContent, walletKey)

    // Convert back to ArrayBuffer
    const typedArray = new Uint8Array(decrypted.sigBytes)
    for (let i = 0; i < decrypted.sigBytes; i++) {
      typedArray[i] = (decrypted.words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff
    }

    return typedArray.buffer
  } catch (error) {
    throw new Error(`Wallet decryption failed: ${error}`)
  }
}

/**
 * Encrypt text using wallet-derived key
 */
export async function encryptTextWithWallet(
  textContent: string,
  signer: any,
  patientId: string,
  salt: string
): Promise<{encryptedContent: string, metadata: any}> {
  try {
    // Derive key from wallet signature
    const walletKey = await deriveKeyFromWallet(signer, patientId, salt)

    // Encrypt using the wallet-derived key
    const encrypted = CryptoJS.AES.encrypt(textContent, walletKey).toString()

    // Create metadata for verification
    const metadata = {
      patientId,
      salt,
      walletAddress: await signer.getAddress(),
      encryptedAt: Date.now(),
      keyDerivationMethod: 'wallet-signature',
      contentType: 'text'
    }

    return {
      encryptedContent: encrypted,
      metadata
    }
  } catch (error) {
    throw new Error(`Wallet text encryption failed: ${error}`)
  }
}

/**
 * Decrypt text using wallet signature verification
 */
export async function decryptTextWithWallet(
  encryptedContent: string | ArrayBuffer,
  signer: any,
  metadata: any
): Promise<string> {
  try {
    // Verify wallet address matches
    const currentAddress = await signer.getAddress()
    if (currentAddress.toLowerCase() !== metadata.walletAddress.toLowerCase()) {
      throw new Error('Wallet address mismatch - you are not authorized to decrypt this content')
    }

    // Derive the same key using wallet signature
    console.log('Decryption - metadata:', metadata)
    const walletKey = await deriveKeyFromWallet(signer, metadata.patientId, metadata.salt)
    console.log('Decryption - derived key length:', walletKey.length)

    // Convert ArrayBuffer to string if needed
    let encryptedString: string
    if (encryptedContent instanceof ArrayBuffer) {
      // Convert ArrayBuffer to base64 string
      const uint8Array = new Uint8Array(encryptedContent)
      encryptedString = btoa(String.fromCharCode(...uint8Array))
      console.log('Converted ArrayBuffer to string, length:', encryptedString.length)
    } else {
      encryptedString = encryptedContent
      console.log('Using string content directly, length:', encryptedString.length)
    }

    console.log('Encrypted string preview:', encryptedString.substring(0, 100) + '...')

    // Decrypt with better error handling
    let decrypted: CryptoJS.lib.WordArray
    try {
      decrypted = CryptoJS.AES.decrypt(encryptedString, walletKey)
      console.log('AES decrypt successful, WordArray sigBytes:', decrypted.sigBytes)
    } catch (decryptError) {
      throw new Error(`AES decryption failed: ${(decryptError as Error).message}`)
    }

    // Convert to UTF-8 with error checking
    let decryptedText: string
    try {
      decryptedText = decrypted.toString(CryptoJS.enc.Utf8)
      console.log('UTF-8 conversion result length:', decryptedText.length)
      console.log('Decrypted text preview:', decryptedText.substring(0, 50) + '...')
    } catch (utf8Error) {
      throw new Error(`UTF-8 conversion failed: ${(utf8Error as Error).message}`)
    }

    if (!decryptedText || decryptedText.length === 0) {
      console.warn('Primary decryption failed, trying fallback methods...')

      // Try fallback: maybe the data was encrypted with a different key derivation
      try {
        // Try with different salt or patient ID combinations
        const fallbackKeys = [
          await deriveKeyFromWallet(signer, metadata.patientId, metadata.salt || ''),
          await deriveKeyFromWallet(signer, metadata.patientId || '', metadata.salt),
          // Try with current wallet address as part of key
          await deriveKeyFromWallet(signer, currentAddress.toLowerCase(), metadata.salt),
          // Try with hardcoded patientId (common in uploads)
          await deriveKeyFromWallet(signer, "0xd976ece7f97402cc704731e8d64e747d1126161565a1208473a9bf64bffc8570", metadata.salt)
        ]

        for (let i = 0; i < fallbackKeys.length; i++) {
          try {
            const fallbackDecrypted = CryptoJS.AES.decrypt(encryptedString, fallbackKeys[i])
            const fallbackText = fallbackDecrypted.toString(CryptoJS.enc.Utf8)
            if (fallbackText && fallbackText.length > 0) {
              console.log(`Fallback method ${i} succeeded!`)
              return fallbackText
            }
          } catch (e) {
            console.log(`Fallback method ${i} failed:`, (e as Error).message)
          }
        }
      } catch (fallbackError) {
        console.error('All fallback methods failed:', fallbackError)
      }

      throw new Error('Decryption result is empty - invalid key or corrupted data')
    }

    return decryptedText
  } catch (error) {
    console.error('Decryption error details:', error)
    throw new Error(`Wallet text decryption failed: ${(error as Error).message}`)
  }
}

/**
 * Generate SHA-256 hash of file content
 */
export async function generateFileHash(fileContent: ArrayBuffer): Promise<string> {
  try {
    // Use Web Crypto API to generate SHA-256 hash
    const hashBuffer = await crypto.subtle.digest('SHA-256', fileContent)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    return `0x${hashHex}`
  } catch (error) {
    throw new Error(`File hash generation failed: ${error}`)
  }
}

/**
 * Generate SHA-256 hash of text content
 */
export async function generateTextHash(textContent: string): Promise<string> {
  try {
    const encoder = new TextEncoder()
    const data = encoder.encode(textContent)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    return `0x${hashHex}`
  } catch (error) {
    throw new Error(`Text hash generation failed: ${error}`)
  }
}

/**
 * Create a content URI with hash for blockchain storage
 */
export function createContentURI(hash: string, contentType: 'file' | 'text', filename?: string): string {
  const metadata = {
    hash,
    type: contentType,
    filename: filename || 'document',
    timestamp: Date.now()
  }

  // Create a simple URI format: hash://metadata
  return `${hash}#${btoa(JSON.stringify(metadata))}`
}

/**
 * Parse content URI to extract hash and metadata
 */
export function parseContentURI(uri: string): { hash: string; metadata: any } {
  try {
    const [hash, encodedMetadata] = uri.split('#')
    const metadata = encodedMetadata ? JSON.parse(atob(encodedMetadata)) : {}
    return { hash, metadata }
  } catch (error) {
    // Fallback for simple hash URIs
    return { hash: uri, metadata: {} }
  }
}

/**
 * Simple wallet verification - sign a challenge message
 */
export async function verifyWalletOwnership(signer: any, expectedAddress: string): Promise<boolean> {
  try {
    const currentAddress = await signer.getAddress()
    const challenge = `Medical Vault Access Verification\nAddress: ${expectedAddress}\nTimestamp: ${Date.now()}`

    // Sign the challenge
    const signature = await signer.signMessage(challenge)

    // Verify the signature
    const recoveredAddress = ethers.utils.verifyMessage(challenge, signature)

    return recoveredAddress.toLowerCase() === expectedAddress.toLowerCase()
  } catch (error) {
    console.error('Wallet verification failed:', error)
    return false
  }
}