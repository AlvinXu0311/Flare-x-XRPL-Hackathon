const { ethers } = require('ethers');
const flareService = require('./flareService');
const xrplService = require('./xrplService');

class FlareRegistryService {
  constructor() {
    this.provider = null;
    this.registryContract = null;
    this.wallet = null;

    // Flare Testnet/Mainnet configuration
    this.rpcUrl = process.env.FLARE_RPC_URL || 'https://coston2-api.flare.network/ext/bc/C/rpc';
    this.registryAddress = process.env.FLARE_REGISTRY_CONTRACT;
    this.privateKey = process.env.FLARE_PRIVATE_KEY;

    // Simplified registry for basic functionality
    this.registryABI = [];
  }

  async initialize() {
    try {
      // Initialize Flare connection
      this.provider = new ethers.JsonRpcProvider(this.rpcUrl);

      if (this.privateKey) {
        this.wallet = new ethers.Wallet(this.privateKey, this.provider);
      }

      if (this.registryAddress) {
        this.registryContract = new ethers.Contract(
          this.registryAddress,
          this.registryABI,
          this.wallet || this.provider
        );
      }

      console.log('✅ Flare Registry Service initialized');
      console.log(`🌐 Network: ${this.rpcUrl}`);
      console.log(`📄 Registry Contract: ${this.registryAddress || 'Not deployed'}`);

      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Flare Registry Service:', error);
      throw error;
    }
  }

  /**
   * Register medical NFT on Flare registry after XRPL minting
   */
  async registerMedicalNFT(nftData) {
    try {
      if (!this.registryContract || !this.wallet) {
        throw new Error('Flare registry contract not deployed or wallet not configured');
      }

      // Verify XRPL NFT exists first using Flare State Connector
      const xrplVerification = await this.verifyXRPLNFTExists(nftData.nftTokenId);

      if (!xrplVerification.isValid) {
        throw new Error('XRPL NFT verification failed');
      }

      // Prepare patient info (anonymized for on-chain storage)
      const patientInfo = JSON.stringify({
        evaluationType: nftData.patientInfo.evaluationType,
        dateOfBirth: nftData.patientInfo.dateOfBirth.substring(0, 7), // Year-month only
        uploadDate: nftData.fileMetadata.uploadDate
      });

      // Register on Flare
      const tx = await this.registryContract.registerMedicalNFT(
        nftData.nftTokenId,
        nftData.fileHash,
        nftData.evaluationId,
        patientInfo,
        ethers.ZeroAddress // Allow any authorized hospital for now
      );

      const receipt = await tx.wait();

      return {
        success: true,
        flareTransactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        registryAddress: this.registryAddress,
        xrplVerification
      };

    } catch (error) {
      console.error('Error registering NFT on Flare:', error);
      throw error;
    }
  }

  /**
   * Hospital queries registry to find file using evaluation ID or NFT token
   */
  async getFileLocation(evaluationId, hospitalAddress) {
    try {
      if (!this.registryContract) {
        throw new Error('Flare registry contract not deployed');
      }

      // Verify hospital has access
      const hasAccess = await this.registryContract.verifyHospitalAccess(
        evaluationId,
        hospitalAddress
      );

      if (!hasAccess) {
        throw new Error('Hospital not authorized for this evaluation');
      }

      // Get file location from registry
      const [s3Key, encryptionKey, xrplNftId] = await this.registryContract.getFileLocation(evaluationId);

      // Double-verify using Flare State Connector
      const verification = await flareService.verifyXRPLTransaction(
        xrplNftId,
        0, // Not checking amount for NFT
        xrplService.getPlatformAddress()
      );

      return {
        s3Key,
        encryptionKey,
        xrplNftId,
        verification: verification.isValid,
        flareVerificationHash: verification.verificationHash
      };

    } catch (error) {
      console.error('Error getting file location:', error);
      throw error;
    }
  }

  /**
   * Use Flare State Connector to verify XRPL NFT exists
   */
  async verifyXRPLNFTExists(nftTokenId) {
    try {
      // Create verification request for XRPL NFT
      const verificationRequest = {
        attestationType: 'ConfirmedBlockHeightExists',
        sourceId: 'XRPL',
        requestBody: {
          blockNumber: '0', // Latest
          queryData: nftTokenId
        }
      };

      const response = await flareService.submitFDCRequest(verificationRequest);

      return {
        isValid: response.status === 'VALID',
        nftTokenId,
        flareResponse: response,
        verificationHash: response.attestationHash
      };

    } catch (error) {
      console.error('XRPL NFT verification error:', error);
      return {
        isValid: false,
        error: error.message
      };
    }
  }

  /**
   * Create open source registry index for hospitals
   */
  async createPublicIndex() {
    try {
      if (!this.registryContract) {
        throw new Error('Flare registry contract not deployed');
      }

      // Get all medical records from the registry
      const filter = this.registryContract.filters.MedicalRecordRegistered();
      const events = await this.registryContract.queryFilter(filter);

      const publicIndex = events.map(event => ({
        evaluationId: event.args.evaluationId,
        fileHash: event.args.fileHash,
        timestamp: event.args.timestamp,
        blockNumber: event.blockNumber,
        transactionHash: event.transactionHash,
        // Note: No patient PII exposed
        available: true
      }));

      return {
        totalRecords: publicIndex.length,
        registryAddress: this.registryAddress,
        lastUpdate: new Date().toISOString(),
        records: publicIndex
      };

    } catch (error) {
      console.error('Error creating public index:', error);
      throw error;
    }
  }

  /**
   * Hospital authentication and token generation
   */
  async generateHospitalAccessToken(hospitalAddress, evaluationId) {
    try {
      // Verify hospital is authorized (could be payment-based, reputation-based, etc.)
      const verification = await this.verifyHospitalCredentials(hospitalAddress);

      if (!verification.isValid) {
        throw new Error('Hospital credentials invalid');
      }

      // Generate time-limited access token
      const tokenData = {
        hospitalAddress,
        evaluationId,
        grantedAt: Date.now(),
        expiresAt: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
        permissions: ['read_file', 'verify_authenticity']
      };

      // Sign token with Flare wallet
      const messageHash = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(tokenData)));
      const signature = await this.wallet.signMessage(ethers.getBytes(messageHash));

      return {
        token: Buffer.from(JSON.stringify(tokenData)).toString('base64'),
        signature,
        validUntil: new Date(tokenData.expiresAt).toISOString()
      };

    } catch (error) {
      console.error('Error generating hospital access token:', error);
      throw error;
    }
  }

  async verifyHospitalCredentials(hospitalAddress) {
    // In production, this would verify:
    // 1. Hospital registration on Flare
    // 2. Medical license verification
    // 3. Previous payment history
    // 4. Reputation scores

    throw new Error('Hospital credential verification not implemented - requires license verification system');
  }


  isConnected() {
    return !!this.provider;
  }

  getNetworkInfo() {
    return {
      rpcUrl: this.rpcUrl,
      registryAddress: this.registryAddress,
      hasWallet: !!this.wallet,
      isConnected: this.isConnected()
    };
  }
}

module.exports = new FlareRegistryService();