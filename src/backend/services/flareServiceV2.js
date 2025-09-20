const { ethers } = require('ethers');
const crypto = require('crypto');

class FlareServiceV2 {
  constructor() {
    this.baseUrl = process.env.FLARE_FDC_URL || 'https://fdc-api.flare.network';
    this.apiKey = process.env.FLARE_API_KEY;
    this.isTestNet = process.env.FLARE_TESTNET === 'true';

    // Flare Coston2 configuration
    this.rpcUrl = process.env.FLARE_RPC_URL || 'https://coston2-api.flare.network/ext/C/rpc';
    this.privateKey = process.env.FLARE_PRIVATE_KEY;

    // Contract addresses (set after deployment)
    this.medicalTokenV2Address = process.env.MEDICAL_TOKEN_V2_ADDRESS;
    this.registryAddress = process.env.MEDICAL_REGISTRY_ADDRESS;
    this.paymentVerifierAddress = process.env.PAYMENT_VERIFIER_ADDRESS;
    this.stateConnectorAddress = process.env.STATE_CONNECTOR_ADDRESS;

    this.provider = null;
    this.signer = null;
    this.medicalTokenV2 = null;
    this.registry = null;
    this.paymentVerifier = null;

    this.initializeContracts();
  }

  async initializeContracts() {
    try {
      this.provider = new ethers.JsonRpcProvider(this.rpcUrl);

      if (this.privateKey) {
        this.signer = new ethers.Wallet(this.privateKey, this.provider);
      }

      // MedicalRecordTokenV2 ABI (enhanced)
      this.medicalTokenV2ABI = [
        "function mintMedicalRecord(address patient, bytes32 fileHash, string memory uri, string memory evaluationType, bytes32 encryptedKey, bytes32 evaluationId) public returns (uint256)",
        "function purchaseAccess(uint256 tokenId, tuple(bytes32 xrplTxHash, bytes flareAttestation, uint256 amount, address destination) proof) external",
        "function getEncryptedKey(uint256 tokenId) external view returns (bytes32)",
        "function hasValidAccess(uint256 tokenId, address hospital) public view returns (bool)",
        "function getMedicalRecord(uint256 tokenId) external view returns (bytes32, address, uint256, string, bool)",
        "function getAccessPermission(uint256 tokenId, address hospital) external view returns (bool, uint256, uint256, uint256, bytes32)",
        "function getPatientTokens(address patient) external view returns (uint256[])",
        "function revokeAccess(uint256 tokenId, address hospital) external",
        "function deactivateRecord(uint256 tokenId) external",
        "event MedicalRecordMinted(uint256 indexed tokenId, address indexed patient, bytes32 fileHash, string evaluationType, bytes32 evaluationId)",
        "event AccessPurchased(uint256 indexed tokenId, address indexed hospital, bytes32 xrplTransactionHash, uint256 amount, uint256 expiresAt)"
      ];

      // Registry ABI
      this.registryABI = [
        "function listEvaluation(bytes32 evaluationId, uint256 tokenId, string memory description, string[] memory tags, uint256 customPrice) external",
        "function purchaseAccessWithSharing(bytes32 evaluationId, tuple(bytes32 xrplTxHash, bytes flareAttestation, uint256 amount, address destination) proof) external",
        "function registerHospital(string memory name, string memory licenseNumber) external",
        "function searchByType(string memory evaluationType) external view returns (bytes32[])",
        "function getEvaluationDetails(bytes32 evaluationId) external view returns (tuple(uint256 tokenId, bytes32 fileHash, string evaluationType, string description, uint256 price, bool isListed, address patient, uint256 listedAt, string[] tags, uint256 accessCount), bool, uint256)",
        "function getPatientEvaluations(address patient) external view returns (bytes32[])",
        "function getVerifiedHospitals() external view returns (address[])",
        "function getEvaluationsPaginated(uint256 offset, uint256 limit) external view returns (bytes32[])",
        "event EvaluationListed(bytes32 indexed evaluationId, uint256 indexed tokenId, address indexed patient, string evaluationType, uint256 price)",
        "event AccessPurchasedViaRegistry(bytes32 indexed evaluationId, uint256 indexed tokenId, address indexed hospital, uint256 amount, bytes32 xrplTxHash)"
      ];

      // Payment Verifier ABI
      this.paymentVerifierABI = [
        "function verifyXRPLPayment(bytes32 transactionId, uint256 expectedAmount, bytes32 expectedDestination, tuple(bytes32 attestationType, bytes32 sourceId, uint64 votingRound, uint64 lowestUsedTimestamp, bytes requestBody, bytes responseBody) attestation, bytes32[] merkleProof) external view returns (bool, tuple(bytes32 transactionId, uint64 blockNumber, uint64 blockTimestamp, bytes32 sourceAddress, bytes32 receivingAddress, uint256 receivedAmount, bytes32 paymentReference, uint8 status))",
        "function verifyPaymentSimple(bytes32 transactionId, uint256 expectedAmount, bytes32 expectedDestination, bytes encodedResponse) external pure returns (bool, tuple(bytes32 transactionId, uint64 blockNumber, uint64 blockTimestamp, bytes32 sourceAddress, bytes32 receivingAddress, uint256 receivedAmount, bytes32 paymentReference, uint8 status))",
        "function addressToBytes32(string memory xrplAddress) external pure returns (bytes32)"
      ];

      // Initialize contracts
      if (this.medicalTokenV2Address && this.signer) {
        this.medicalTokenV2 = new ethers.Contract(this.medicalTokenV2Address, this.medicalTokenV2ABI, this.signer);
        console.log('✅ MedicalTokenV2 contract initialized');
      }

      if (this.registryAddress && this.signer) {
        this.registry = new ethers.Contract(this.registryAddress, this.registryABI, this.signer);
        console.log('✅ Medical Registry contract initialized');
      }

      if (this.paymentVerifierAddress && this.signer) {
        this.paymentVerifier = new ethers.Contract(this.paymentVerifierAddress, this.paymentVerifierABI, this.signer);
        console.log('✅ Payment Verifier contract initialized');
      }

    } catch (error) {
      console.error('❌ Failed to initialize FlareV2 contracts:', error);
    }
  }

