const { ethers } = require('ethers')
const logger = require('../utils/logger')

// Import smart contract ABI (you'll need to copy this from your frontend)
const MedicalVaultABI = require('../config/MedicalVault.json')

class BlockchainService {
  constructor() {
    this.provider = null
    this.wallet = null
    this.contract = null
    this.isInitialized = false
    this.config = {
      rpcUrl: process.env.RPC_URL || 'https://rpc-coston2.flare.network',
      contractAddress: process.env.CONTRACT_ADDRESS,
      privateKey: process.env.PRIVATE_KEY,
      chainId: parseInt(process.env.CHAIN_ID) || 114
    }
  }

  /**
   * Initialize blockchain service
   */
  async initialize() {
    if (this.isInitialized) {
      return true
    }

    try {
      logger.info('Initializing blockchain service...')

      // Validate configuration
      if (!this.config.contractAddress) {
        throw new Error('CONTRACT_ADDRESS not configured')
      }

      if (!this.config.privateKey) {
        throw new Error('PRIVATE_KEY not configured')
      }

      // Create provider
      this.provider = new ethers.providers.JsonRpcProvider(this.config.rpcUrl)

      // Test provider connection
      const network = await this.provider.getNetwork()
      logger.info(`Connected to blockchain network: ${network.name} (Chain ID: ${network.chainId})`)

      // Create wallet
      this.wallet = new ethers.Wallet(this.config.privateKey, this.provider)
      logger.info(`Backend wallet address: ${this.wallet.address}`)

      // Create contract instance
      this.contract = new ethers.Contract(
        this.config.contractAddress,
        MedicalVaultABI.abi || MedicalVaultABI,
        this.wallet
      )

      // Test contract connection
      const owner = await this.contract.owner()
      logger.info(`Contract owner: ${owner}`)

      this.isInitialized = true
      logger.info('Blockchain service initialized successfully')
      return true

    } catch (error) {
      logger.error('Blockchain service initialization failed:', error)
      throw error
    }
  }

  /**
   * Upload document metadata to smart contract
   * @param {string} patientId - Patient identifier (bytes32)
   * @param {number} documentType - Document type (0=Diagnosis, 1=Referral, 2=Intake)
   * @param {string} hashURI - IPFS URI of encrypted document
   * @param {Object} options - Transaction options
   * @returns {Object} Transaction result
   */
  async uploadDocument(patientId, documentType, hashURI, options = {}) {
    await this.initialize()

    try {
      logger.info(`Uploading document to blockchain: ${patientId}, type: ${documentType}`)

      // Validate inputs
      if (!ethers.utils.isHexString(patientId, 32)) {
        throw new Error('Invalid patient ID format')
      }

      if (documentType < 0 || documentType > 2) {
        throw new Error('Invalid document type')
      }

      if (!hashURI.startsWith('ipfs://')) {
        throw new Error('Invalid IPFS URI format')
      }

      // Estimate gas
      const gasEstimate = await this.contract.estimateGas.uploadDocumentDeduct(
        patientId,
        documentType,
        hashURI
      )

      // Add 20% buffer to gas estimate
      const gasLimit = gasEstimate.mul(120).div(100)

      // Submit transaction
      const tx = await this.contract.uploadDocumentDeduct(
        patientId,
        documentType,
        hashURI,
        {
          gasLimit,
          ...options
        }
      )

      logger.info(`Upload transaction submitted: ${tx.hash}`)

      // Wait for confirmation
      const receipt = await tx.wait()

      const result = {
        transactionHash: tx.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        status: receipt.status,
        events: receipt.events || []
      }

      // Parse events
      result.parsedEvents = receipt.events?.map(event => {
        try {
          return this.contract.interface.parseLog(event)
        } catch (e) {
          return event
        }
      }) || []

      logger.info(`Document uploaded successfully: ${tx.hash}`)
      return result

    } catch (error) {
      logger.error('Blockchain document upload failed:', error)
      throw new Error(`Blockchain upload failed: ${error.message}`)
    }
  }

