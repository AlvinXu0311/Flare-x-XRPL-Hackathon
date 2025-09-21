import { ethers } from 'ethers'

interface RetryConfig {
  maxRetries: number
  baseDelay: number
  maxDelay: number
  backoffFactor: number
}

interface CircuitBreakerConfig {
  failureThreshold: number
  recoveryTimeout: number
  monitoringWindow: number
}

interface ProviderConfig {
  rpcUrls: string[]
  chainId: number
  retry: RetryConfig
  circuitBreaker: CircuitBreakerConfig
}

interface ConnectionHealth {
  isHealthy: boolean
  latency: number
  errorRate: number
  lastChecked: number
}

class RobustWeb3Provider {
  private providers: ethers.providers.JsonRpcProvider[] = []
  private currentProviderIndex = 0
  private circuitBreakerState = new Map<string, {
    isOpen: boolean
    failureCount: number
    lastFailure: number
    successCount: number
  }>()
  private connectionHealth = new Map<string, ConnectionHealth>()
  private config: ProviderConfig
  private fallbackProvider: ethers.providers.Web3Provider | null = null

  constructor(config: ProviderConfig) {
    this.config = config
    this.initializeProviders()
    this.initializeFallbackProvider()
    this.startHealthMonitoring()
  }

  private initializeProviders() {
    this.providers = this.config.rpcUrls.map((url, index) => {
      const provider = new ethers.providers.JsonRpcProvider({
        url,
        timeout: 10000,
        throttleLimit: 10
      }, this.config.chainId)

      // Initialize circuit breaker state
      this.circuitBreakerState.set(url, {
        isOpen: false,
        failureCount: 0,
        lastFailure: 0,
        successCount: 0
      })

      // Initialize health state
      this.connectionHealth.set(url, {
        isHealthy: true,
        latency: 0,
        errorRate: 0,
        lastChecked: Date.now()
      })

      return provider
    })
  }

  private initializeFallbackProvider() {
    try {
      if (window.ethereum) {
        this.fallbackProvider = new ethers.providers.Web3Provider(window.ethereum as any)
        console.log('✅ Fallback provider (MetaMask) initialized')
      }
    } catch (error) {
      console.warn('⚠️ Could not initialize fallback provider:', error)
    }
  }

  private async startHealthMonitoring() {
    setInterval(async () => {
      await this.checkAllProvidersHealth()
    }, 30000) // Check every 30 seconds
  }

  private async checkAllProvidersHealth() {
    for (let i = 0; i < this.providers.length; i++) {
      const url = this.config.rpcUrls[i]
      const provider = this.providers[i]

      try {
        const startTime = Date.now()
        await provider.getBlockNumber()
        const latency = Date.now() - startTime

        const health = this.connectionHealth.get(url)!
        health.isHealthy = true
        health.latency = latency
        health.lastChecked = Date.now()

        // Reset circuit breaker if provider is healthy
        const circuitState = this.circuitBreakerState.get(url)!
        if (circuitState.isOpen && latency < 5000) {
          circuitState.successCount++
          if (circuitState.successCount >= 3) {
            this.resetCircuitBreaker(url)
          }
        }

      } catch (error: any) {
        const health = this.connectionHealth.get(url)!
        health.isHealthy = false
        health.errorRate = Math.min(health.errorRate + 0.1, 1.0)
        health.lastChecked = Date.now()

        // Check if it's a CORS error
        if (error.message?.toLowerCase().includes('cors') ||
            error.message?.toLowerCase().includes('cross-origin') ||
            error.message?.toLowerCase().includes('access-control-allow-origin')) {
          console.warn(`🚫 CORS error detected for ${url}, marking as permanently failed`)
          // Permanently fail CORS-blocked providers
          health.errorRate = 1.0
          const circuitState = this.circuitBreakerState.get(url)!
          circuitState.isOpen = true
          circuitState.failureCount = this.config.circuitBreaker.failureThreshold
        } else {
          this.recordFailure(url)
        }
      }
    }
  }

  private isCircuitOpen(url: string): boolean {
    const state = this.circuitBreakerState.get(url)
    if (!state) return false

    if (state.isOpen) {
      // Check if recovery timeout has passed
      if (Date.now() - state.lastFailure > this.config.circuitBreaker.recoveryTimeout) {
        console.log(`🔄 Circuit breaker recovery attempt for ${url}`)
        state.isOpen = false
        state.successCount = 0
      }
    }

    return state.isOpen
  }

