interface InsuranceMapping {
  id?: string
  patientId: string
  insuranceProvider: string
  policyNumber: string
  xrplWallet: string
  hospitalId: string
  chargeId?: string
  amount?: number
  status: 'pending' | 'processed' | 'failed' | 'disputed'
  createdAt?: string
  updatedAt?: string
  metadata?: {
    serviceType?: string
    serviceDescription?: string
    hospitalName?: string
    patientMrn?: string
  }
}

interface InsuranceMappingResponse {
  success: boolean
  message?: string
  data?: InsuranceMapping | InsuranceMapping[]
  count?: number
  error?: string
}

interface InsuranceProvider {
  code: string
  name: string
  xrplWalletPrefix: string
  supportedNetworks: string[]
  contactInfo?: {
    phone?: string
    email?: string
    website?: string
  }
}

class InsuranceMappingService {
  private baseUrl: string
  private cache: Map<string, any> = new Map()

  // Predefined insurance providers with their XRPL wallet mappings
  private insuranceProviders: Map<string, InsuranceProvider> = new Map([
    ['aetna', {
      code: 'AETNA',
      name: 'Aetna',
      xrplWalletPrefix: 'rAETNA',
      supportedNetworks: ['mainnet', 'testnet'],
      contactInfo: {
        phone: '1-800-AETNA-1',
        email: 'claims@aetna.com',
        website: 'https://www.aetna.com'
      }
    }],
    ['bluecross', {
      code: 'BCBS',
      name: 'Blue Cross Blue Shield',
      xrplWalletPrefix: 'rBCBS',
      supportedNetworks: ['mainnet', 'testnet'],
      contactInfo: {
        phone: '1-800-BLUE-CROSS',
        email: 'claims@bcbs.com',
        website: 'https://www.bcbs.com'
      }
    }],
    ['cigna', {
      code: 'CIGNA',
      name: 'Cigna',
      xrplWalletPrefix: 'rCIGNA',
      supportedNetworks: ['mainnet', 'testnet'],
      contactInfo: {
        phone: '1-800-CIGNA24',
        email: 'claims@cigna.com',
        website: 'https://www.cigna.com'
      }
    }],
    ['humana', {
      code: 'HUMANA',
      name: 'Humana',
      xrplWalletPrefix: 'rHUMANA',
      supportedNetworks: ['mainnet', 'testnet'],
      contactInfo: {
        phone: '1-800-HUMANA',
        email: 'claims@humana.com',
        website: 'https://www.humana.com'
      }
    }],
    ['united', {
      code: 'UHC',
      name: 'United Healthcare',
      xrplWalletPrefix: 'rUHC',
      supportedNetworks: ['mainnet', 'testnet'],
      contactInfo: {
        phone: '1-800-UNITED',
        email: 'claims@uhc.com',
        website: 'https://www.uhc.com'
      }
    }]
  ])

  constructor(baseUrl: string = 'http://localhost:3002/api') {
    this.baseUrl = baseUrl
    // Expose cache clearing globally for easier access
    window.insuranceMappingCache = this.cache
  }

