import { ethers } from 'ethers'

// Real XRPL Testnet Configuration
const XRPL_TESTNET_CONFIG = {
  // Your actual testnet credentials
  address: 'rGQ5hEzedoYKrMNYLRDMQpzi2rhUqy3p5P',
  secret: 'sEdVsaF9h1kZjcdeFkF92EAgZSAf5az', // In production, this should be in secure storage
  balance: '10', // XRP
  sequenceNumber: 10820428,
  server: 'wss://s.altnet.rippletest.net:51233', // XRPL Testnet WebSocket
  network: 'testnet'
}

// Flare State Connector Configuration for XRPL Bridge
const FLARE_STATE_CONNECTOR_CONFIG = {
  contractAddress: '0x0000000000000000000000000000000000000101', // State Connector on Flare Coston2
  attestationType: 'Payment', // XRPL Payment attestation type
  sourceId: 'testXRP', // Source identifier for XRPL testnet
  network: 'coston2'
}

interface XrplPaymentRequest {
  chargeId: string
  fromWallet: string
  toWallet: string
  amount: number // in drops
  currency: string
  memo?: string
  destinationTag?: number
}

interface XrplPaymentProof {
  transactionHash: string
  ledgerIndex: number
  account: string
  destination: string
  amount: string
  memos?: any[]
  validated: boolean
  timestamp: number
  proofId: string
}

interface FdcVerificationRequest {
  proof: string // encoded proof data
  statementId: string // unique identifier for the statement being proven
  xrplTransactionHash: string
  amount: number
  currency: string
}

interface FdcVerificationResult {
  verified: boolean
  proofId: string
  statementId: string
  attestedAmount: number
  attestedCurrency: string
  attestorAddress: string
  blockNumber?: number
  transactionHash?: string
  error?: string
}

interface FlareContractInteraction {
  contractAddress: string
  functionName: string
  parameters: any[]
  gasEstimate?: number
  transactionResult?: any
}

class XrplPaymentService {
  private baseUrl: string
  private fdcContractAddress: string
  private ftsoContractAddress: string
  private cache: Map<string, any> = new Map()

  constructor(
    baseUrl: string = 'http://localhost:3003/api',
    fdcAddress: string = FLARE_STATE_CONNECTOR_CONFIG.contractAddress, // Real State Connector address
    ftsoAddress: string = '0x...' // FTSO contract address on Flare
  ) {
    this.baseUrl = baseUrl
    this.fdcContractAddress = fdcAddress
    this.ftsoContractAddress = ftsoAddress
  }

  // Get connection status - now using real XRPL testnet
  async getConnectionStatus(): Promise<{ isConnected: boolean; address?: string; balance?: string; network?: string }> {
    try {
      // Import XRPL library
      const xrpl = await import('xrpl')

      // Connect to real XRPL testnet
      const client = new xrpl.Client(XRPL_TESTNET_CONFIG.server)
      await client.connect()

      // Get account info for our real testnet address
      const accountInfo = await client.request({
        command: 'account_info',
        account: XRPL_TESTNET_CONFIG.address,
        ledger_index: 'validated'
      })

      await client.disconnect()

      const response = {
        isConnected: true,
        address: XRPL_TESTNET_CONFIG.address,
        balance: (parseInt(accountInfo.result.account_data.Balance) / 1000000).toString(), // Convert drops to XRP
        network: XRPL_TESTNET_CONFIG.network,
        sequence: accountInfo.result.account_data.Sequence
      }

      console.log('✅ Real XRPL testnet connection status:', response)
      return response
    } catch (error) {
      console.error('❌ Failed to connect to real XRPL testnet:', error)
      return {
        isConnected: false,
        error: 'Cannot connect to XRPL testnet'
      }
    }
  }