  private recordFailure(url: string) {
    const state = this.circuitBreakerState.get(url)!
    state.failureCount++
    state.lastFailure = Date.now()

    if (state.failureCount >= this.config.circuitBreaker.failureThreshold) {
      console.warn(`⚠️ Circuit breaker opened for ${url}`)
      state.isOpen = true
    }
  }

  private resetCircuitBreaker(url: string) {
    const state = this.circuitBreakerState.get(url)!
    state.isOpen = false
    state.failureCount = 0
    state.successCount = 0
    console.log(`✅ Circuit breaker reset for ${url}`)
  }

  private async getHealthyProvider(): Promise<ethers.providers.JsonRpcProvider | null> {
    // Try current provider first
    const currentUrl = this.config.rpcUrls[this.currentProviderIndex]
    if (!this.isCircuitOpen(currentUrl)) {
      const health = this.connectionHealth.get(currentUrl)
      if (health?.isHealthy) {
        return this.providers[this.currentProviderIndex]
      }
    }

    // Find next healthy provider
    for (let i = 0; i < this.providers.length; i++) {
      const index = (this.currentProviderIndex + 1 + i) % this.providers.length
      const url = this.config.rpcUrls[index]

      if (!this.isCircuitOpen(url)) {
        const health = this.connectionHealth.get(url)
        if (health?.isHealthy) {
          this.currentProviderIndex = index
          console.log(`🔄 Switched to provider: ${url}`)
          return this.providers[index]
        }
      }
    }

    return null
  }

  async executeWithRetry<T>(
    operation: (provider: ethers.providers.BaseProvider) => Promise<T>,
    operationName: string = 'operation'
  ): Promise<T> {
    let lastError: any = null

    for (let attempt = 0; attempt <= this.config.retry.maxRetries; attempt++) {
      try {
        // Try to get a healthy RPC provider
        const provider = await this.getHealthyProvider()

        if (provider) {
          console.log(`🔄 Attempting ${operationName} (attempt ${attempt + 1}/${this.config.retry.maxRetries + 1})`)
          const result = await operation(provider)

          // Record success
          const url = this.config.rpcUrls[this.currentProviderIndex]
          const circuitState = this.circuitBreakerState.get(url)!
          circuitState.successCount++

          console.log(`✅ ${operationName} succeeded`)
          return result
        }

        // If no RPC provider available, try fallback (MetaMask)
        if (this.fallbackProvider && attempt === this.config.retry.maxRetries) {
          console.log(`🔄 Using fallback provider for ${operationName}`)
          return await operation(this.fallbackProvider)
        }

        throw new Error('No healthy providers available')

      } catch (error: any) {
        lastError = error
        console.warn(`❌ ${operationName} attempt ${attempt + 1} failed:`, error.message)

        // Record failure for current provider
        if (this.currentProviderIndex < this.config.rpcUrls.length) {
          const url = this.config.rpcUrls[this.currentProviderIndex]
          this.recordFailure(url)
        }

        // Handle specific error types
        if (this.isRetryableError(error)) {
          if (attempt < this.config.retry.maxRetries) {
            const delay = this.calculateDelay(attempt)
            console.log(`⏳ Retrying ${operationName} in ${delay}ms...`)
            await this.sleep(delay)
            continue
          }
        } else {
          // Non-retryable error, fail immediately
          console.error(`💥 Non-retryable error in ${operationName}:`, error)
          throw error
        }
      }
    }

    // All retries failed
    console.error(`💥 All retries failed for ${operationName}`)
    throw new Error(`${operationName} failed after ${this.config.retry.maxRetries + 1} attempts. Last error: ${lastError?.message || 'Unknown error'}`)
  }

  private isRetryableError(error: any): boolean {
    const retryableErrors = [
      'NETWORK_ERROR',
      'TIMEOUT',
      'SERVER_ERROR',
      'UNPREDICTABLE_GAS_LIMIT',
      'circuit breaker is open',
      'rate limit',
      'too many requests',
      'service unavailable',
      'internal server error',
      'bad gateway',
      'gateway timeout',
      'cors',
      'cross-origin',
      'access-control-allow-origin',
      'net::err_failed'
    ]

    const errorMessage = error.message?.toLowerCase() || ''
    const errorCode = error.code?.toString() || ''

    // Check for CORS errors specifically
    if (errorMessage.includes('cors') ||
        errorMessage.includes('cross-origin') ||
        errorMessage.includes('access-control-allow-origin') ||
        errorMessage.includes('net::err_failed')) {
      console.warn('🚫 CORS error detected, marking provider as failed:', error.message)
      return false // Don't retry CORS errors, just fail the provider
    }

    return retryableErrors.some(retryableError =>
      errorMessage.includes(retryableError) ||
      errorCode.includes(retryableError)
    ) || error.code === -32603 || error.code === 429 || error.code === 502 || error.code === 503
  }

