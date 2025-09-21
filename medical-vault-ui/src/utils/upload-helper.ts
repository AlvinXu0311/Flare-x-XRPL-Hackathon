import { ethers } from 'ethers'
import { getFlareProvider } from './robust-web3-provider'

interface UploadContext {
  patientId: string
  docKind: number
  contentURI: string
  contract: ethers.Contract
  maxRetries?: number
}

interface UploadResult {
  receipt: ethers.ContractReceipt
  txHash: string
  blockNumber: number
  gasUsed: ethers.BigNumber
}

export class UploadHelper {
  private static async executeWithCircuitBreakerHandling<T>(
    operation: () => Promise<T>,
    operationName: string,
    maxRetries: number = 3
  ): Promise<T> {
    let lastError: any = null

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 Attempting ${operationName} (attempt ${attempt + 1}/${maxRetries + 1})`)
        const result = await operation()
        console.log(`✅ ${operationName} succeeded`)
        return result
      } catch (error: any) {
        lastError = error
        console.warn(`❌ ${operationName} attempt ${attempt + 1} failed:`, error.message)

        // Check if it's a circuit breaker error
        if (this.isCircuitBreakerError(error)) {
          console.log('🔄 Circuit breaker detected, switching provider...')
          // Wait a bit before retry
          if (attempt < maxRetries) {
            await this.sleep(Math.pow(2, attempt) * 1000) // Exponential backoff
            continue
          }
        } else if (this.isRetryableError(error)) {
          if (attempt < maxRetries) {
            const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000 // Jitter
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
    throw new Error(`${operationName} failed after ${maxRetries + 1} attempts. Last error: ${lastError?.message || 'Unknown error'}`)
  }

  private static isCircuitBreakerError(error: any): boolean {
    const errorMessage = error.message?.toLowerCase() || ''
    const errorCode = error.code?.toString() || ''

    return (
      errorMessage.includes('circuit breaker is open') ||
      errorMessage.includes('execution prevented') ||
      error.code === -32603
    )
  }

  private static isRetryableError(error: any): boolean {
    const retryableErrors = [
      'network error',
      'timeout',
      'server error',
      'rate limit',
      'too many requests',
      'service unavailable',
      'internal server error',
      'bad gateway',
      'gateway timeout',
      'connection refused',
      'failed to fetch'
    ]

    const errorMessage = error.message?.toLowerCase() || ''
    const errorCode = error.code?.toString() || ''

    return retryableErrors.some(retryableError =>
      errorMessage.includes(retryableError) ||
      errorCode.includes(retryableError)
    ) || [429, 502, 503, 504, -32603].includes(error.code)
  }

  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  static async uploadDocumentWithRetry(context: UploadContext): Promise<UploadResult> {
    const { patientId, docKind, contentURI, contract, maxRetries = 3 } = context

    return this.executeWithCircuitBreakerHandling(
      async () => {
        console.log('⛽ Estimating gas for upload...')
        let gasEstimate

        try {
          gasEstimate = await contract.estimateGas.uploadDocumentDeduct(
            patientId,
            docKind,
            contentURI
          )
          console.log('Gas estimate:', gasEstimate.toString())
        } catch (gasError) {
          console.warn('Gas estimation failed, using fallback:', gasError.message)
          gasEstimate = ethers.BigNumber.from('500000') // fallback
        }

        console.log('📝 Submitting transaction...')
        const tx = await contract.uploadDocumentDeduct(
          patientId,
          docKind,
          contentURI,
          {
            gasLimit: gasEstimate.mul(130).div(100), // 30% buffer for safety
            // Add small gas price bump for better inclusion
            gasPrice: undefined // Let the provider determine the best gas price
          }
        )

        console.log('Transaction sent:', tx.hash)
        console.log('⏳ Waiting for confirmation...')

        const receipt = await tx.wait(1) // Wait for 1 confirmation
        console.log('✅ Transaction confirmed!', receipt.transactionHash)

        return {
          receipt,
          txHash: receipt.transactionHash,
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed
        }
      },
      'Upload Document',
      maxRetries
    )
  }

  static async initializeRobustProvider(network: 'mainnet' | 'testnet' = 'testnet') {
    try {
      console.log('🔗 Initializing robust provider...')
      const robustProvider = getFlareProvider(network)

      const provider = await robustProvider.getProvider()
      const signer = await robustProvider.getSigner()

      console.log('✅ Robust provider initialized:', robustProvider.getConnectionStatus())

      return { provider, signer, robustProvider }
    } catch (error) {
      console.warn('⚠️ Robust provider failed, falling back to MetaMask:', error)

      if (!window.ethereum) {
        throw new Error('No Web3 provider available')
      }

      const provider = new ethers.providers.Web3Provider(window.ethereum as any, {
        name: network === 'mainnet' ? 'flare' : 'coston2',
        chainId: network === 'mainnet' ? 14 : 114
      })

      const signer = provider.getSigner()

      console.log('🔄 Using fallback MetaMask provider')
      return { provider, signer, robustProvider: null }
    }
  }

  static async createContractWithRetry(
    contractAddress: string,
    abi: any,
    signer: ethers.Signer
  ): Promise<ethers.Contract> {
    return this.executeWithCircuitBreakerHandling(
      async () => {
        const contract = new ethers.Contract(contractAddress, abi, signer)

        // Test contract connection
        try {
          await contract.provider.getBlockNumber()
        } catch (error) {
          throw new Error(`Contract provider connection failed: ${error.message}`)
        }

        // Verify contract functions exist
        if (!contract.uploadDocumentDeduct) {
          throw new Error('Contract missing required uploadDocumentDeduct function')
        }

        console.log('✅ Contract initialized successfully')
        return contract
      },
      'Initialize Contract',
      2 // Fewer retries for contract initialization
    )
  }

  static getErrorMessage(error: any): string {
    const errorMessage = error.message?.toLowerCase() || ''

    if (error.code === -32603 && errorMessage.includes('circuit breaker')) {
      return 'Network is temporarily overloaded. Please try again in a few moments.'
    }

    if (errorMessage.includes('cors') ||
        errorMessage.includes('cross-origin') ||
        errorMessage.includes('access-control-allow-origin')) {
      return 'Connection issue detected. Using MetaMask as fallback provider.'
    }

    if (error.code === 429) {
      return 'Rate limit exceeded. Please wait before trying again.'
    }

    if (errorMessage.includes('user rejected') || errorMessage.includes('user denied')) {
      return 'Transaction was rejected by user.'
    }

    if (errorMessage.includes('insufficient funds')) {
      return 'Insufficient funds for transaction.'
    }

    if (errorMessage.includes('gas')) {
      return 'Transaction failed due to gas estimation issues. Please try again.'
    }

    if (errorMessage.includes('network') || errorMessage.includes('net::err_failed')) {
      return 'Network connection issue. Please check your internet connection.'
    }

    if (errorMessage.includes('timeout')) {
      return 'Request timed out. Please try again.'
    }

    if (errorMessage.includes('no providers available')) {
      return 'All RPC providers are unavailable. Please check your MetaMask connection.'
    }

    return error.message || 'An unexpected error occurred. Please try again.'
  }
}

export default UploadHelper