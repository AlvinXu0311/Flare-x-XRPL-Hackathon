const axios = require('axios');
const crypto = require('crypto');
const { ethers } = require('ethers');

class FlareService {
  constructor() {
    this.baseUrl = process.env.FLARE_FDC_URL || 'https://fdc-api.flare.network';
    this.apiKey = process.env.FLARE_API_KEY;
    this.isTestNet = process.env.FLARE_TESTNET === 'true';

    // Flare Coston2 configuration
    this.rpcUrl = process.env.FLARE_RPC_URL || 'https://coston2-api.flare.network/ext/C/rpc';
    this.contractAddress = process.env.MEDICAL_RECORD_CONTRACT_ADDRESS;
    this.privateKey = process.env.FLARE_PRIVATE_KEY;

    this.provider = null;
    this.contract = null;
    this.signer = null;

    this.initializeContract();
  }

  async initializeContract() {
    try {
      this.provider = new ethers.JsonRpcProvider(this.rpcUrl);

      if (this.privateKey) {
        this.signer = new ethers.Wallet(this.privateKey, this.provider);
      }

      // Medical Record Token ABI
      this.contractABI = [
        "function mintMedicalRecord(address patient, bytes32 fileHash, string memory tokenURI, string memory evaluationType) public returns (uint256)",
        "function grantAccess(uint256 tokenId, address hospital, bytes32 xrplTransactionHash, uint256 accessDuration) public",
        "function hasValidAccess(uint256 tokenId, address hospital) public view returns (bool)",
        "function getMedicalRecord(uint256 tokenId) public view returns (bytes32, address, uint256, string, bool)",
        "function getAccessPermission(uint256 tokenId, address hospital) public view returns (bool, uint256, uint256, uint256, bytes32)",
        "function getPatientTokens(address patient) public view returns (uint256[])",
        "function revokeAccess(uint256 tokenId, address hospital) public",
        "function deactivateRecord(uint256 tokenId) public",
        "event MedicalRecordMinted(uint256 indexed tokenId, address indexed patient, bytes32 fileHash, string evaluationType)",
        "event AccessGranted(uint256 indexed tokenId, address indexed hospital, uint256 expiresAt, bytes32 xrplTransactionHash)"
      ];

      if (this.contractAddress && this.signer) {
        this.contract = new ethers.Contract(this.contractAddress, this.contractABI, this.signer);
        console.log('✅ Flare smart contract initialized');
      } else {
        console.log('⚠️ Flare contract not fully initialized - missing address or private key');
      }

    } catch (error) {
      console.error('❌ Failed to initialize Flare contract:', error);
    }
  }

  async verifyXRPLTransaction(transactionHash, expectedAmount, expectedDestination) {
    try {
      const verificationRequest = {
        attestationType: 'Payment',
        sourceId: 'XRPL',
        requestBody: {
          transactionId: transactionHash,
          inUtxo: '0',
          utxo: '0'
        }
      };

      const response = await this.submitFDCRequest(verificationRequest);

      if (response.status === 'VALID') {
        const paymentData = this.parsePaymentAttestation(response.attestation);

        const verification = {
          isValid: true,
          transactionHash: paymentData.transactionId,
          amount: paymentData.amount,
          source: paymentData.source,
          destination: paymentData.destination,
          timestamp: paymentData.timestamp,
          blockNumber: paymentData.blockNumber,
          verificationHash: response.attestationHash,
          flareResponse: response
        };

        if (paymentData.destination !== expectedDestination) {
          verification.isValid = false;
          verification.error = 'Destination address mismatch';
        }

        if (parseFloat(paymentData.amount) < expectedAmount) {
          verification.isValid = false;
          verification.error = 'Insufficient payment amount';
        }

        return verification;
      } else {
        return {
          isValid: false,
          error: 'Transaction not verified by Flare FDC',
          status: response.status,
          flareResponse: response
        };
      }
    } catch (error) {
      console.error('Flare FDC verification error:', error);
      return {
        isValid: false,
        error: error.message || 'FDC verification failed',
        details: error.response?.data
      };
    }
  }

