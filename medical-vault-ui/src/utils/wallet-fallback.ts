// Alternative wallet connection approach for problematic environments

export interface WalletInfo {
  account: string
  chainId: number
  ethereum: any
}

export async function connectWalletSimple(): Promise<WalletInfo> {
  if (typeof window.ethereum === 'undefined') {
    throw new Error('MetaMask is not installed. Please install MetaMask extension.')
  }

  const ethereum = window.ethereum as any

  try {
    // Request account access
    const accounts = await ethereum.request({
      method: 'eth_requestAccounts'
    })

    if (!accounts || accounts.length === 0) {
      throw new Error('No accounts found. Please ensure MetaMask is unlocked.')
    }

    // Get chain ID directly from ethereum object
    const chainId = await ethereum.request({ method: 'eth_chainId' })

    return {
      account: accounts[0],
      chainId: parseInt(chainId, 16),
      ethereum
    }

  } catch (error: any) {
    console.error('Simple wallet connection error:', error)

    // Provide user-friendly error messages
    if (error.code === 4001) {
      throw new Error('Connection cancelled. Please try again and approve the connection.')
    } else if (error.code === -32002) {
      throw new Error('MetaMask is already processing a request. Please check your MetaMask extension.')
    } else if (error.message?.includes('User rejected')) {
      throw new Error('Connection rejected. Please approve the connection in MetaMask.')
    } else {
      throw new Error(`Connection failed: ${error.message || 'Unknown error'}`)
    }
  }
}

export async function createContractInterface(ethereum: any, contractAddress: string, abi: any[]): Promise<any> {
  try {
    // Create a minimal contract interface without ethers provider
    return {
      address: contractAddress,
      abi,
      ethereum,

      // Call contract methods using ethereum.request
      async call(method: string, params: any[] = []): Promise<any> {
        const data = encodeMethodCall(method, params, abi)

        return await ethereum.request({
          method: 'eth_call',
          params: [{
            to: contractAddress,
            data
          }, 'latest']
        })
      },

      // Send transactions
      async send(method: string, params: any[] = [], value: string = '0x0'): Promise<string> {
        const data = encodeMethodCall(method, params, abi)
        const accounts = await ethereum.request({ method: 'eth_accounts' })

        return await ethereum.request({
          method: 'eth_sendTransaction',
          params: [{
            from: accounts[0],
            to: contractAddress,
            data,
            value
          }]
        })
      }
    }
  } catch (error) {
    throw new Error(`Failed to create contract interface: ${error}`)
  }
}

// Simple ABI encoding for common method calls
function encodeMethodCall(method: string, params: any[], abi: any[]): string {
  // Find the method in ABI
  const methodAbi = abi.find(item =>
    item.type === 'function' && item.name === method
  )

  if (!methodAbi) {
    throw new Error(`Method ${method} not found in ABI`)
  }

  // For demo purposes, return a simple encoded call
  // In production, you'd use proper ABI encoding
  const methodId = getMethodId(methodAbi)

  // Simple parameter encoding (this is very basic - use proper library in production)
  let encodedParams = ''
  if (params.length > 0) {
    // Basic encoding for common types
    encodedParams = params.map(param => {
      if (typeof param === 'string' && param.startsWith('0x')) {
        return param.slice(2).padStart(64, '0')
      } else if (typeof param === 'number') {
        return param.toString(16).padStart(64, '0')
      } else if (typeof param === 'string') {
        // For string, encode as bytes32 (simplified)
        return Buffer.from(param).toString('hex').padStart(64, '0')
      }
      return '0'.repeat(64)
    }).join('')
  }

  return methodId + encodedParams
}

function getMethodId(methodAbi: any): string {
  // Generate method ID from signature (simplified)
  const signature = `${methodAbi.name}(${methodAbi.inputs.map((input: any) => input.type).join(',')})`

  // Simple hash (in production, use keccak256)
  let hash = 0
  for (let i = 0; i < signature.length; i++) {
    const char = signature.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }

  return '0x' + Math.abs(hash).toString(16).slice(0, 8).padStart(8, '0')
}