  /**
   * Enhanced NFT minting with encrypted key storage and auto-listing
   */
  async mintMedicalRecordEnhanced(patientAddress, fileHash, ipfsUri, evaluationType, encryptionKey, description, tags) {
    try {
      if (!this.medicalTokenV2) {
        throw new Error('MedicalTokenV2 contract not deployed');
      }

      // Generate evaluation ID
      const evaluationId = this.generateEvaluationId(fileHash, patientAddress);

      // Encrypt the file decryption key
      const encryptedKey = this.encryptFileKey(encryptionKey);

      // Mint NFT with encrypted key
      const tx = await this.medicalTokenV2.mintMedicalRecord(
        patientAddress,
        ethers.keccak256(ethers.toUtf8Bytes(fileHash)),
        ipfsUri,
        evaluationType,
        encryptedKey,
        evaluationId
      );

      const receipt = await tx.wait();

      // Find the minting event
      const mintEvent = receipt.logs.find(log => {
        try {
          const parsedLog = this.medicalTokenV2.interface.parseLog(log);
          return parsedLog.name === 'MedicalRecordMinted';
        } catch (e) {
          return false;
        }
      });

      let tokenId = null;
      if (mintEvent) {
        const parsedLog = this.medicalTokenV2.interface.parseLog(mintEvent);
        tokenId = parsedLog.args.tokenId.toString();
      }

      // Auto-list in registry if available
      if (this.registry && tokenId) {
        try {
          await this.listEvaluationInRegistry(evaluationId, tokenId, description, tags);
        } catch (error) {
          console.warn('⚠️ Failed to auto-list in registry:', error.message);
        }
      }

      return {
        success: true,
        tokenId,
        evaluationId,
        transactionHash: tx.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        ipfsUri,
        encryptedKey
      };

    } catch (error) {
      console.error('Error minting enhanced medical record NFT:', error);
      throw error;
    }
  }