  /**
   * Get document metadata from smart contract
   * @param {string} patientId - Patient identifier
   * @param {number} documentType - Document type
   * @returns {Object} Document metadata
   */
  async getDocument(patientId, documentType) {
    await this.initialize()

    try {
      logger.info(`Getting document from blockchain: ${patientId}, type: ${documentType}`)

      const result = await this.contract.getDocument(patientId, documentType)

      const documentData = {
        hashURI: result[0],
        version: result[1].toNumber(),
        updatedAt: new Date(result[2].toNumber() * 1000),
        paymentProof: result[3]
      }

      logger.info(`Document retrieved: version ${documentData.version}`)
      return documentData

    } catch (error) {
      logger.error('Blockchain document retrieval failed:', error)
      throw new Error(`Blockchain retrieval failed: ${error.message}`)
    }
  }

  /**
   * Get document metadata (view function)
   * @param {string} patientId - Patient identifier
   * @param {number} documentType - Document type
   * @returns {Object} Document metadata
   */
  async getDocumentMeta(patientId, documentType) {
    await this.initialize()

    try {
      const result = await this.contract.getDocMeta(patientId, documentType)

      return {
        hashURI: result[0],
        version: result[1].toNumber(),
        updatedAt: new Date(result[2].toNumber() * 1000),
        paymentProof: result[3],
        paidUSDc: result[4].toNumber(),
        paidDrops: result[5].toString(),
        currencyHash: result[6]
      }

    } catch (error) {
      logger.error('Document metadata retrieval failed:', error)
      throw new Error(`Metadata retrieval failed: ${error.message}`)
    }
  }

  /**
   * Check if address has read permission for patient
   * @param {string} patientId - Patient identifier
   * @param {string} address - Address to check
   * @returns {boolean} Has read permission
   */
  async checkReadPermission(patientId, address) {
    await this.initialize()

    try {
      logger.info(`Checking read permission: ${address} for patient ${patientId}`)

      const hasPermission = await this.contract.hasRead(patientId, address)

      logger.info(`Read permission result: ${hasPermission}`)
      return hasPermission

    } catch (error) {
      logger.error('Permission check failed:', error)
      throw new Error(`Permission check failed: ${error.message}`)
    }
  }

  /**
   * Get patient roles
   * @param {string} patientId - Patient identifier
   * @returns {Object} Patient roles
   */
  async getPatientRoles(patientId) {
    await this.initialize()

    try {
      logger.info(`Getting patient roles: ${patientId}`)

      const result = await this.contract.getRoles(patientId)

      const roles = {
        guardian: result[0],
        pediatricPsychologist: result[1],
        insurer: result[2]
      }

      logger.info(`Patient roles retrieved: ${JSON.stringify(roles)}`)
      return roles

    } catch (error) {
      logger.error('Patient roles retrieval failed:', error)
      throw new Error(`Roles retrieval failed: ${error.message}`)
    }
  }

  /**
   * Set patient guardian (admin only)
   * @param {string} patientId - Patient identifier
   * @param {string} guardianAddress - Guardian's wallet address
   * @returns {Object} Transaction result
   */
  async setGuardian(patientId, guardianAddress) {
    await this.initialize()

    try {
      logger.info(`Setting guardian: ${guardianAddress} for patient ${patientId}`)

      const tx = await this.contract.setGuardian(patientId, guardianAddress)
      const receipt = await tx.wait()

      logger.info(`Guardian set successfully: ${tx.hash}`)
      return {
        transactionHash: tx.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString()
      }

    } catch (error) {
      logger.error('Set guardian failed:', error)
      throw new Error(`Set guardian failed: ${error.message}`)
    }
  }

  /**
   * Set pediatric psychologist (admin only)
   * @param {string} patientId - Patient identifier
   * @param {string} psychologistAddress - Psychologist's wallet address
   * @returns {Object} Transaction result
   */
  async setPediatricPsychologist(patientId, psychologistAddress) {
    await this.initialize()

    try {
      logger.info(`Setting psychologist: ${psychologistAddress} for patient ${patientId}`)

      const tx = await this.contract.setPediatricPsychologist(patientId, psychologistAddress)
      const receipt = await tx.wait()

      logger.info(`Psychologist set successfully: ${tx.hash}`)
      return {
        transactionHash: tx.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString()
      }

    } catch (error) {
      logger.error('Set psychologist failed:', error)
      throw new Error(`Set psychologist failed: ${error.message}`)
    }
  }