  clearCache(): void {
    console.log('🧹 Clearing insurance mapping service cache...')
    this.cache.clear()
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

  // NO LONGER GENERATE FAKE ADDRESSES - Use real XRPL wallet connections only
  async getConnectedXrplWallet(): Promise<string | null> {
    try {
      // Import the real XRPL payment service
      const { xrplPaymentService } = await import('./xrpl-payment-service')

      // Get connection status
      const status = await xrplPaymentService.getConnectionStatus()

      if (status.isConnected && status.address) {
        console.log('✅ Real XRPL wallet connected:', status.address)
        return status.address
      } else {
        console.warn('❌ No real XRPL wallet connected')
        return null
      }
    } catch (error) {
      console.error('❌ Failed to get connected XRPL wallet:', error)
      return null
    }
  }

  // Get insurance provider information
  getInsuranceProvider(providerCode: string): InsuranceProvider | null {
    return this.insuranceProviders.get(providerCode.toLowerCase()) || null
  }

  // List all supported insurance providers
  getAllInsuranceProviders(): InsuranceProvider[] {
    return Array.from(this.insuranceProviders.values())
  }

  // Store insurance mapping
  async storeInsuranceMapping(mapping: Omit<InsuranceMapping, 'id' | 'createdAt' | 'updatedAt'>): Promise<InsuranceMapping> {
    console.log('🔄 Storing insurance mapping:', mapping.patientId)

    try {
      const response = await this.request<InsuranceMappingResponse>('/insurance-mappings', {
        method: 'POST',
        body: JSON.stringify(mapping),
      })

      if (!response.success || !response.data) {
        throw new Error(response.message || 'Failed to store insurance mapping')
      }

      console.log('✅ Insurance mapping stored successfully:', response.data)
      return response.data as InsuranceMapping
    } catch (error) {
      console.error('❌ Failed to store insurance mapping:', error)
      throw error
    }
  }

  // Get insurance mappings by patient ID
  async getMappingsByPatient(patientId: string): Promise<InsuranceMapping[]> {
    console.log(`🔄 Fetching insurance mappings for patient: ${patientId}`)

    try {
      const response = await this.request<InsuranceMappingResponse>(
        `/insurance-mappings/patient/${patientId}`
      )

      if (!response.success) {
        throw new Error(response.message || 'Failed to fetch insurance mappings')
      }

      const mappings = (response.data as InsuranceMapping[]) || []
      console.log(`✅ Retrieved ${mappings.length} insurance mappings for patient`)
      return mappings
    } catch (error) {
      console.error('❌ Failed to fetch patient insurance mappings:', error)
      throw error
    }
  }

  // Get insurance mapping by charge ID
  async getMappingByChargeId(chargeId: string): Promise<InsuranceMapping | null> {
    console.log(`🔄 Fetching insurance mapping for charge: ${chargeId}`)

    try {
      const response = await this.request<InsuranceMappingResponse>(`/insurance-mappings/charge/${chargeId}`)

      if (!response.success) {
        if (response.message?.includes('not found')) {
          console.log('ℹ️ Insurance mapping not found for charge ID')
          return null
        }
        throw new Error(response.message || 'Failed to fetch insurance mapping')
      }

      const mapping = response.data as InsuranceMapping
      console.log('✅ Retrieved insurance mapping for charge:', mapping)
      return mapping
    } catch (error) {
      console.error('❌ Failed to fetch insurance mapping by charge ID:', error)
      throw error
    }
  }

  // Get insurance mappings by provider
  async getMappingsByProvider(insuranceProvider: string): Promise<InsuranceMapping[]> {
    console.log(`🔄 Fetching insurance mappings for provider: ${insuranceProvider}`)

    try {
      const response = await this.request<InsuranceMappingResponse>(
        `/insurance-mappings/provider/${insuranceProvider}`
      )

      if (!response.success) {
        throw new Error(response.message || 'Failed to fetch insurance mappings')
      }

      const mappings = (response.data as InsuranceMapping[]) || []
      console.log(`✅ Retrieved ${mappings.length} insurance mappings for provider`)
      return mappings
    } catch (error) {
      console.error('❌ Failed to fetch provider insurance mappings:', error)
      throw error
    }
  }

  // Get insurance mappings by XRPL wallet
  async getMappingByXrplWallet(xrplWallet: string): Promise<InsuranceMapping | null> {
    console.log(`🔄 Fetching insurance mapping for XRPL wallet: ${xrplWallet}`)

    try {
      const response = await this.request<InsuranceMappingResponse>(`/insurance-mappings/wallet/${xrplWallet}`)

      if (!response.success) {
        if (response.message?.includes('not found')) {
          console.log('ℹ️ Insurance mapping not found for XRPL wallet')
          return null
        }
        throw new Error(response.message || 'Failed to fetch insurance mapping')
      }

      const mapping = response.data as InsuranceMapping
      console.log('✅ Retrieved insurance mapping for XRPL wallet:', mapping)
      return mapping
    } catch (error) {
      console.error('❌ Failed to fetch insurance mapping by XRPL wallet:', error)
      throw error
    }
  }

  // Update insurance mapping status
  async updateMappingStatus(chargeId: string, status: InsuranceMapping['status'], metadata?: any): Promise<boolean> {
    console.log(`🔄 Updating insurance mapping status for charge: ${chargeId} to ${status}`)

    try {
      const response = await this.request<InsuranceMappingResponse>(`/insurance-mappings/charge/${chargeId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status, metadata })
      })

      if (!response.success) {
        throw new Error(response.message || 'Failed to update insurance mapping status')
      }

      console.log('✅ Insurance mapping status updated successfully')
      return true
    } catch (error) {
      console.error('❌ Failed to update insurance mapping status:', error)
      throw error
    }
  }

  // Delete insurance mapping
  async deleteMappingByChargeId(chargeId: string): Promise<boolean> {
    console.log(`🗑️ Deleting insurance mapping for charge: ${chargeId}`)

    try {
      const response = await this.request<InsuranceMappingResponse>(`/insurance-mappings/charge/${chargeId}`, {
        method: 'DELETE'
      })

      if (!response.success) {
        if (response.message?.includes('not found')) {
          console.log('ℹ️ Insurance mapping not found for deletion')
          return false
        }
        throw new Error(response.message || 'Failed to delete insurance mapping')
      }

      console.log('✅ Insurance mapping deleted successfully')
      return true
    } catch (error) {
      console.error('❌ Failed to delete insurance mapping:', error)
      throw error
    }
  }

  // Validate XRPL wallet format
  validateXrplWallet(wallet: string): boolean {
    // Basic XRPL address validation
    const xrplRegex = /^r[1-9A-HJ-NP-Za-km-z]{25,34}$/
    return xrplRegex.test(wallet)
  }

  // Create XRPL payment memo for insurance charges
  createPaymentMemo(chargeId: string, patientId: string, serviceType: string): string {
    const memo = {
      type: 'insurance_charge',
      chargeId,
      patientId: patientId.substring(0, 8), // Partial for privacy
      serviceType,
      timestamp: Date.now()
    }
    return JSON.stringify(memo)
  }

  // Parse XRPL payment memo
  parsePaymentMemo(memo: string): any {
    try {
      return JSON.parse(memo)
    } catch (error) {
      console.error('Failed to parse payment memo:', error)
      return null
    }
  }

  // Health check for insurance mapping service
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.request<{ success: boolean }>('/insurance-mappings/health')
      return response.success
    } catch (error) {
      console.error('❌ Insurance mapping service health check failed:', error)
      return false
    }
  }

  // Helper method to create device/session info for audit trails
  createSessionInfo(): { sessionId: string; userAgent: string; timestamp: number } {
    return {
      sessionId: this.generateSessionId(),
      userAgent: navigator.userAgent,
      timestamp: Date.now()
    }
  }

  // Generate a simple hash for deterministic wallet generation
  private hashString(input: string): string {
    let hash = 0
    if (input.length === 0) return hash.toString(36)

    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }

    return Math.abs(hash).toString(36).toUpperCase()
  }

  private generateSessionId(): string {
    return `ins_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
  }

  // Estimate insurance coverage based on service type (mock implementation)
  estimateInsuranceCoverage(
    insuranceProvider: string,
    serviceType: string,
    chargeAmount: number
  ): { covered: number; deductible: number; copay: number; patientResponsibility: number } {
    const provider = this.getInsuranceProvider(insuranceProvider)

    // Mock coverage calculations (in real implementation, this would call insurance APIs)
    const coverageRates: Record<string, number> = {
      'consultation': 0.8,      // 80% coverage
      'diagnosis': 0.85,        // 85% coverage
      'treatment': 0.75,        // 75% coverage
      'emergency': 0.9,         // 90% coverage
      'procedure': 0.7          // 70% coverage
    }

    const coverageRate = coverageRates[serviceType] || 0.7
    const covered = chargeAmount * coverageRate
    const deductible = 50 // Mock deductible
    const copay = 25 // Mock copay
    const patientResponsibility = chargeAmount - covered + deductible + copay

    return {
      covered: Math.round(covered * 100) / 100,
      deductible,
      copay,
      patientResponsibility: Math.round(patientResponsibility * 100) / 100
    }
  }
}

// Export singleton instance
export const insuranceMappingService = new InsuranceMappingService()
export type { InsuranceMapping, InsuranceMappingResponse, InsuranceProvider }

// Extend window object for global cache access
declare global {
  interface Window {
    insuranceMappingCache?: Map<string, any>
  }
}