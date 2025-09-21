/**
 * Local File Storage Utility
 * Uses IndexedDB to store encrypted files locally for later download
 */

interface StoredFile {
  id: string
  filename: string
  contentType: string
  encryptedContent: ArrayBuffer | string
  metadata: any
  uploadDate: string
  fileSize: number
  contentHash: string
  txHash: string
}

class LocalFileStorage {
  private dbName = 'MedicalVaultFiles'
  private version = 1
  private storeName = 'files'

  // Initialize IndexedDB
  private async initDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // Create files store if it doesn't exist
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'id' })
          store.createIndex('txHash', 'txHash', { unique: false })
          store.createIndex('contentHash', 'contentHash', { unique: false })
          store.createIndex('uploadDate', 'uploadDate', { unique: false })
        }
      }
    })
  }

  // Store file locally
  async storeFile(file: StoredFile): Promise<void> {
    const db = await this.initDB()
    const transaction = db.transaction([this.storeName], 'readwrite')
    const store = transaction.objectStore(this.storeName)

    return new Promise((resolve, reject) => {
      const request = store.put(file)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  // Get file by ID
  async getFile(id: string): Promise<StoredFile | null> {
    const db = await this.initDB()
    const transaction = db.transaction([this.storeName], 'readonly')
    const store = transaction.objectStore(this.storeName)

    return new Promise((resolve, reject) => {
      const request = store.get(id)
      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(request.error)
    })
  }

  // Get file by transaction hash
  async getFileByTxHash(txHash: string): Promise<StoredFile | null> {
    const db = await this.initDB()
    const transaction = db.transaction([this.storeName], 'readonly')
    const store = transaction.objectStore(this.storeName)
    const index = store.index('txHash')

    return new Promise((resolve, reject) => {
      const request = index.get(txHash)
      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(request.error)
    })
  }

  // Get all files for a wallet
  async getAllFiles(): Promise<StoredFile[]> {
    const db = await this.initDB()
    const transaction = db.transaction([this.storeName], 'readonly')
    const store = transaction.objectStore(this.storeName)

    return new Promise((resolve, reject) => {
      const request = store.getAll()
      request.onsuccess = () => resolve(request.result || [])
      request.onerror = () => reject(request.error)
    })
  }

  // Delete file
  async deleteFile(id: string): Promise<void> {
    const db = await this.initDB()
    const transaction = db.transaction([this.storeName], 'readwrite')
    const store = transaction.objectStore(this.storeName)

    return new Promise((resolve, reject) => {
      const request = store.delete(id)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  // Get storage usage info
  async getStorageInfo(): Promise<{ usage: number; quota: number; fileCount: number }> {
    try {
      const estimate = await navigator.storage.estimate()
      const files = await this.getAllFiles()

      return {
        usage: estimate.usage || 0,
        quota: estimate.quota || 0,
        fileCount: files.length
      }
    } catch (error) {
      console.error('Error getting storage info:', error)
      return { usage: 0, quota: 0, fileCount: 0 }
    }
  }

  // Clear all files (for testing/cleanup)
  async clearAllFiles(): Promise<void> {
    const db = await this.initDB()
    const transaction = db.transaction([this.storeName], 'readwrite')
    const store = transaction.objectStore(this.storeName)

    return new Promise((resolve, reject) => {
      const request = store.clear()
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }
}

// Create singleton instance
export const localFileStorage = new LocalFileStorage()

// Helper functions for easy use
export async function storeEncryptedFile(
  filename: string,
  contentType: string,
  encryptedContent: ArrayBuffer | string,
  metadata: any,
  contentHash: string,
  txHash: string
): Promise<string> {
  const fileId = `${txHash}_${Date.now()}`
  const fileSize = encryptedContent instanceof ArrayBuffer
    ? encryptedContent.byteLength
    : new Blob([encryptedContent]).size

  const storedFile: StoredFile = {
    id: fileId,
    filename,
    contentType,
    encryptedContent,
    metadata,
    uploadDate: new Date().toISOString(),
    fileSize,
    contentHash,
    txHash
  }

  await localFileStorage.storeFile(storedFile)
  return fileId
}

export async function getStoredFile(fileId: string): Promise<StoredFile | null> {
  return await localFileStorage.getFile(fileId)
}

export async function getStoredFileByTxHash(txHash: string): Promise<StoredFile | null> {
  return await localFileStorage.getFileByTxHash(txHash)
}

export async function getAllStoredFiles(): Promise<StoredFile[]> {
  return await localFileStorage.getAllFiles()
}

export async function deleteStoredFile(fileId: string): Promise<void> {
  return await localFileStorage.deleteFile(fileId)
}

export async function getLocalStorageInfo() {
  return await localFileStorage.getStorageInfo()
}

// Utility to convert ArrayBuffer to Blob for download
export function createDownloadBlob(encryptedContent: ArrayBuffer | string, contentType: string): Blob {
  if (encryptedContent instanceof ArrayBuffer) {
    return new Blob([encryptedContent], { type: contentType })
  } else {
    return new Blob([encryptedContent], { type: 'text/plain' })
  }
}

// Format file size for display
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export type { StoredFile }