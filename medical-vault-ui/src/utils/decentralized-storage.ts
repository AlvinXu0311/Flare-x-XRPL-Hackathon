// Fully decentralized storage utilities
// No backend required - everything runs client-side

import { create } from 'ipfs-http-client'
import { ethers } from 'ethers'

// Multiple IPFS gateways for redundancy
const IPFS_GATEWAYS = [
  'https://ipfs.io',
  'https://gateway.pinata.cloud',
  'https://cloudflare-ipfs.com',
  'https://dweb.link',
  'https://ipfs.infura.io',
  'https://gateway.ipfs.io'
]

// Multiple IPFS API endpoints
const IPFS_APIS = [
  { host: 'ipfs.infura.io', port: 5001, protocol: 'https' },
  { host: 'api.pinata.cloud', port: 443, protocol: 'https' },
  // Can add more public IPFS nodes
]

class DecentralizedStorage {
  private ipfsClient: any = null
  private currentGateway = 0
  private currentAPI = 0

  /**
   * Initialize IPFS client with fallback options
   */
  async initializeIPFS() {
    // Try each API endpoint until one works
    for (let i = 0; i < IPFS_APIS.length; i++) {
      try {
        const api = IPFS_APIS[this.currentAPI]
        this.ipfsClient = create({
          host: api.host,
          port: api.port,
          protocol: api.protocol,
          timeout: 10000
        })

        // Test connection
        await this.ipfsClient.version()
        console.log(`✅ Connected to IPFS API: ${api.host}`)
        return true

      } catch (error) {
        console.warn(`❌ IPFS API ${IPFS_APIS[this.currentAPI].host} failed:`, error)
        this.currentAPI = (this.currentAPI + 1) % IPFS_APIS.length
      }
    }

    throw new Error('All IPFS API endpoints failed')
  }

  /**
   * Encrypt file client-side before upload
   */
  async encryptFile(file: File, password: string): Promise<ArrayBuffer> {
    const fileBuffer = await file.arrayBuffer()
    const key = await this.deriveKey(password)
    const iv = crypto.getRandomValues(new Uint8Array(12))

    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      fileBuffer
    )

    // Prepend IV to encrypted data
    const result = new Uint8Array(iv.length + encrypted.byteLength)
    result.set(iv)
    result.set(new Uint8Array(encrypted), iv.length)

