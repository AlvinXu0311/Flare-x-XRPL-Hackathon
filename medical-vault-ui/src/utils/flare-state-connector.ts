import { ethers } from 'ethers'

// Flare State Connector Configuration for XRPL Bridge
const STATE_CONNECTOR_CONFIG = {
  // State Connector contract on Flare Coston2 testnet
  address: '0x0000000000000000000000000000000000000101',
  // XRPL Payment attestation type
  attestationType: 'Payment',
  // Source identifier for XRPL testnet
  sourceId: 'testXRP',
  network: 'coston2'
}

// XRPL Configuration
const XRPL_CONFIG = {
  address: 'rGQ5hEzedoYKrMNYLRDMQpzi2rhUqy3p5P',
  secret: 'sEdVsaF9h1kZjcdeFkF92EAgZSAf5az',
  server: 'wss://s.altnet.rippletest.net:51233',
  network: 'testnet'
}

interface AttestationRequest {
  attestationType: string
  sourceId: string
  requestBody: {
    transactionId: string
    inUtxo: number
    utxo: number
  }
}

interface AttestationResponse {
  attestationType: string
  sourceId: string
  votingRound: string
  lowestUsedTimestamp: string
  requestBody: any
  responseBody: {
    blockNumber: string
    blockTimestamp: string
    sourceAddressHash: string
    receivingAddressHash: string
    intendedReceivingAddressHash: string
    spentAmount: string
    intendedSpentAmount: string
    receivedAmount: string
    intendedReceivedAmount: string
    standardPaymentReference: string
    oneToOne: boolean
    status: string
  }
}

interface XrplBridgeTransaction {
  id: string
  xrplTxHash: string
  flareAttestationId: string
  status: 'pending' | 'attested' | 'verified' | 'failed'
  amount: string
  from: string
  to: string
  memo?: string
  timestamp: number
  blockNumber?: number
  attestationProof?: AttestationResponse
}

class FlareStateConnector {
  private provider: ethers.providers.Web3Provider | null = null
  private stateConnectorContract: ethers.Contract | null = null
  private pendingAttestations: Map<string, XrplBridgeTransaction> = new Map()

  // State Connector ABI (simplified)
  private readonly stateConnectorAbi = [
    'function requestAttestations(uint256 votingRound, bytes32[] memory attestationRequests) external',
    'function getVotingRoundId(uint256 timestamp) external view returns (uint256)',
    'function getAttestation(bytes32 attestationId) external view returns (bool exists, bytes memory data)',
    'function merkleRoots(uint256 votingRound) external view returns (bytes32)',

    // Events
    'event AttestationRequest(uint256 indexed votingRound, bytes32 indexed attestationId, bytes request)',
    'event AttestationConfirmed(uint256 indexed votingRound, bytes32 indexed attestationId, bytes response)'
  ]

  constructor() {
    if (window.ethereum) {
      this.provider = new ethers.providers.Web3Provider(window.ethereum as any)
      this.initializeContract()
    }
  }

  private async initializeContract() {
    if (!this.provider) return

    try {
      const signer = this.provider.getSigner()
      this.stateConnectorContract = new ethers.Contract(
        STATE_CONNECTOR_CONFIG.address,
        this.stateConnectorAbi,
        signer
      )
      console.log('✅ State Connector contract initialized')
    } catch (error) {
      console.error('❌ Failed to initialize State Connector contract:', error)
    }
  }

  // Submit XRPL payment and request attestation
  async submitXrplPaymentAndAttest(
    toAddress: string,
    amount: number, // in drops
    memo: string
  ): Promise<XrplBridgeTransaction> {
    console.log('🌉 Starting XRPL → Flare bridge transaction...')

    try {
      // Step 1: Submit payment to XRPL
      const xrplTxHash = await this.submitToXrpl(toAddress, amount, memo)

      // Step 2: Create bridge transaction record
      const bridgeTx: XrplBridgeTransaction = {
        id: `bridge_${Date.now()}`,
        xrplTxHash,
        flareAttestationId: '',
        status: 'pending',
        amount: amount.toString(),
        from: XRPL_CONFIG.address,
        to: toAddress,
        memo,
        timestamp: Date.now()
      }

      this.pendingAttestations.set(bridgeTx.id, bridgeTx)

      // Step 3: Request attestation from Flare State Connector
      await this.requestAttestation(bridgeTx)

      console.log('✅ XRPL → Flare bridge transaction initiated:', bridgeTx)
      return bridgeTx

    } catch (error) {
      console.error('❌ XRPL → Flare bridge transaction failed:', error)
      throw error
    }
  }

  // Submit payment to real XRPL network
  private async submitToXrpl(toAddress: string, amount: number, memo: string): Promise<string> {
    console.log('📡 Submitting to real XRPL network...')

    const xrpl = await import('xrpl')

    const client = new xrpl.Client(XRPL_CONFIG.server)
    await client.connect()

    const wallet = xrpl.Wallet.fromSeed(XRPL_CONFIG.secret)

    const payment = {
      TransactionType: 'Payment',
      Account: wallet.address,
      Destination: toAddress,
      Amount: amount.toString(),
      Memos: [{
        Memo: {
          MemoType: xrpl.convertStringToHex('medical_charge'),
          MemoData: xrpl.convertStringToHex(memo)
        }
      }]
    }

    const result = await client.submitAndWait(payment, { wallet })
    await client.disconnect()

    console.log('✅ XRPL payment submitted:', result.result.hash)
    return result.result.hash
  }