  private calculateDelay(attempt: number): number {
    const delay = this.config.retry.baseDelay * Math.pow(this.config.retry.backoffFactor, attempt)
    const jitter = Math.random() * 0.1 * delay // Add up to 10% jitter
    return Math.min(delay + jitter, this.config.retry.maxDelay)
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  // Public methods for getting providers
  async getProvider(): Promise<ethers.providers.BaseProvider> {
    const provider = await this.getHealthyProvider()
    if (provider) {
      return provider
    }

    if (this.fallbackProvider) {
      console.log('🔄 Using fallback provider')
      return this.fallbackProvider
    }

    throw new Error('No providers available')
  }

  async getSigner(): Promise<ethers.Signer> {
    if (this.fallbackProvider) {
      return this.fallbackProvider.getSigner()
    }

    throw new Error('No signer available (MetaMask not connected)')
  }

  // Health status methods
  getConnectionStatus() {
    const healthyProviders = Array.from(this.connectionHealth.values()).filter(h => h.isHealthy).length
    const openCircuits = Array.from(this.circuitBreakerState.values()).filter(s => s.isOpen).length

    return {
      totalProviders: this.providers.length,
      healthyProviders,
      openCircuits,
      currentProvider: this.config.rpcUrls[this.currentProviderIndex],
      fallbackAvailable: !!this.fallbackProvider,
      overallHealth: healthyProviders > 0 || !!this.fallbackProvider ? 'healthy' : 'degraded'
    }
  }

  getDetailedHealth() {
    const providers = this.config.rpcUrls.map(url => {
      const health = this.connectionHealth.get(url)!
      const circuit = this.circuitBreakerState.get(url)!

      return {
        url,
        isHealthy: health.isHealthy,
        latency: health.latency,
        errorRate: health.errorRate,
        circuitOpen: circuit.isOpen,
        failureCount: circuit.failureCount,
        lastChecked: new Date(health.lastChecked).toISOString()
      }
    })

    return {
      providers,
      currentProviderIndex: this.currentProviderIndex,
      fallbackProvider: this.fallbackProvider ? 'available' : 'unavailable'
    }
  }
}

// Default configuration for Flare network
const defaultFlareConfig: ProviderConfig = {
  rpcUrls: [
    'https://flare-api.flare.network/ext/C/rpc',
    'https://flare.rpc.thirdweb.com',
    'https://rpc.ankr.com/flare',
    // Only keep CORS-enabled endpoints for browser compatibility
    'https://flare.public-rpc.com'
  ],
  chainId: 14, // Flare mainnet
  retry: {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffFactor: 2
  },
  circuitBreaker: {
    failureThreshold: 3,
    recoveryTimeout: 30000, // 30 seconds
    monitoringWindow: 60000  // 1 minute
  }
}

// Default configuration for Flare Coston2 testnet
const defaultCoston2Config: ProviderConfig = {
  rpcUrls: [
    'https://coston2-api.flare.network/ext/C/rpc',
    // Backup RPC endpoints that support CORS
    'https://rpc.ankr.com/flare_coston2'
    // Removed failing endpoint: 'https://flare-testnet.public.blastapi.io'
  ],
  chainId: 114, // Flare Coston2 testnet
  retry: {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffFactor: 2
  },
  circuitBreaker: {
    failureThreshold: 3,
    recoveryTimeout: 30000,
    monitoringWindow: 60000
  }
}

// Export singleton instances
export const flareMainnetProvider = new RobustWeb3Provider(defaultFlareConfig)
export const flareTestnetProvider = new RobustWeb3Provider(defaultCoston2Config)

// Export the class for custom configurations
export { RobustWeb3Provider, type ProviderConfig, type RetryConfig, type CircuitBreakerConfig }

// Helper function to get the appropriate provider
export function getFlareProvider(network: 'mainnet' | 'testnet' = 'testnet'): RobustWeb3Provider {
  return network === 'mainnet' ? flareMainnetProvider : flareTestnetProvider
}