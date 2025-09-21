import { ethers } from 'ethers'

/**
 * Simplified Web3 provider that focuses on reliable, CORS-enabled endpoints
 * with smart fallback to MetaMask when RPC endpoints fail.
 */
class SimpleWeb3Provider {
  private static instance: SimpleWeb3Provider | null = null
  private primaryProvider: ethers.providers.JsonRpcProvider | null = null
  private fallbackProvider: ethers.providers.Web3Provider | null = null
  private currentNetwork: 'mainnet' | 'testnet' = 'testnet'

  private constructor() {
    this.initializeProviders()
  }

  static getInstance(): SimpleWeb3Provider {
    if (!SimpleWeb3Provider.instance) {
      SimpleWeb3Provider.instance = new SimpleWeb3Provider()
    }
    return SimpleWeb3Provider.instance
  }

  private initializeProviders() {
    try {
      // Primary RPC provider (official Flare endpoint)
      this.primaryProvider = new ethers.providers.JsonRpcProvider(
        this.currentNetwork === 'mainnet'
          ? 'https://flare-api.flare.network/ext/C/rpc'
          : 'https://coston2-api.flare.network/ext/C/rpc',
        {
          name: this.currentNetwork === 'mainnet' ? 'flare' : 'coston2',
          chainId: this.currentNetwork === 'mainnet' ? 14 : 114
        }
      )

      // Configure timeout and throttling
      this.primaryProvider.pollingInterval = 10000 // 10 seconds
      ;(this.primaryProvider as any).timeout = 15000 // 15 second timeout

    } catch (error) {
      console.warn('Failed to initialize primary provider:', error)
    }

    try {
      // Fallback MetaMask provider
      if (window.ethereum) {
        this.fallbackProvider = new ethers.providers.Web3Provider(window.ethereum as any, {
          name: this.currentNetwork === 'mainnet' ? 'flare' : 'coston2',
          chainId: this.currentNetwork === 'mainnet' ? 14 : 114
        })
      }
    } catch (error) {
      console.warn('Failed to initialize fallback provider:', error)
    }
  }

  async getProvider(): Promise<ethers.providers.BaseProvider> {
    // Try primary provider first
    if (this.primaryProvider) {
      try {
        // Quick health check
        await Promise.race([
          this.primaryProvider.getBlockNumber(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
        ])
        console.log('✅ Using primary RPC provider')
        return this.primaryProvider
      } catch (error: any) {
        console.warn('⚠️ Primary provider failed:', error.message)
      }
    }

    // Fall back to MetaMask
    if (this.fallbackProvider) {
      console.log('🔄 Using MetaMask fallback provider')
      return this.fallbackProvider
    }

    throw new Error('No Web3 providers available')
  }

  async getSigner(): Promise<ethers.Signer> {
    if (this.fallbackProvider) {
      return this.fallbackProvider.getSigner()
    }

    throw new Error('No signer available (MetaMask not connected)')
  }

  async executeWithRetry<T>(
    operation: (provider: ethers.providers.BaseProvider) => Promise<T>,
    operationName: string = 'operation',
    maxRetries: number = 2
  ): Promise<T> {
    let lastError: any = null

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const provider = await this.getProvider()
        console.log(`🔄 Attempting ${operationName} (attempt ${attempt + 1}/${maxRetries + 1})`)

        const result = await operation(provider)
        console.log(`✅ ${operationName} succeeded`)
        return result

      } catch (error: any) {
        lastError = error
        console.warn(`❌ ${operationName} attempt ${attempt + 1} failed:`, error.message)

        if (attempt < maxRetries) {
          // Simple delay between retries
          const delay = 1000 * (attempt + 1)
          console.log(`⏳ Retrying ${operationName} in ${delay}ms...`)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }

    throw new Error(`${operationName} failed after ${maxRetries + 1} attempts. Last error: ${lastError?.message || 'Unknown error'}`)
  }

  setNetwork(network: 'mainnet' | 'testnet') {
    if (this.currentNetwork !== network) {
      this.currentNetwork = network
      this.initializeProviders()
    }
  }

  getStatus() {
    return {
      primaryProvider: !!this.primaryProvider,
      fallbackProvider: !!this.fallbackProvider,
      network: this.currentNetwork,
      hasWallet: !!window.ethereum
    }
  }

  // Test connection to both providers
  async testConnection(): Promise<{
    primary: { available: boolean; latency?: number; error?: string }
    fallback: { available: boolean; latency?: number; error?: string }
  }> {
    const result = {
      primary: { available: false, latency: undefined, error: undefined },
      fallback: { available: false, latency: undefined, error: undefined }
    }

    // Test primary provider
    if (this.primaryProvider) {
      try {
        const startTime = Date.now()
        await this.primaryProvider.getBlockNumber()
        result.primary.available = true
        result.primary.latency = Date.now() - startTime
      } catch (error: any) {
        result.primary.error = error.message
      }
    }

    // Test fallback provider
    if (this.fallbackProvider) {
      try {
        const startTime = Date.now()
        await this.fallbackProvider.getBlockNumber()
        result.fallback.available = true
        result.fallback.latency = Date.now() - startTime
      } catch (error: any) {
        result.fallback.error = error.message
      }
    }

    return result
  }
}

// Helper functions for easy use
export async function getSimpleProvider(): Promise<ethers.providers.BaseProvider> {
  const provider = SimpleWeb3Provider.getInstance()
  return provider.getProvider()
}

export async function getSimpleSigner(): Promise<ethers.Signer> {
  const provider = SimpleWeb3Provider.getInstance()
  return provider.getSigner()
}

export function setSimpleProviderNetwork(network: 'mainnet' | 'testnet') {
  const provider = SimpleWeb3Provider.getInstance()
  provider.setNetwork(network)
}

export async function executeWithSimpleRetry<T>(
  operation: (provider: ethers.providers.BaseProvider) => Promise<T>,
  operationName?: string
): Promise<T> {
  const provider = SimpleWeb3Provider.getInstance()
  return provider.executeWithRetry(operation, operationName)
}

export async function testSimpleConnection() {
  const provider = SimpleWeb3Provider.getInstance()
  return provider.testConnection()
}

export function getSimpleProviderStatus() {
  const provider = SimpleWeb3Provider.getInstance()
  return provider.getStatus()
}

// Export the class for advanced usage
export { SimpleWeb3Provider }