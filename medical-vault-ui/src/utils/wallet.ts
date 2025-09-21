// Wallet connection utilities for better error handling

import { ethers } from 'ethers'

export interface WalletConnection {
  provider: ethers.providers.Web3Provider
  signer: ethers.providers.JsonRpcSigner
  account: string
  chainId: number
}

export async function connectToMetaMask(): Promise<WalletConnection> {
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

    // Create provider with enhanced error handling for proxy issues
    let provider: ethers.providers.Web3Provider
    try {
      // Clear any cached provider data
      if (ethereum._metamask) {
        try {
          await ethereum._metamask.isUnlocked()
        } catch (unlockError) {
          console.warn('MetaMask unlock check failed:', unlockError)
        }
      }

      // Create fresh provider instance
      provider = new ethers.providers.Web3Provider(ethereum, 'any')

      // Add small delay to allow provider to initialize
      await new Promise(resolve => setTimeout(resolve, 100))

      // Test the provider with timeout
      const networkPromise = provider.detectNetwork()
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Network detection timeout')), 5000)
      )

      await Promise.race([networkPromise, timeoutPromise])

    } catch (providerError) {
      console.warn('Provider creation failed, trying alternative approach:', providerError)

      try {
        // Force page reload to clear any cached state
        if (providerError.message?.includes('proxy') || providerError.message?.includes('_network')) {
          throw new Error('MetaMask connection cache issue. Please refresh the page and try again.')
        }

        // Second attempt with clean slate
        provider = new ethers.providers.Web3Provider(ethereum)
        await provider.getNetwork()

      } catch (retryError) {
        console.error('All provider creation attempts failed:', retryError)
        throw new Error('Failed to connect to MetaMask. Please: 1) Refresh the page 2) Reset MetaMask account 3) Reconnect wallet')
      }
    }

    // Get signer
    const signer = provider.getSigner()

    // Get account address
    const account = await signer.getAddress()

    // Get network information
    const network = await provider.getNetwork()
    const chainId = network.chainId

    return {
      provider,
      signer,
      account,
      chainId
    }

  } catch (error: any) {
    console.error('MetaMask connection error:', error)

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

export async function switchToCoston2(): Promise<void> {
  if (typeof window.ethereum === 'undefined') {
    throw new Error('MetaMask is not installed.')
  }

  const ethereum = window.ethereum as any

  try {
    // Try to switch to Coston2
    await ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0x72' }], // 114 in hex
    })
  } catch (switchError: any) {
    // If the network doesn't exist, add it
    if (switchError.code === 4902) {
      try {
        await ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: '0x72',
            chainName: 'Coston2',
            nativeCurrency: {
              name: 'Coston2 Flare',
              symbol: 'C2FLR',
              decimals: 18
            },
            rpcUrls: ['https://rpc-coston2.flare.network'],
            blockExplorerUrls: ['https://coston2-explorer.flare.network/']
          }]
        })
      } catch (addError: any) {
        throw new Error(`Failed to add Coston2 network: ${addError.message}`)
      }
    } else {
      throw new Error(`Failed to switch network: ${switchError.message}`)
    }
  }
}

export function isMetaMaskInstalled(): boolean {
  return typeof window.ethereum !== 'undefined' && Boolean(window.ethereum.isMetaMask)
}

export async function getConnectedAccounts(): Promise<string[]> {
  if (!isMetaMaskInstalled()) {
    return []
  }

  try {
    const ethereum = window.ethereum as any
    const accounts = await ethereum.request({ method: 'eth_accounts' })
    return accounts || []
  } catch (error) {
    console.error('Failed to get connected accounts:', error)
    return []
  }
}