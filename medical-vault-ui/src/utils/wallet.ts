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

    // Create provider with multiple retry attempts and different approaches
    let provider: ethers.providers.Web3Provider
    try {
      // First attempt: Standard Web3Provider
      provider = new ethers.providers.Web3Provider(ethereum)

      // Test the provider to make sure it's working
      await provider.detectNetwork()
    } catch (providerError) {
      console.warn('Standard provider creation failed, trying alternative approach:', providerError)

      try {
        // Second attempt: Force provider to be ready
        await new Promise(resolve => setTimeout(resolve, 500))
        provider = new ethers.providers.Web3Provider(ethereum, 'any')

        // Test network detection
        await provider.detectNetwork()
      } catch (retryError) {
        console.error('All provider creation attempts failed:', retryError)
        throw new Error('Failed to connect to MetaMask. Please try: 1) Refresh the page 2) Restart MetaMask 3) Check browser console for details.')
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