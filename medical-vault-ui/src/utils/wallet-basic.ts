// Most basic wallet connection - should work with any MetaMask version

export async function connectBasic(): Promise<{
  account: string
  chainId: number
  ethereum: any
}> {
  console.log('Attempting basic wallet connection...')

  if (typeof window.ethereum === 'undefined') {
    throw new Error('MetaMask not found')
  }

  const ethereum = window.ethereum as any

  try {
    console.log('Requesting accounts...')

    // Request accounts
    const accounts = await ethereum.request({
      method: 'eth_requestAccounts'
    })

    console.log('Accounts received:', accounts)

    if (!accounts || accounts.length === 0) {
      throw new Error('No accounts available')
    }

    console.log('Getting chain ID...')

    // Get chain ID
    const chainHex = await ethereum.request({
      method: 'eth_chainId'
    })

    const chainId = parseInt(chainHex, 16)

    console.log('Chain ID received:', chainId)

    return {
      account: accounts[0],
      chainId,
      ethereum
    }

  } catch (error: any) {
    console.error('Basic connection failed:', error)
    throw new Error(`Connection failed: ${error.message}`)
  }
}

export async function switchToCoston2Basic(): Promise<void> {
  if (typeof window.ethereum === 'undefined') {
    throw new Error('MetaMask not found')
  }

  const ethereum = window.ethereum as any

  try {
    await ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0x72' }]
    })
  } catch (switchError: any) {
    if (switchError.code === 4902) {
      // Network not added, try to add it
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
    } else {
      throw switchError
    }
  }
}