    return result.buffer
  }

  /**
   * Decrypt file client-side after download
   */
  async decryptFile(encryptedBuffer: ArrayBuffer, password: string): Promise<ArrayBuffer> {
    const key = await this.deriveKey(password)
    const iv = new Uint8Array(encryptedBuffer.slice(0, 12))
    const encrypted = encryptedBuffer.slice(12)

    return await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encrypted
    )
  }

  /**
   * Derive encryption key from password
   */
  private async deriveKey(password: string): Promise<CryptoKey> {
    const encoder = new TextEncoder()
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveKey']
    )

    return await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: encoder.encode('medical-vault-salt'), // In production, use unique salt per file
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    )
  }

  /**
   * Upload encrypted file to IPFS with multiple pinning services
   */
  async uploadFile(file: File, password: string): Promise<{
    cid: string
    filename: string
    size: number
    encryptedSize: number
  }> {
    if (!this.ipfsClient) {
      await this.initializeIPFS()
    }

    // Encrypt file client-side
    const encryptedBuffer = await this.encryptFile(file, password)

    try {
      // Upload to IPFS
      const result = await this.ipfsClient.add(
        new Uint8Array(encryptedBuffer),
        {
          pin: true,
          cidVersion: 1,
          hashAlg: 'sha2-256'
        }
      )

      const cid = result.cid.toString()

      // Pin to multiple services for redundancy
      await this.pinToMultipleServices(cid)

      return {
        cid,
        filename: file.name,
        size: file.size,
        encryptedSize: encryptedBuffer.byteLength
      }

    } catch (error) {
      console.error('IPFS upload failed:', error)
      throw new Error(`Failed to upload to IPFS: ${(error as Error).message}`)
    }
  }

  /**
   * Download and decrypt file from IPFS with gateway fallback
   */
  async downloadFile(cid: string, password: string, originalFilename: string): Promise<Blob> {
    const maxRetries = IPFS_GATEWAYS.length

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const gateway = IPFS_GATEWAYS[this.currentGateway]
        const url = `${gateway}/ipfs/${cid}`

        console.log(`Attempting download from: ${gateway}`)

        const response = await fetch(url, {
          headers: {
            'Accept': 'application/octet-stream'
          }
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        const encryptedBuffer = await response.arrayBuffer()
        const decryptedBuffer = await this.decryptFile(encryptedBuffer, password)

        return new Blob([decryptedBuffer], {
          type: this.getMimeType(originalFilename)
        })

      } catch (error) {
        console.warn(`Gateway ${IPFS_GATEWAYS[this.currentGateway]} failed:`, error)
        this.currentGateway = (this.currentGateway + 1) % IPFS_GATEWAYS.length

        if (attempt === maxRetries - 1) {
          throw new Error('All IPFS gateways failed')
        }
      }
    }

    throw new Error('Download failed after all retries')
  }

  /**
   * Pin file to multiple pinning services for redundancy
   */
  private async pinToMultipleServices(cid: string): Promise<void> {
    const pinningServices = [
      // Add API keys for pinning services in production
      // { name: 'Pinata', pin: () => this.pinToPinata(cid) },
      // { name: 'NFT.Storage', pin: () => this.pinToNFTStorage(cid) },
      // { name: 'Web3.Storage', pin: () => this.pinToWeb3Storage(cid) }
    ]

    // For now, just log - in production, implement actual pinning
    console.log(`📌 File pinned to IPFS network: ${cid}`)

    // TODO: Implement multiple pinning service integrations
    // This ensures files remain available even if some nodes go offline
  }

  /**
   * Get MIME type from filename
   */
  private getMimeType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase()
    const mimeTypes: Record<string, string> = {
      'pdf': 'application/pdf',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'txt': 'text/plain',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'dicom': 'application/dicom'
    }
    return mimeTypes[ext || ''] || 'application/octet-stream'
  }

  /**
   * Check if file is available on IPFS network
   */
  async checkFileAvailability(cid: string): Promise<boolean> {
    for (const gateway of IPFS_GATEWAYS) {
      try {
        const response = await fetch(`${gateway}/ipfs/${cid}`, {
          method: 'HEAD',
          timeout: 5000
        } as any)

        if (response.ok) {
          return true
        }
      } catch (error) {
        // Continue to next gateway
      }
    }
    return false
  }

  /**
   * Get file info from IPFS
   */
  async getFileInfo(cid: string): Promise<{ size: number; available: boolean }> {
    try {
      if (!this.ipfsClient) {
        await this.initializeIPFS()
      }

      const stat = await this.ipfsClient.object.stat(cid)
      return {
        size: stat.CumulativeSize,
        available: true
      }
    } catch (error) {
      return {
        size: 0,
        available: await this.checkFileAvailability(cid)
      }
    }
  }
}

// Export singleton instance
export const decentralizedStorage = new DecentralizedStorage()

// Utility functions for browser-based IPFS
export const createBrowserIPFS = async () => {
  try {
    // Use js-ipfs for fully p2p browser node
    const { create } = await import('ipfs-core')
    return await create({
      repo: 'medical-vault-ipfs',
      config: {
        Addresses: {
          Swarm: [
            '/dns4/wrtc-star1.par.dwebops.pub/tcp/443/wss/p2p-webrtc-star/',
            '/dns4/wrtc-star2.sjc.dwebops.pub/tcp/443/wss/p2p-webrtc-star/'
          ]
        }
      }
    })
  } catch (error) {
    console.warn('Browser IPFS node creation failed:', error)
    return null
  }
}

export default decentralizedStorage