  /**
   * Trustless access purchase using on-chain verification
   */
  async purchaseAccessTrustless(tokenId, xrplTransactionHash, expectedAmount, hospitalAddress) {
    try {
      if (!this.medicalTokenV2) {
        throw new Error('MedicalTokenV2 contract not deployed');
      }

      // Get XRPL payment verification from Flare FDC
      const paymentVerification = await this.getFlarePaymentProof(xrplTransactionHash, expectedAmount);

      if (!paymentVerification.isValid) {
        throw new Error('Payment verification failed');
      }

      // Convert XRPL destination to bytes32
      const destinationBytes32 = await this.paymentVerifier.addressToBytes32(
        process.env.PLATFORM_WALLET_ADDRESS
      );

      // Prepare payment proof structure
      const paymentProof = {
        xrplTxHash: ethers.keccak256(ethers.toUtf8Bytes(xrplTransactionHash)),
        flareAttestation: paymentVerification.attestationData,
        amount: expectedAmount * 1_000_000, // Convert XRP to drops
        destination: destinationBytes32
      };

      // Purchase access on-chain
      const tx = await this.medicalTokenV2.purchaseAccess(tokenId, paymentProof);
      const receipt = await tx.wait();

      return {
        success: true,
        transactionHash: tx.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        accessExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        paymentVerification
      };

    } catch (error) {
      console.error('Error purchasing trustless access:', error);
      throw error;
    }
  }

  /**
   * Get encrypted file key (for authorized hospitals)
   */
  async getEncryptedFileKey(tokenId, hospitalAddress) {
    try {
      if (!this.medicalTokenV2) {
        throw new Error('MedicalTokenV2 contract not deployed');
      }

      // Check if hospital has valid access
      const hasAccess = await this.medicalTokenV2.hasValidAccess(tokenId, hospitalAddress);
      if (!hasAccess) {
        throw new Error('Hospital does not have valid access');
      }

      // Get encrypted key from contract
      const encryptedKey = await this.medicalTokenV2.getEncryptedKey(tokenId);

      // Decrypt the file key (hospital would do this with their private key)
      const decryptedKey = this.decryptFileKey(encryptedKey);

      return {
        success: true,
        encryptedKey,
        decryptedKey, // In production, only return encrypted key
        hasAccess
      };

    } catch (error) {
      console.error('Error getting encrypted file key:', error);
      throw error;
    }
  }

  /**
   * List evaluation in registry for discovery
   */
  async listEvaluationInRegistry(evaluationId, tokenId, description, tags, customPrice = 0) {
    try {
      if (!this.registry) {
        throw new Error('Registry contract not deployed');
      }

      const tx = await this.registry.listEvaluation(
        evaluationId,
        tokenId,
        description,
        tags,
        customPrice
      );

      const receipt = await tx.wait();

      return {
        success: true,
        evaluationId,
        transactionHash: tx.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString()
      };

    } catch (error) {
      console.error('Error listing evaluation in registry:', error);
      throw error;
    }
  }

  /**
   * Search evaluations by type
   */
  async searchEvaluations(evaluationType, offset = 0, limit = 20) {
    try {
      if (!this.registry) {
        throw new Error('Registry contract not deployed');
      }

      let evaluationIds;

      if (evaluationType) {
        evaluationIds = await this.registry.searchByType(evaluationType);
      } else {
        evaluationIds = await this.registry.getEvaluationsPaginated(offset, limit);
      }

      // Get detailed information for each evaluation
      const evaluations = [];
      for (const evaluationId of evaluationIds) {
        try {
          const [details, hasValidListing, patientTokenCount] = await this.registry.getEvaluationDetails(evaluationId);

          if (hasValidListing) {
            evaluations.push({
              evaluationId,
              tokenId: details.tokenId.toString(),
              fileHash: details.fileHash,
              evaluationType: details.evaluationType,
              description: details.description,
              price: details.price.toString(),
              patient: details.patient,
              listedAt: new Date(Number(details.listedAt) * 1000).toISOString(),
              tags: details.tags,
              accessCount: details.accessCount.toString(),
              patientTokenCount: patientTokenCount.toString()
            });
          }
        } catch (error) {
          console.warn(`Failed to get details for evaluation ${evaluationId}:`, error.message);
        }
      }

      return {
        success: true,
        evaluations,
        total: evaluationIds.length
      };

    } catch (error) {
      console.error('Error searching evaluations:', error);
      throw error;
    }
  }