  async submitFDCRequest(requestBody) {
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


  parsePaymentAttestation(attestation) {
    const responseBody = attestation.responseBody;

    return {
      transactionId: responseBody.transactionId,
      amount: (parseInt(responseBody.receivedAmount) / 1000000).toString(),
      source: responseBody.sourceAddress,
      destination: responseBody.receivingAddress,
      timestamp: responseBody.blockTimestamp,
      blockNumber: responseBody.blockNumber,
      paymentReference: responseBody.paymentReference,
      status: responseBody.status
    };
  }

  async verifyPaymentChain(transactionHash, evaluationId, expectedAmount) {
    try {
      const verification1 = await this.verifyXRPLTransaction(
        transactionHash,
        expectedAmount,
        process.env.PLATFORM_WALLET_ADDRESS
      );

      if (!verification1.isValid) {
        return verification1;
      }

      const secondaryVerification = await this.performSecondaryVerification(
        transactionHash,
        evaluationId
      );

      return {
        isValid: verification1.isValid && secondaryVerification.isValid,
        primaryVerification: verification1,
        secondaryVerification: secondaryVerification,
        overallHash: this.generateOverallHash([
          verification1.verificationHash,
          secondaryVerification.verificationHash
        ])
      };
    } catch (error) {
      console.error('Payment chain verification error:', error);
      return {
        isValid: false,
        error: error.message,
        details: error
      };
    }
  }

  async performSecondaryVerification(transactionHash, evaluationId) {
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));

      const verificationData = {
        transactionHash,
        evaluationId,
        timestamp: new Date().toISOString(),
        verifier: 'secondary-flare-node'
      };

      const verificationHash = crypto
        .createHash('sha256')
        .update(JSON.stringify(verificationData))
        .digest('hex');

