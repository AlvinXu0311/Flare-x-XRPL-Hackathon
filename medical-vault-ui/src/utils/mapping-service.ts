interface DocumentMapping {
  id?: string
  txHash: string
  walletAddress: string
  contentHash: string
  fileName: string
  fileSize: number
  contentType: string
  patientId: string
  docType: number
  blockNumber: number
  gasUsed: string
  version?: number
  isAvailableLocally?: boolean
  localFileId: string
  encryptionMethod?: string
  contentURI: string
  uploadDate?: string
  lastAccessed?: string
  deviceInfo?: {
    userAgent?: string
    deviceId?: string
  }
}

interface MappingResponse {
  success: boolean
  message?: string
  data?: DocumentMapping | DocumentMapping[]
  count?: number
  error?: string
}

class MappingService {
  private baseUrl: string

  constructor(baseUrl: string = 'http://localhost:3002/api') {
    this.baseUrl = baseUrl
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`

    const defaultOptions: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    }

    const response = await fetch(url, { ...defaultOptions, ...options })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Network error' }))
      throw new Error(errorData.message || `HTTP ${response.status}`)
    }

    return response.json()
  }

  async storeMapping(mapping: Omit<DocumentMapping, 'id' | 'uploadDate' | 'lastAccessed'>): Promise<DocumentMapping> {
    console.log('🔄 Storing mapping to database:', mapping.txHash)

    try {
      const response = await this.request<MappingResponse>('/mappings', {
        method: 'POST',
        body: JSON.stringify(mapping),
      })

      if (!response.success || !response.data) {
        throw new Error(response.message || 'Failed to store mapping')
      }

      console.log('✅ Mapping stored successfully:', response.data)
      return response.data as DocumentMapping
    } catch (error) {
      console.error('❌ Failed to store mapping:', error)
      throw error
    }
  }

  async getMappingsByWallet(walletAddress: string, limit: number = 20, offset: number = 0): Promise<DocumentMapping[]> {
    console.log(`🔄 Fetching mappings for wallet: ${walletAddress}`)

    try {
      const response = await this.request<MappingResponse>(
        `/mappings/wallet/${walletAddress}?limit=${limit}&offset=${offset}`
      )

      if (!response.success) {
        throw new Error(response.message || 'Failed to fetch mappings')
      }

      const mappings = (response.data as DocumentMapping[]) || []
      console.log(`✅ Retrieved ${mappings.length} mappings for wallet`)
      return mappings
    } catch (error) {
      console.error('❌ Failed to fetch wallet mappings:', error)
      throw error
    }
  }

  async getMappingByTxHash(txHash: string): Promise<DocumentMapping | null> {
    console.log(`🔄 Fetching mapping for transaction: ${txHash}`)

    try {
      const response = await this.request<MappingResponse>(`/mappings/tx/${txHash}`)

      if (!response.success) {
        if (response.message?.includes('not found')) {
          console.log('ℹ️ Mapping not found for transaction hash')
          return null
        }
        throw new Error(response.message || 'Failed to fetch mapping')
      }

      const mapping = response.data as DocumentMapping
      console.log('✅ Retrieved mapping for transaction:', mapping)
      return mapping
    } catch (error) {
      console.error('❌ Failed to fetch mapping by tx hash:', error)
      throw error
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.request<{ success: boolean }>('/health')
      return response.success
    } catch (error) {
      console.error('❌ Mapping service health check failed:', error)
      return false
    }
  }

  // Helper method to create device info
  createDeviceInfo(): { userAgent: string; deviceId: string } {
    return {
      userAgent: navigator.userAgent,
      deviceId: this.generateDeviceId()
    }
  }

  private generateDeviceId(): string {
    // Try to get existing device ID from localStorage
    let deviceId = localStorage.getItem('deviceId')

    if (!deviceId) {
      // Generate a new device ID
      deviceId = `device_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
      localStorage.setItem('deviceId', deviceId)
    }

    return deviceId
  }
}

// Export singleton instance
export const mappingService = new MappingService()
export type { DocumentMapping, MappingResponse }