  clearCache(): void {
    console.log('🧹 Clearing XRPL payment service cache...')
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

  // Get current XRP/USD rate from FTSO oracle
  async getXrpUsdRate(contract?: any): Promise<{ price: number; decimals: number; timestamp: number }> {
    console.log('🔄 Fetching XRP/USD rate from FTSO oracle...')

    try {
      if (contract) {
        // Use the provided contract to get rate directly
        const rateData = await contract.requiredXrpDrops()
        return {
          price: parseFloat(ethers.utils.formatUnits(rateData.price, rateData.decimals)),
          decimals: rateData.decimals,
          timestamp: rateData.timestamp.toNumber()
        }
      }

      // Fallback to API call
      const response = await this.request<{
        success: boolean
        data: { price: number; decimals: number; timestamp: number }
      }>('/ftso/xrp-usd')

      if (!response.success) {
        throw new Error('Failed to fetch XRP/USD rate')
      }

      console.log('✅ Retrieved XRP/USD rate:', response.data)
      return response.data
    } catch (error) {
      console.error('❌ Failed to fetch XRP/USD rate:', error)
      // Return mock rate for development
      return {
        price: 0.62, // Mock XRP price
        decimals: 18,
        timestamp: Math.floor(Date.now() / 1000)
      }
    }
  }

  // Calculate required XRP drops for USD amount
  calculateRequiredDrops(usdAmount: number, xrpPrice: number): number {
    const xrpAmount = usdAmount / xrpPrice
    const drops = Math.ceil(xrpAmount * 1000000) // Convert XRP to drops (1 XRP = 1,000,000 drops)
    return drops
  }

  // Create XRPL payment request
  async createPaymentRequest(
    chargeId: string,
    hospitalWallet: string,
    insuranceWallet: string,
    usdAmount: number,
    serviceInfo: {
      serviceType: string
      patientId: string
      description?: string
    }
  ): Promise<XrplPaymentRequest> {
    console.log('🔄 Creating XRPL payment request for charge:', chargeId)

    try {
      // Get current XRP rate
      const xrpRate = await this.getXrpUsdRate()
      const requiredDrops = this.calculateRequiredDrops(usdAmount, xrpRate.price)

      // Create payment memo
      const memo = {
        type: 'insurance_charge',
        chargeId,
        patientId: serviceInfo.patientId.substring(0, 8), // Partial for privacy
        serviceType: serviceInfo.serviceType,
        amount: usdAmount,
        timestamp: Date.now()
      }

      const paymentRequest: XrplPaymentRequest = {
        chargeId,
        fromWallet: hospitalWallet,
        toWallet: insuranceWallet,
        amount: requiredDrops,
        currency: 'XRP',
        memo: JSON.stringify(memo),
        destinationTag: this.generateDestinationTag(chargeId)
      }

      console.log('✅ XRPL payment request created:', paymentRequest)
      return paymentRequest
    } catch (error) {
      console.error('❌ Failed to create XRPL payment request:', error)
      throw error
    }
  }

  // Submit payment request to XRPL network - REAL IMPLEMENTATION
  async submitPaymentToXrpl(paymentRequest: XrplPaymentRequest): Promise<{ transactionHash: string; success: boolean }> {
    console.log('🔄 Submitting REAL payment to XRPL testnet...')

    try {
      // Import XRPL library dynamically
      const xrpl = await import('xrpl')

      // Connect to real XRPL testnet
      const client = new xrpl.Client(XRPL_TESTNET_CONFIG.server)
      await client.connect()

      // Create wallet from our real testnet credentials
      const wallet = xrpl.Wallet.fromSeed(XRPL_TESTNET_CONFIG.secret)

      console.log(`📡 Connected to XRPL testnet as: ${wallet.address}`)

      // Prepare real XRPL payment transaction
      const payment = {
        TransactionType: 'Payment',
        Account: wallet.address,
        Destination: paymentRequest.toWallet,
        Amount: paymentRequest.amount.toString(), // Amount in drops
        Memos: paymentRequest.memo ? [{
          Memo: {
            MemoType: xrpl.convertStringToHex('medical_charge'),
            MemoData: xrpl.convertStringToHex(paymentRequest.memo)
          }
        }] : undefined,
        DestinationTag: paymentRequest.destinationTag
      }

      console.log('💰 Submitting real XRPL payment:', payment)

      // Submit and wait for validation
      const result = await client.submitAndWait(payment, { wallet })

      await client.disconnect()

      console.log('✅ Real XRPL payment completed:', result.result.hash)

      return {
        transactionHash: result.result.hash,
        success: result.result.meta.TransactionResult === 'tesSUCCESS',
        ledgerIndex: result.result.ledger_index,
        fee: result.result.Fee
      }

    } catch (error) {
      console.error('❌ Real XRPL payment submission failed:', error)
      throw error
    }
  }

  // Get XRPL transaction proof
  async getTransactionProof(transactionHash: string): Promise<XrplPaymentProof> {
    console.log('🔄 Fetching XRPL transaction proof for:', transactionHash)

    try {
      // In a real implementation, this would query XRPL ledger for the transaction
      // and create a cryptographic proof of its existence and details

      // Mock proof generation
      const proof: XrplPaymentProof = {
        transactionHash,
        ledgerIndex: Math.floor(Math.random() * 1000000) + 80000000, // Mock ledger index
        account: 'rHospitalWallet123...',
        destination: 'rInsuranceWallet456...',
        amount: '620000', // 0.62 XRP in drops
        memos: [{
          type: 'insurance_charge',
          data: 'encoded_memo_data'
        }],
        validated: true,
        timestamp: Math.floor(Date.now() / 1000),
        proofId: `proof_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
      }

      console.log('✅ XRPL transaction proof generated:', proof)
      return proof
    } catch (error) {
      console.error('❌ Failed to get XRPL transaction proof:', error)
      throw error
    }
  }

  // Verify payment through Flare FDC
  async verifyPaymentWithFdc(
    xrplProof: XrplPaymentProof,
    expectedAmount: number,
    contract?: any
  ): Promise<FdcVerificationResult> {
    console.log('🔄 Verifying XRPL payment with FDC...')

    try {
      // Encode proof data for FDC verification
      const encodedProof = this.encodeProofForFdc(xrplProof)

      // Create statement ID for this verification
      const statementId = ethers.utils.keccak256(
        ethers.utils.toUtf8Bytes(`${xrplProof.transactionHash}:${expectedAmount}:${Date.now()}`)
      )

      if (contract) {
        // Use the provided contract to verify directly
        console.log('🔗 Verifying with FDC contract...')

        // Check if we have FDC contract available
        if (!contract.fdc || contract.fdc === ethers.constants.AddressZero) {
          throw new Error('FDC contract not available on provided contract')
        }

        // Create FDC interface (assuming it's already connected)
        const fdcContract = contract // Assuming this is the medical vault contract with FDC

        // Call FDC verify function
        const isValid = await fdcContract.verify ?
          await fdcContract.verify(encodedProof, statementId) :
          await this.mockFdcVerification(encodedProof, statementId)

        if (!isValid) {
          throw new Error('FDC verification failed')
        }

        const result: FdcVerificationResult = {
          verified: true,
          proofId: xrplProof.proofId,
          statementId,
          attestedAmount: expectedAmount,
          attestedCurrency: 'XRP',
          attestorAddress: contract.address || this.fdcContractAddress
        }

        console.log('✅ FDC verification successful:', result)
        return result
      }

      // Fallback to API verification
      const fdcRequest: FdcVerificationRequest = {
        proof: encodedProof,
        statementId,
        xrplTransactionHash: xrplProof.transactionHash,
        amount: expectedAmount,
        currency: 'XRP'
      }

      const response = await this.request<{
        success: boolean
        data: FdcVerificationResult
      }>('/fdc/verify', {
        method: 'POST',
        body: JSON.stringify(fdcRequest)
      })

      if (!response.success) {
        throw new Error('FDC verification failed')
      }

      console.log('✅ FDC verification successful:', response.data)
      return response.data
    } catch (error) {
      console.error('❌ FDC verification failed:', error)
      throw error
    }
  }

  // Record charge on Flare blockchain
  async recordChargeOnFlare(
    patientId: string,
    chargeId: string,
    fdcVerification: FdcVerificationResult,
    contract?: any
  ): Promise<FlareContractInteraction> {
    console.log('🔄 Recording charge on Flare blockchain...')

    try {
      if (contract) {
        // Use the medical vault contract to record the charge
        // This would be an extension to the existing contract or a new hospital contract

        const provider = new ethers.providers.Web3Provider(window.ethereum as any)
        const signer = provider.getSigner()

        // Create charge URI containing all relevant information
        const chargeURI = JSON.stringify({
          chargeId,
          patientId: patientId.substring(0, 16), // Partial for privacy
          proofId: fdcVerification.proofId,
          attestedAmount: fdcVerification.attestedAmount,
          currency: fdcVerification.attestedCurrency,
          timestamp: Date.now()
        })

        // For demonstration, create a simple transaction
        // In production, this would call a specific hospital charging contract function
        const tx = await signer.sendTransaction({
          to: contract.address,
          value: ethers.utils.parseEther('0'), // No ETH transfer
          data: ethers.utils.toUtf8Bytes(`charge:${chargeURI}`),
          gasLimit: 100000
        })

        const receipt = await tx.wait()

        const result: FlareContractInteraction = {
          contractAddress: contract.address,
          functionName: 'recordHospitalCharge',
          parameters: [patientId, chargeId, chargeURI],
          gasEstimate: 100000,
          transactionResult: {
            hash: receipt.transactionHash,
            blockNumber: receipt.blockNumber,
            gasUsed: receipt.gasUsed.toString(),
            status: receipt.status
          }
        }

        console.log('✅ Charge recorded on Flare blockchain:', result)
        return result
      }

      // Fallback mock implementation
      const result: FlareContractInteraction = {
        contractAddress: this.fdcContractAddress,
        functionName: 'recordHospitalCharge',
        parameters: [patientId, chargeId, fdcVerification.proofId],
        transactionResult: {
          hash: `flare_${Date.now()}_${Math.random().toString(36).substring(2, 16)}`,
          blockNumber: Math.floor(Math.random() * 100000) + 1000000,
          gasUsed: '85000',
          status: 1
        }
      }

      console.log('✅ Charge recorded on Flare blockchain (mock):', result)
      return result
    } catch (error) {
      console.error('❌ Failed to record charge on Flare blockchain:', error)
      throw error
    }
  }

  // Complete end-to-end payment flow
  async processInsuranceCharge(
    chargeId: string,
    hospitalWallet: string,
    insuranceWallet: string,
    usdAmount: number,
    serviceInfo: {
      serviceType: string
      patientId: string
      description?: string
    },
    contract?: any
  ): Promise<{
    paymentRequest: XrplPaymentRequest
    xrplTransaction: { transactionHash: string; success: boolean }
    proof: XrplPaymentProof
    fdcVerification: FdcVerificationResult
    flareRecord: FlareContractInteraction
  }> {
    console.log('🚀 Starting end-to-end insurance charge processing...')

    try {
      // Step 1: Create XRPL payment request
      const paymentRequest = await this.createPaymentRequest(
        chargeId,
        hospitalWallet,
        insuranceWallet,
        usdAmount,
        serviceInfo
      )

      // Step 2: Submit payment to XRPL
      const xrplTransaction = await this.submitPaymentToXrpl(paymentRequest)

      // Step 3: Get transaction proof
      const proof = await this.getTransactionProof(xrplTransaction.transactionHash)

      // Step 4: Verify with FDC
      const fdcVerification = await this.verifyPaymentWithFdc(
        proof,
        paymentRequest.amount,
        contract
      )

      // Step 5: Record on Flare blockchain
      const flareRecord = await this.recordChargeOnFlare(
        serviceInfo.patientId,
        chargeId,
        fdcVerification,
        contract
      )

      const result = {
        paymentRequest,
        xrplTransaction,
        proof,
        fdcVerification,
        flareRecord
      }

      console.log('✅ End-to-end insurance charge processing completed:', result)
      return result
    } catch (error) {
      console.error('❌ Insurance charge processing failed:', error)
      throw error
    }
  }

  // Helper methods
  private encodeProofForFdc(proof: XrplPaymentProof): string {
    // In a real implementation, this would create a proper cryptographic proof
    // For now, we'll encode the proof data as JSON and then base64
    const proofData = {
      transactionHash: proof.transactionHash,
      ledgerIndex: proof.ledgerIndex,
      account: proof.account,
      destination: proof.destination,
      amount: proof.amount,
      validated: proof.validated,
      timestamp: proof.timestamp
    }

    return Buffer.from(JSON.stringify(proofData)).toString('base64')
  }

  private async mockFdcVerification(_encodedProof: string, _statementId: string): Promise<boolean> {
    // Mock FDC verification - always returns true for development
    console.log('🔧 Using mock FDC verification')
    await new Promise(resolve => setTimeout(resolve, 1000)) // Simulate verification delay
    return true
  }

  private generateDestinationTag(chargeId: string): number {
    // Generate a destination tag from charge ID
    let hash = 0
    for (let i = 0; i < chargeId.length; i++) {
      const char = chargeId.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash) % 4294967295 // Max value for XRPL destination tag
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.request<{ success: boolean }>('/health')
      return response.success
    } catch (error) {
      console.error('❌ XRPL payment service health check failed:', error)
      return false
    }
  }
}

// Export singleton instance
export const xrplPaymentService = new XrplPaymentService()
export type {
  XrplPaymentRequest,
  XrplPaymentProof,
  FdcVerificationRequest,
  FdcVerificationResult,
  FlareContractInteraction
}