      return {
        isValid: true,
        verificationHash,
        timestamp: new Date().toISOString(),
        verifier: 'secondary-flare-node',
        data: verificationData
      };
    } catch (error) {
      return {
        isValid: false,
        error: error.message
      };
    }
  }

  generateOverallHash(hashes) {
    const combined = hashes.sort().join('');
    return crypto.createHash('sha256').update(combined).digest('hex');
  }

  async getVerificationStatus(verificationHash) {
    try {
      const config = {
        method: 'get',
        url: `${this.baseUrl}/attestation-client/api/proof/get-proof-status/${verificationHash}`,
        headers: {
          'X-API-Key': this.apiKey || ''
        },
        timeout: 10000
      };

      const response = await axios(config);
      return response.data;
    } catch (error) {
      console.error('Verification status error:', error.message);
      throw new Error(`Failed to get verification status: ${error.message}`);
    }
  }

  async batchVerifyTransactions(transactions) {
    try {
      const verifications = await Promise.all(
        transactions.map(tx => this.verifyXRPLTransaction(
          tx.hash,
          tx.expectedAmount,
          tx.expectedDestination
        ))
      );

      return verifications.map((verification, index) => ({
        transactionHash: transactions[index].hash,
        ...verification
      }));
    } catch (error) {
      console.error('Batch verification error:', error);
      throw error;
    }
  }

  isConnected() {
    return !!this.baseUrl;
  }

  // Medical Record Tokenization Methods

  /**
   * Mint a new medical record NFT on Flare
   * @param {string} patientAddress - Patient's Ethereum address
   * @param {string} fileHash - SHA-256 hash of the medical file
   * @param {string} ipfsUri - IPFS URI containing metadata
   * @param {string} evaluationType - Type of evaluation (ADOS, ADI-R, etc.)
   */
  async mintMedicalRecordNFT(patientAddress, fileHash, ipfsUri, evaluationType) {
    try {
      if (!this.contract) {
        throw new Error('Medical record smart contract not deployed - set MEDICAL_RECORD_CONTRACT_ADDRESS and FLARE_PRIVATE_KEY in environment');
      }


      const fileHashBytes32 = ethers.keccak256(ethers.toUtf8Bytes(fileHash));

      const tx = await this.contract.mintMedicalRecord(
        patientAddress,
        fileHashBytes32,
        ipfsUri,
        evaluationType
      );

      const receipt = await tx.wait();

      // Find the MedicalRecordMinted event
      const mintEvent = receipt.logs.find(log => {
        try {
          const parsedLog = this.contract.interface.parseLog(log);
          return parsedLog.name === 'MedicalRecordMinted';
        } catch (e) {
          return false;
        }
      });

      let tokenId = null;
      if (mintEvent) {
        const parsedLog = this.contract.interface.parseLog(mintEvent);
        tokenId = parsedLog.args.tokenId.toString();
      }

      return {
        success: true,
        tokenId,
        transactionHash: tx.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        ipfsUri,
        fileHash: fileHashBytes32
      };

    } catch (error) {
      console.error('Error minting medical record NFT:', error);
      throw error;
    }
  }

  /**
   * Grant access to a hospital after XRPL payment verification
   * @param {string} tokenId - Medical record token ID
   * @param {string} hospitalAddress - Hospital's Ethereum address
   * @param {string} xrplTransactionHash - XRPL payment transaction hash
   * @param {number} accessDurationHours - Duration of access in hours (default 30 days)
   */
  async grantHospitalAccess(tokenId, hospitalAddress, xrplTransactionHash, accessDurationHours = 720) {
    try {
      if (!this.contract) {
        throw new Error('Medical record smart contract not deployed');
      }


      const accessDurationSeconds = accessDurationHours * 60 * 60;
      const xrplHashBytes32 = ethers.keccak256(ethers.toUtf8Bytes(xrplTransactionHash));

      const tx = await this.contract.grantAccess(
        tokenId,
        hospitalAddress,
        xrplHashBytes32,
        accessDurationSeconds
      );

      const receipt = await tx.wait();

      return {
        success: true,
        transactionHash: tx.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        accessGrantedUntil: new Date(Date.now() + accessDurationSeconds * 1000).toISOString()
      };

    } catch (error) {
      console.error('Error granting hospital access:', error);
      throw error;
    }
  }

  /**
   * Check if a hospital has valid access to a medical record
   * @param {string} tokenId - Medical record token ID
   * @param {string} hospitalAddress - Hospital's Ethereum address
   */
  async checkHospitalAccess(tokenId, hospitalAddress) {
    try {
      if (!this.contract) {
        throw new Error('Medical record smart contract not deployed');
      }


      const hasAccess = await this.contract.hasValidAccess(tokenId, hospitalAddress);
      let accessDetails = null;

      if (hasAccess) {
        const permission = await this.contract.getAccessPermission(tokenId, hospitalAddress);
        accessDetails = {
          hasAccess: permission[0],
          grantedAt: new Date(Number(permission[1]) * 1000).toISOString(),
          expiresAt: new Date(Number(permission[2]) * 1000).toISOString(),
          paymentAmount: ethers.formatEther(permission[3]),
          xrplTransactionHash: permission[4]
        };
      }

      return {
        hasAccess,
        accessDetails
      };

    } catch (error) {
      console.error('Error checking hospital access:', error);
      throw error;
    }
  }

  /**
   * Get medical record details from the blockchain
   * @param {string} tokenId - Medical record token ID
   */
  async getMedicalRecordDetails(tokenId) {
    try {
      if (!this.contract) {
        throw new Error('Medical record smart contract not deployed');
      }


      const record = await this.contract.getMedicalRecord(tokenId);

      return {
        fileHash: record[0],
        patientAddress: record[1],
        createdAt: new Date(Number(record[2]) * 1000).toISOString(),
        evaluationType: record[3],
        isActive: record[4]
      };

    } catch (error) {
      console.error('Error getting medical record details:', error);
      throw error;
    }
  }

  /**
   * Get all medical record tokens for a patient
   * @param {string} patientAddress - Patient's Ethereum address
   */
  async getPatientMedicalRecords(patientAddress) {
    try {
      if (!this.contract) {
        throw new Error('Medical record smart contract not deployed');
      }


      const tokenIds = await this.contract.getPatientTokens(patientAddress);

      const records = await Promise.all(
        tokenIds.map(async (tokenId) => {
          try {
            const details = await this.getMedicalRecordDetails(tokenId.toString());
            return {
              tokenId: tokenId.toString(),
              ...details
            };
          } catch (error) {
            console.error(`Error getting details for token ${tokenId}:`, error);
            return null;
          }
        })
      );

      return records.filter(record => record !== null);

    } catch (error) {
      console.error('Error getting patient medical records:', error);
      throw error;
    }
  }

  /**
   * Create IPFS metadata for medical record
   * @param {Object} medicalData - Medical record data
   */
  createMedicalRecordMetadata(medicalData) {
    return {
      name: `Medical Evaluation - ${medicalData.patientName}`,
      description: `${medicalData.evaluationType} evaluation for autism spectrum disorder`,
      image: "ipfs://QmYourImageHash", // Placeholder for medical record icon
      attributes: [
        {
          trait_type: "Evaluation Type",
          value: medicalData.evaluationType
        },
        {
          trait_type: "Upload Date",
          value: medicalData.uploadDate
        },
        {
          trait_type: "Patient ID",
          value: medicalData.patientId || "Anonymous"
        },
        {
          trait_type: "File Hash",
          value: medicalData.fileHash
        },
        {
          trait_type: "Platform",
          value: "XRPL Medical Records"
        }
      ],
      properties: {
        fileHash: medicalData.fileHash,
        encrypted: true,
        storageType: "AWS S3 + IPFS",
        accessControlled: true
      }
    };
  }


  /**
   * Deploy MedicalRecordToken smart contract to Flare Coston2
   * @param {string} deploymentPrivateKey - Private key with testnet FLR for gas
   */
  async deployMedicalRecordContract(deploymentPrivateKey) {
    try {
      console.log('🚀 Deploying MedicalRecordToken smart contract...');

      if (!this.provider) {
        throw new Error('Flare provider not initialized');
      }

      // Create deployment wallet
      const deploymentWallet = new ethers.Wallet(deploymentPrivateKey, this.provider);
      console.log(`📋 Deployment wallet: ${deploymentWallet.address}`);

      // Check wallet balance
      const balance = await this.provider.getBalance(deploymentWallet.address);
      console.log(`💰 Wallet balance: ${ethers.formatEther(balance)} FLR`);

      if (balance === 0n) {
        throw new Error('Deployment wallet has no testnet FLR. Get free testnet FLR from https://coston2-faucet.towolabs.com/');
      }

      // Use HardhatDeployer utility for real deployment
      const HardhatDeployer = require('../utils/hardhatDeployer');
      const deployer = new HardhatDeployer();

      // Deploy using Hardhat with progress callback
      const deploymentResult = await deployer.deployContract(deploymentPrivateKey, (progress) => {
        console.log(`📊 Deployment progress: ${progress.step} - ${progress.message}`);
      });

      if (!deploymentResult.success) {
        throw new Error(`Contract deployment failed: ${deploymentResult.error}`);
      }

      const contractAddress = deploymentResult.contractAddress;

      console.log(`✅ Contract deployed successfully to: ${contractAddress}`);

      // Update the service configuration
      this.contractAddress = contractAddress;
      this.contract = new ethers.Contract(contractAddress, this.contractABI, deploymentWallet);

      // Update environment variables for persistence
      process.env.MEDICAL_RECORD_CONTRACT_ADDRESS = contractAddress;
      process.env.FLARE_PRIVATE_KEY = deploymentPrivateKey;

      console.log('✅ Flare service updated with deployed contract');

      return {
        success: true,
        contractAddress,
        network: deploymentResult.network,
        deploymentOutput: deploymentResult.deploymentOutput
      };

    } catch (error) {
      console.error('❌ Contract deployment failed:', error.message);
      throw error;
    }
  }

  /**
   * Deploy MedicalRecordToken smart contract with progress updates
   * @param {string} deploymentPrivateKey - Private key with testnet FLR for gas
   * @param {function} progressCallback - Callback function for progress updates
   */
  async deployMedicalRecordContractWithProgress(deploymentPrivateKey, progressCallback) {
    try {
      console.log('🚀 Deploying MedicalRecordToken smart contract with progress...');

      if (progressCallback) {
        progressCallback('initializing', 'Initializing deployment process...');
      }

      if (!this.provider) {
        throw new Error('Flare provider not initialized');
      }

      if (progressCallback) {
        progressCallback('wallet_check', 'Checking deployment wallet...');
      }

      // Create deployment wallet
      const deploymentWallet = new ethers.Wallet(deploymentPrivateKey, this.provider);
      console.log(`📋 Deployment wallet: ${deploymentWallet.address}`);

      // Check wallet balance
      const balance = await this.provider.getBalance(deploymentWallet.address);
      console.log(`💰 Wallet balance: ${ethers.formatEther(balance)} FLR`);

      if (balance === 0n) {
        throw new Error('Deployment wallet has no testnet FLR. Get free testnet FLR from https://coston2-faucet.towolabs.com/');
      }

      // Use HardhatDeployer utility for real deployment
      const HardhatDeployer = require('../utils/hardhatDeployer');
      const deployer = new HardhatDeployer();

      // Deploy using Hardhat with progress callback
      const deploymentResult = await deployer.deployContract(deploymentPrivateKey, (progress) => {
        console.log(`📊 Deployment progress: ${progress.step} - ${progress.message}`);
        if (progressCallback) {
          progressCallback(progress.step, progress.message);
        }
      });

      if (!deploymentResult.success) {
        throw new Error(`Contract deployment failed: ${deploymentResult.error}`);
      }

      const contractAddress = deploymentResult.contractAddress;

      console.log(`✅ Contract deployed successfully to: ${contractAddress}`);

      // Update the service configuration
      this.contractAddress = contractAddress;
      this.contract = new ethers.Contract(contractAddress, this.contractABI, deploymentWallet);

      // Update environment variables for persistence
      process.env.MEDICAL_RECORD_CONTRACT_ADDRESS = contractAddress;
      process.env.FLARE_PRIVATE_KEY = deploymentPrivateKey;

      console.log('✅ Flare service updated with deployed contract');

      return {
        success: true,
        contractAddress,
        network: deploymentResult.network,
        deploymentOutput: deploymentResult.deploymentOutput
      };

    } catch (error) {
      console.error('❌ Contract deployment failed:', error.message);
      if (progressCallback) {
        progressCallback('error', `Deployment failed: ${error.message}`);
      }
      throw error;
    }
  }

  getNetworkInfo() {
    return {
      baseUrl: this.baseUrl,
      isTestNet: this.isTestNet,
      hasApiKey: !!this.apiKey,
      flareRpc: this.rpcUrl,
      contractAddress: this.contractAddress,
      hasContract: !!this.contract
    };
  }
}

module.exports = new FlareService();