  /**
   * Register hospital in the registry
   */
  async registerHospital(hospitalAddress, name, licenseNumber) {
    try {
      if (!this.registry) {
        throw new Error('Registry contract not deployed');
      }

      // Create hospital signer
      const hospitalSigner = new ethers.Wallet(hospitalAddress, this.provider);
      const registryWithHospitalSigner = this.registry.connect(hospitalSigner);

      const tx = await registryWithHospitalSigner.registerHospital(name, licenseNumber);
      const receipt = await tx.wait();

      return {
        success: true,
        hospitalAddress: hospitalSigner.address,
        transactionHash: tx.hash,
        blockNumber: receipt.blockNumber
      };

    } catch (error) {
      console.error('Error registering hospital:', error);
      throw error;
    }
  }

  // Utility functions

  generateEvaluationId(fileHash, patientAddress) {
    return ethers.keccak256(
      ethers.solidityPacked(['string', 'address', 'uint256'], [fileHash, patientAddress, Date.now()])
    );
  }

  encryptFileKey(key) {
    // In production, use proper encryption with hospital's public key
    const cipher = crypto.createCipher('aes-256-cbc', process.env.ENCRYPTION_SECRET || 'default-secret');
    let encrypted = cipher.update(key, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return ethers.keccak256(ethers.toUtf8Bytes(encrypted));
  }

  decryptFileKey(encryptedKey) {
    // In production, hospital would decrypt with their private key
    try {
      const decipher = crypto.createDecipher('aes-256-cbc', process.env.ENCRYPTION_SECRET || 'default-secret');
      let decrypted = decipher.update(encryptedKey.slice(2), 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error) {
      console.error('Decryption failed:', error);
      return null;
    }
  }

  async getFlarePaymentProof(xrplTransactionHash, expectedAmount) {
    try {
      // Use existing FDC verification logic
      const verificationRequest = {
        attestationType: 'Payment',
        sourceId: 'XRPL',
        requestBody: {
          transactionId: xrplTransactionHash,
          inUtxo: '0',
          utxo: '0'
        }
      };

      const response = await this.submitFDCRequest(verificationRequest);

      return {
        isValid: response.status === 'VALID',
        attestationData: ethers.toUtf8Bytes(JSON.stringify(response.attestation)),
        verificationHash: response.attestationHash,
        flareResponse: response
      };

    } catch (error) {
      console.error('Flare payment proof error:', error);
      return {
        isValid: false,
        error: error.message
      };
    }
  }

  async submitFDCRequest(requestBody) {
    // Reuse existing FDC request logic
    const axios = require('axios');

    try {
      const config = {
        method: 'post',
        url: `${this.baseUrl}/attestation-client/api/proof/get-specific-proof`,
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey || ''
        },
        data: requestBody,
        timeout: 30000
      };

      const response = await axios(config);
      return response.data;
    } catch (error) {
      console.error('FDC request failed:', error.message);
      throw new Error(`Flare FDC service unavailable: ${error.message}`);
    }
  }

  // Network and status functions

  getNetworkInfo() {
    return {
      baseUrl: this.baseUrl,
      isTestNet: this.isTestNet,
      hasApiKey: !!this.apiKey,
      flareRpc: this.rpcUrl,
      medicalTokenV2Address: this.medicalTokenV2Address,
      registryAddress: this.registryAddress,
      paymentVerifierAddress: this.paymentVerifierAddress,
      hasContracts: !!(this.medicalTokenV2 && this.registry && this.paymentVerifier)
    };
  }

  isConnected() {
    return !!(this.provider && this.signer);
  }
}

module.exports = new FlareServiceV2();