  /**
   * Set insurer (admin only)
   * @param {string} patientId - Patient identifier
   * @param {string} insurerAddress - Insurer's wallet address
   * @returns {Object} Transaction result
   */
  async setInsurer(patientId, insurerAddress) {
    await this.initialize()

    try {
      logger.info(`Setting insurer: ${insurerAddress} for patient ${patientId}`)

      const tx = await this.contract.setInsurer(patientId, insurerAddress)
      const receipt = await tx.wait()

      logger.info(`Insurer set successfully: ${tx.hash}`)
      return {
        transactionHash: tx.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString()
      }

    } catch (error) {
      logger.error('Set insurer failed:', error)
      throw new Error(`Set insurer failed: ${error.message}`)
    }
  }

  /**
   * Grant read access to address
   * @param {string} patientId - Patient identifier
   * @param {string} readerAddress - Reader's wallet address
   * @param {boolean} allowed - Grant or revoke access
   * @returns {Object} Transaction result
   */
  async grantReadAccess(patientId, readerAddress, allowed = true) {
    await this.initialize()

    try {
      logger.info(`${allowed ? 'Granting' : 'Revoking'} read access: ${readerAddress} for patient ${patientId}`)

      const tx = await this.contract.grantRead(patientId, readerAddress, allowed)
      const receipt = await tx.wait()

      logger.info(`Read access ${allowed ? 'granted' : 'revoked'} successfully: ${tx.hash}`)
      return {
        transactionHash: tx.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString()
      }

    } catch (error) {
      logger.error('Grant read access failed:', error)
      throw new Error(`Grant read access failed: ${error.message}`)
    }
  }

  /**
   * Get contract events within block range
   * @param {number} fromBlock - Starting block number
   * @param {number} toBlock - Ending block number
   * @returns {Array} Contract events
   */
  async getContractEvents(fromBlock = 0, toBlock = 'latest') {
    await this.initialize()

    try {
      logger.info(`Getting contract events from block ${fromBlock} to ${toBlock}`)

      // Get all events
      const filter = {
        address: this.config.contractAddress,
        fromBlock,
        toBlock
      }

      const logs = await this.provider.getLogs(filter)

      // Parse events
      const events = logs.map(log => {
        try {
          const parsed = this.contract.interface.parseLog(log)
          return {
            ...parsed,
            blockNumber: log.blockNumber,
            transactionHash: log.transactionHash,
            address: log.address
          }
        } catch (e) {
          return {
            ...log,
            parsed: false
          }
        }
      })

      logger.info(`Retrieved ${events.length} contract events`)
      return events

    } catch (error) {
      logger.error('Get contract events failed:', error)
      throw new Error(`Get events failed: ${error.message}`)
    }
  }

  /**
   * Get current gas price
   * @returns {Object} Gas price information
   */
  async getGasPrice() {
    await this.initialize()

    try {
      const gasPrice = await this.provider.getGasPrice()

      return {
        gasPrice: gasPrice.toString(),
        gasPriceGwei: ethers.utils.formatUnits(gasPrice, 'gwei')
      }

    } catch (error) {
      logger.error('Get gas price failed:', error)
      throw new Error(`Get gas price failed: ${error.message}`)
    }
  }

  /**
   * Health check for blockchain service
   * @returns {Object} Health status
   */
  async healthCheck() {
    try {
      await this.initialize()

      // Check provider
      const blockNumber = await this.provider.getBlockNumber()
      const network = await this.provider.getNetwork()

      // Check wallet balance
      const balance = await this.wallet.getBalance()

      // Check contract
      const owner = await this.contract.owner()

      return {
        healthy: true,
        blockNumber,
        network: {
          name: network.name,
          chainId: network.chainId
        },
        walletAddress: this.wallet.address,
        walletBalance: ethers.utils.formatEther(balance),
        contractAddress: this.config.contractAddress,
        contractOwner: owner
      }

    } catch (error) {
      logger.error('Blockchain health check failed:', error)
      return {
        healthy: false,
        error: error.message
      }
    }
  }
}

// Export singleton instance
module.exports = new BlockchainService()