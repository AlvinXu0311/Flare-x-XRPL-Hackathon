import { Client, Wallet, xrpToDrops, dropsToXrp } from 'xrpl'

let client = null

export const connectToXRPL = async (serverUrl = 'wss://xrplcluster.com/') => {
  try {
    client = new Client(serverUrl)
    await client.connect()
    console.log('Connected to XRPL')
    return client
  } catch (error) {
    console.error('Failed to connect to XRPL:', error)
    throw error
  }
}

export const disconnectFromXRPL = async () => {
  if (client && client.isConnected()) {
    await client.disconnect()
    console.log('Disconnected from XRPL')
  }
}

export const createWallet = () => {
  return Wallet.generate()
}

export const getAccountBalance = async (address) => {
  if (!client) {
    throw new Error('Not connected to XRPL')
  }

  try {
    const response = await client.request({
      command: 'account_info',
      account: address,
      ledger_index: 'validated'
    })

    return dropsToXrp(response.result.account_data.Balance)
  } catch (error) {
    console.error('Failed to get account balance:', error)
    throw error
  }
}

export const sendPayment = async (senderWallet, destinationAddress, amount) => {
  if (!client) {
    throw new Error('Not connected to XRPL')
  }

  try {
    const payment = {
      TransactionType: 'Payment',
      Account: senderWallet.address,
      Amount: xrpToDrops(amount.toString()),
      Destination: destinationAddress,
    }

    const prepared = await client.autofill(payment)
    const signed = senderWallet.sign(prepared)
    const result = await client.submitAndWait(signed.tx_blob)

    return result
  } catch (error) {
    console.error('Payment failed:', error)
    throw error
  }
}

export const mintNFT = async (wallet, uri, taxon = 0) => {
  if (!client) {
    throw new Error('Not connected to XRPL')
  }

  try {
    const mintTransaction = {
      TransactionType: 'NFTokenMint',
      Account: wallet.address,
      URI: Buffer.from(uri).toString('hex').toUpperCase(),
      Flags: 8, // tfTransferable
      NFTokenTaxon: taxon
    }

    const prepared = await client.autofill(mintTransaction)
    const signed = wallet.sign(prepared)
    const result = await client.submitAndWait(signed.tx_blob)

    if (result.result.meta.TransactionResult === 'tesSUCCESS') {
      const nfTokenPage = result.result.meta.AffectedNodes.find(
        node => node.ModifiedNode?.LedgerEntryType === 'NFTokenPage' ||
                node.CreatedNode?.LedgerEntryType === 'NFTokenPage'
      )

      if (nfTokenPage) {
        const tokenPage = nfTokenPage.ModifiedNode || nfTokenPage.CreatedNode
        const tokens = tokenPage.FinalFields?.NFTokens || tokenPage.NewFields?.NFTokens
        if (tokens && tokens.length > 0) {
          return tokens[tokens.length - 1].NFToken.NFTokenID
        }
      }
    }

    throw new Error('NFT minting failed')
  } catch (error) {
    console.error('NFT minting failed:', error)
    throw error
  }
}

export const getNFTsByAccount = async (address) => {
  if (!client) {
    throw new Error('Not connected to XRPL')
  }

  try {
    const response = await client.request({
      command: 'account_nfts',
      account: address,
      ledger_index: 'validated'
    })

    return response.result.account_nfts || []
  } catch (error) {
    console.error('Failed to get NFTs:', error)
    throw error
  }
}

export const validateAddress = (address) => {
  try {
    return address.length >= 25 && address.length <= 34 && address.startsWith('r')
  } catch {
    return false
  }
}

export const formatXRP = (amount) => {
  return `${parseFloat(amount).toFixed(6)} XRP`
}

export const convertUSDToXRP = async (usdAmount) => {
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ripple&vs_currencies=usd')
    const data = await response.json()
    const xrpPrice = data.ripple.usd
    return (usdAmount / xrpPrice).toFixed(6)
  } catch (error) {
    console.error('Failed to convert USD to XRP:', error)
    return '30' // Fallback XRP amount for $15 (assuming ~$0.50 per XRP)
  }
}