  // Request attestation from Flare State Connector
  private async requestAttestation(bridgeTx: XrplBridgeTransaction): Promise<void> {
    console.log('🔍 Requesting attestation from Flare State Connector...')

    if (!this.stateConnectorContract) {
      throw new Error('State Connector contract not initialized')
    }

    try {
      // Get current voting round
      const currentTimestamp = Math.floor(Date.now() / 1000)
      const votingRound = await this.stateConnectorContract.getVotingRoundId(currentTimestamp)

      // Create attestation request
      const attestationRequest: AttestationRequest = {
        attestationType: STATE_CONNECTOR_CONFIG.attestationType,
        sourceId: STATE_CONNECTOR_CONFIG.sourceId,
        requestBody: {
          transactionId: bridgeTx.xrplTxHash,
          inUtxo: 0,
          utxo: 0
        }
      }

      // Encode request
      const encodedRequest = ethers.utils.toUtf8Bytes(JSON.stringify(attestationRequest))
      const requestHash = ethers.utils.keccak256(encodedRequest)

      // Submit attestation request
      const tx = await this.stateConnectorContract.requestAttestations(
        votingRound,
        [requestHash]
      )

      const receipt = await tx.wait()

      bridgeTx.flareAttestationId = requestHash
      bridgeTx.status = 'attested'
      bridgeTx.blockNumber = receipt.blockNumber

      console.log('✅ Attestation requested:', {
        votingRound: votingRound.toString(),
        attestationId: requestHash,
        txHash: receipt.transactionHash
      })

      // Start monitoring for confirmation
      this.monitorAttestation(bridgeTx)

    } catch (error) {
      console.error('❌ Failed to request attestation:', error)
      bridgeTx.status = 'failed'
      throw error
    }
  }

  // Monitor attestation confirmation
  private async monitorAttestation(bridgeTx: XrplBridgeTransaction): Promise<void> {
    console.log('👀 Monitoring attestation confirmation...')

    const checkAttestation = async (): Promise<boolean> => {
      if (!this.stateConnectorContract) return false

      try {
        const [exists, data] = await this.stateConnectorContract.getAttestation(
          bridgeTx.flareAttestationId
        )

        if (exists && data && data !== '0x') {
          // Attestation confirmed!
          const attestationResponse = JSON.parse(ethers.utils.toUtf8String(data))

          bridgeTx.attestationProof = attestationResponse
          bridgeTx.status = 'verified'

          console.log('✅ Attestation confirmed:', attestationResponse)
          return true
        }

        return false
      } catch (error) {
        console.error('❌ Error checking attestation:', error)
        return false
      }
    }

    // Poll for attestation confirmation
    let attempts = 0
    const maxAttempts = 30 // 5 minutes with 10-second intervals

    const pollInterval = setInterval(async () => {
      attempts++

      const confirmed = await checkAttestation()

      if (confirmed || attempts >= maxAttempts) {
        clearInterval(pollInterval)

        if (!confirmed) {
          bridgeTx.status = 'failed'
          console.warn('⚠️ Attestation confirmation timeout')
        }
      }
    }, 10000) // Check every 10 seconds
  }

  // Verify XRPL transaction through State Connector
  async verifyXrplTransaction(
    xrplTxHash: string,
    expectedAmount: string,
    expectedDestination: string
  ): Promise<boolean> {
    console.log('🔍 Verifying XRPL transaction through State Connector...')

    try {
      // Find the bridge transaction
      const bridgeTx = Array.from(this.pendingAttestations.values()).find(
        tx => tx.xrplTxHash === xrplTxHash
      )

      if (!bridgeTx) {
        console.warn('⚠️ Bridge transaction not found for verification')
        return false
      }

      if (bridgeTx.status !== 'verified') {
        console.warn('⚠️ Bridge transaction not yet verified by State Connector')
        return false
      }

      // Verify attestation proof
      const proof = bridgeTx.attestationProof
      if (!proof) {
        console.warn('⚠️ No attestation proof available')
        return false
      }

      // Verify transaction details match
      const amountMatch = proof.responseBody.spentAmount === expectedAmount
      const destinationMatch = proof.responseBody.receivingAddressHash === expectedDestination
      const statusSuccess = proof.responseBody.status === 'SUCCESS'

      const isValid = amountMatch && destinationMatch && statusSuccess

      console.log('✅ XRPL transaction verification result:', {
        isValid,
        amountMatch,
        destinationMatch,
        statusSuccess,
        proof
      })

      return isValid

    } catch (error) {
      console.error('❌ Failed to verify XRPL transaction:', error)
      return false
    }
  }

  // Get bridge transaction status
  getBridgeTransactionStatus(bridgeId: string): XrplBridgeTransaction | null {
    return this.pendingAttestations.get(bridgeId) || null
  }

  // Get all bridge transactions
  getAllBridgeTransactions(): XrplBridgeTransaction[] {
    return Array.from(this.pendingAttestations.values())
  }

  // Health check
  async healthCheck(): Promise<{
    stateConnectorConnected: boolean
    xrplConnected: boolean
    pendingAttestations: number
  }> {
    try {
      const stateConnectorConnected = !!this.stateConnectorContract

      let xrplConnected = false
      try {
        const xrpl = await import('xrpl')
        const client = new xrpl.Client(XRPL_CONFIG.server)
        await client.connect()
        await client.disconnect()
        xrplConnected = true
      } catch (error) {
        console.warn('XRPL connection failed:', error)
      }

      return {
        stateConnectorConnected,
        xrplConnected,
        pendingAttestations: this.pendingAttestations.size
      }
    } catch (error) {
      console.error('Health check failed:', error)
      return {
        stateConnectorConnected: false,
        xrplConnected: false,
        pendingAttestations: 0
      }
    }
  }
}

// Export singleton instance
export const flareStateConnector = new FlareStateConnector()
export type { XrplBridgeTransaction, AttestationRequest, AttestationResponse }