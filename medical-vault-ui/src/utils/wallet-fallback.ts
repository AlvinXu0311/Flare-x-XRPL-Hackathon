// Alternative wallet connection approach for problematic environments
import { ethers } from 'ethers'

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
    // Create a complete contract interface that mimics ethers contract
    const contractInterface = {
      address: contractAddress,
      abi,
      ethereum,

      // Call contract methods using ethereum.request
      async call(method: string, params: any[] = []): Promise<any> {
        const data = encodeMethodCall(method, params, abi)

        const result = await ethereum.request({
          method: 'eth_call',
          params: [{
            to: contractAddress,
            data
          }, 'latest']
        })

        return decodeResult(method, result, abi)
      },

      // Send transactions
      async send(method: string, params: any[] = [], value: string = '0x0'): Promise<any> {
        const data = encodeMethodCall(method, params, abi)
        const accounts = await ethereum.request({ method: 'eth_accounts' })

        const txHash = await ethereum.request({
          method: 'eth_sendTransaction',
          params: [{
            from: accounts[0],
            to: contractAddress,
            data,
            value
          }]
        })

        // Return a transaction object that mimics ethers
        return {
          hash: txHash,
          wait: async () => {
            // Simple wait implementation - poll for receipt
            let receipt = null
            let attempts = 0
            const maxAttempts = 30

            while (!receipt && attempts < maxAttempts) {
              try {
                receipt = await ethereum.request({
                  method: 'eth_getTransactionReceipt',
                  params: [txHash]
                })

                if (receipt) {
                  return receipt
                }
              } catch (error) {
                console.warn('Error getting receipt:', error)
              }

              await new Promise(resolve => setTimeout(resolve, 2000))
              attempts++
            }

            throw new Error('Transaction receipt not found after timeout')
          }
        }
      }
    }

    // Dynamically add all contract methods from ABI
    abi.forEach((item: any) => {
      if (item.type === 'function') {
        const methodName = item.name

        // Create the method on the contract interface
        ;(contractInterface as any)[methodName] = async (...args: any[]) => {
          // Filter out any undefined arguments
          const cleanArgs = args.filter(arg => arg !== undefined)

          console.log(`Calling contract method: ${methodName} with args:`, cleanArgs)

          // Determine if this is a view/pure function or a state-changing function
          const isView = item.stateMutability === 'view' ||
                        item.stateMutability === 'pure' ||
                        item.constant === true

          if (isView) {
            // Use call for view functions
            return await contractInterface.call(methodName, cleanArgs)
          } else {
            // Use send for state-changing functions
            return await contractInterface.send(methodName, cleanArgs)
          }
        }
      }
    })

    // Add event listener capabilities
    ;(contractInterface as any).on = (eventName: string, callback: Function) => {
      console.log(`Event listener added for: ${eventName}`, typeof callback)
      // For basic interface, we'll store listeners but not actually implement them
      // The event system will be handled by the main event listener service
    }

    ;(contractInterface as any).removeAllListeners = () => {
      console.log('All event listeners removed (basic interface)')
    }

    console.log('✅ Enhanced contract interface created with dynamic methods')
    return contractInterface

  } catch (error) {
    throw new Error(`Failed to create contract interface: ${error}`)
  }
}

// Proper ABI encoding using ethers.js utilities
function encodeMethodCall(method: string, params: any[], abi: any[]): string {
  try {
    // Create interface from ABI
    const contractInterface = new ethers.utils.Interface(abi)

    // Encode the function call
    const encodedCall = contractInterface.encodeFunctionData(method, params)

    console.log(`Encoded call for ${method}:`, encodedCall)
    return encodedCall
  } catch (error) {
    console.error(`Failed to encode method call for ${method}:`, error)
    throw new Error(`Failed to encode method call: ${error}`)
  }
}

// Decode contract call results
function decodeResult(method: string, result: string, abi: any[]): any {
  try {
    if (!result || result === '0x') {
      return null
    }

    // Create interface from ABI
    const contractInterface = new ethers.utils.Interface(abi)

    // Find the method in ABI to get return types
    const methodAbi = abi.find(item =>
      item.type === 'function' && item.name === method
    )

    if (!methodAbi || !methodAbi.outputs) {
      console.warn(`No outputs defined for method ${method}`)
      return result
    }

    // Decode the result
    const decoded = contractInterface.decodeFunctionResult(method, result)

    console.log(`Decoded result for ${method}:`, decoded)

    // If there's only one return value, return it directly
    if (decoded.length === 1) {
      return decoded[0]
    }

    // If multiple return values, return as array
    return decoded
  } catch (error) {
    console.error(`Failed to decode result for ${method}:`, error)
    // Return raw result if decoding fails
    return result
  }
}