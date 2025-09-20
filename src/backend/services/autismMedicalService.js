const { ethers } = require('ethers');
const AWS = require('aws-sdk');
const crypto = require('crypto');
const axios = require('axios');

class AutismMedicalService {
  constructor() {
    this.rpcUrl = process.env.FLARE_RPC_URL || 'https://coston2-api.flare.network/ext/C/rpc';
    this.privateKey = process.env.FLARE_PRIVATE_KEY;
    this.contractAddress = process.env.AUTISM_MEDICAL_CONTRACT_ADDRESS;

    this.provider = new ethers.JsonRpcProvider(this.rpcUrl);
    this.signer = new ethers.Wallet(this.privateKey, this.provider);

    // AWS S3 for file storage
    this.s3 = new AWS.S3({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION || 'us-east-1'
    });

    this.bucketName = process.env.S3_BUCKET_NAME || 'autism-evaluations';

    // Contract ABI
    this.contractABI = [
      "function uploadEvaluationWithInsurance(tuple(string insuranceProvider, string policyNumber, string groupNumber, string memberID, string insuranceXRPL, uint256 coveragePercentage, uint256 deductible, uint256 deductibleMet, bool isVerified) insurance, bytes32 fileHash, string fileLocation, bytes32 encryptedKey, uint8 evaluationType, uint256 evaluationCostUSD, bytes32 insurancePaymentProof) external returns (uint256)",
      "function accessEvaluationFile(uint256 tokenId, string purpose) external returns (string, bytes32, bool)",
      "function billPatientThroughInsurance(uint256 evaluationTokenId, uint256 serviceAmountUSD, string serviceDescription) external returns (bytes32)",
      "function updateDiagnosis(address patient, uint256 evaluationTokenId, uint8 newLevel, string primaryDiagnosis, string[] comorbidities, string notes) external",
      "function getPatientDiagnosisHistory(address patient) external view returns (uint256[], uint8, uint256, uint256, string, string[], uint256)",
      "function getDiagnosisUpdate(address patient, uint256 updateIndex) external view returns (uint256, uint8, uint8, string, address, uint256)",
      "function getAccessHistory(uint256 tokenId) external view returns (tuple(address accessor, uint256 accessTime, string purpose, bool isPaid, bytes32 paymentTx)[])",
      "function getPatientBills(address patient) external view returns (bytes32[])",
      "function payBill(bytes32 billId, bytes32 xrplPaymentTx) external",
      "event EvaluationUploaded(uint256 indexed tokenId, address indexed patient, uint8 evaluationType, bool paidByInsurance)",
      "event FileAccessGranted(uint256 indexed tokenId, address indexed accessor, string purpose, bool requiresPayment)",
      "event BillCreated(bytes32 indexed billId, uint256 indexed tokenId, address indexed patient, uint256 totalAmount, uint256 insurancePortion)",
      "event DiagnosisUpdated(address indexed patient, uint8 newLevel, uint256 evaluationTokenId)"
    ];

    this.contract = new ethers.Contract(this.contractAddress, this.contractABI, this.signer);

    // Evaluation types mapping
    this.evaluationTypes = {
      'ADOS': 0,
      'ADIR': 1,
      'CARS': 2,
      'MCHAT': 3,
      'GARS': 4,
      'SRS': 5,
      'ABC': 6,
      'ASRS': 7
    };

    // Severity levels mapping
    this.severityLevels = {
      'None': 0,
      'Level1_RequiringSupport': 1,
      'Level2_RequiringSubstantialSupport': 2,
      'Level3_RequiringVerySubstantialSupport': 3
    };
  }

  /**
   * FLOW 1: Patient uploads evaluation with insurance payment
   */
  async uploadEvaluationWithInsurance(patientData) {
    const {
      patientAddress,
      evaluationFile,
      evaluationType,
      evaluationCostUSD,
      insuranceInfo,
      insurancePaymentTxHash
    } = patientData;

    try {
      console.log('🏥 Starting autism evaluation upload flow...');

      // Step 1: Upload and encrypt file
      console.log('📁 Uploading and encrypting evaluation file...');
      const fileData = await this.uploadAndEncryptFile(evaluationFile, patientAddress);

      // Step 2: Verify insurance payment
      console.log('💳 Verifying insurance payment...');
      const paymentVerification = await this.verifyInsurancePayment(
        insurancePaymentTxHash,
        evaluationCostUSD,
        insuranceInfo.insuranceXRPL
      );

      if (!paymentVerification.isValid) {
        throw new Error('Insurance payment verification failed');
      }

      // Step 3: Mint NFT on Flare
      console.log('🎫 Minting evaluation NFT...');
      const evaluationTypeIndex = this.evaluationTypes[evaluationType.toUpperCase()];

      const insuranceStruct = {
        insuranceProvider: insuranceInfo.provider,
        policyNumber: insuranceInfo.policyNumber,
        groupNumber: insuranceInfo.groupNumber || '',
        memberID: insuranceInfo.memberID,
        insuranceXRPL: insuranceInfo.insuranceXRPL,
        coveragePercentage: insuranceInfo.coveragePercentage,
        deductible: ethers.parseUnits(insuranceInfo.deductible.toString(), 18),
        deductibleMet: ethers.parseUnits(insuranceInfo.deductibleMet.toString(), 18),
        isVerified: true
      };

      const tx = await this.contract.uploadEvaluationWithInsurance(
        insuranceStruct,
        fileData.fileHash,
        fileData.fileLocation,
        fileData.encryptedKey,
        evaluationTypeIndex,
        ethers.parseUnits(evaluationCostUSD.toString(), 18),
        ethers.keccak256(ethers.toUtf8Bytes(insurancePaymentTxHash))
      );

      const receipt = await tx.wait();

      // Extract token ID from event
      const event = receipt.logs.find(log => {
        try {
          const parsed = this.contract.interface.parseLog(log);
          return parsed.name === 'EvaluationUploaded';
        } catch (e) {
          return false;
        }
      });

      const tokenId = event ? this.contract.interface.parseLog(event).args.tokenId.toString() : null;

      console.log('✅ Evaluation uploaded successfully!');

      return {
        success: true,
        tokenId,
        fileLocation: fileData.fileLocation,
        transactionHash: tx.hash,
        blockNumber: receipt.blockNumber,
        insurancePaymentVerified: true,
        evaluationType,
        uploadedAt: new Date().toISOString()
      };

    } catch (error) {
      console.error('❌ Upload failed:', error);
      throw error;
    }
  }

  /**
   * FLOW 2: Hospital/Insurance checks and downloads evaluation
   */
  async accessEvaluationFile(tokenId, accessorAddress, purpose) {
    try {
      console.log(`🔍 Accessing evaluation file for token ${tokenId}...`);

      // Check if accessor has appropriate role
      const hasRole = await this.checkAccessRole(accessorAddress);
      if (!hasRole) {
        throw new Error('Accessor not authorized (must be hospital or insurance)');
      }

      // Access file through contract
      const accessorSigner = new ethers.Wallet(process.env.ACCESSOR_PRIVATE_KEY || this.privateKey, this.provider);
      const contractWithAccessor = this.contract.connect(accessorSigner);

      const [fileLocation, encryptedKey, requiresPayment] = await contractWithAccessor.accessEvaluationFile(
        tokenId,
        purpose
      );

      if (requiresPayment) {
        return {
          success: false,
          requiresPayment: true,
          message: 'Payment required for access',
          accessCost: '15' // $15 USD
        };
      }

      // Decrypt file key (in production, accessor would do this)
      const decryptedKey = this.decryptFileKey(encryptedKey);

      // Get file from S3
      const fileData = await this.downloadDecryptedFile(fileLocation, decryptedKey);

      // Log access for tracking
      await this.logFileAccess(tokenId, accessorAddress, purpose);

      console.log('✅ File access granted successfully!');

      return {
        success: true,
        fileData,
        fileLocation,
        accessedAt: new Date().toISOString(),
        requiresPayment: false,
        purpose
      };

    } catch (error) {
      console.error('❌ File access failed:', error);
      throw error;
    }
  }

  /**
   * FLOW 3: Hospital bills patient through insurance
   */
  async billPatientThroughInsurance(billingData) {
    const {
      evaluationTokenId,
      hospitalAddress,
      serviceAmountUSD,
      serviceDescription
    } = billingData;

    try {
      console.log('💰 Creating insurance bill...');

      // Create bill through contract
      const hospitalSigner = new ethers.Wallet(process.env.HOSPITAL_PRIVATE_KEY || this.privateKey, this.provider);
      const contractWithHospital = this.contract.connect(hospitalSigner);

      const tx = await contractWithHospital.billPatientThroughInsurance(
        evaluationTokenId,
        ethers.parseUnits(serviceAmountUSD.toString(), 18),
        serviceDescription
      );

      const receipt = await tx.wait();

      // Extract bill ID from event
      const event = receipt.logs.find(log => {
        try {
          const parsed = this.contract.interface.parseLog(log);
          return parsed.name === 'BillCreated';
        } catch (e) {
          return false;
        }
      });

      const billId = event ? this.contract.interface.parseLog(event).args.billId : null;

      console.log('✅ Bill created successfully!');

      return {
        success: true,
        billId,
        evaluationTokenId,
        serviceAmountUSD,
        transactionHash: tx.hash,
        createdAt: new Date().toISOString()
      };

    } catch (error) {
      console.error('❌ Billing failed:', error);
      throw error;
    }
  }

  /**
   * FLOW 4: Track patient diagnosis history
   */
  async updatePatientDiagnosis(diagnosisData) {
    const {
      patientAddress,
      evaluationTokenId,
      severityLevel,
      primaryDiagnosis,
      comorbidities,
      notes,
      evaluatorAddress
    } = diagnosisData;

    try {
      console.log('📊 Updating patient diagnosis...');

      const evaluatorSigner = new ethers.Wallet(process.env.EVALUATOR_PRIVATE_KEY || this.privateKey, this.provider);
      const contractWithEvaluator = this.contract.connect(evaluatorSigner);

      const severityIndex = this.severityLevels[severityLevel];

      const tx = await contractWithEvaluator.updateDiagnosis(
        patientAddress,
        evaluationTokenId,
        severityIndex,
        primaryDiagnosis,
        comorbidities,
        notes
      );

      const receipt = await tx.wait();

      console.log('✅ Diagnosis updated successfully!');

      return {
        success: true,
        patientAddress,
        severityLevel,
        transactionHash: tx.hash,
        updatedAt: new Date().toISOString()
      };

    } catch (error) {
      console.error('❌ Diagnosis update failed:', error);
      throw error;
    }
  }

  /**
   * Get complete patient diagnosis history
   */
  async getPatientDiagnosisHistory(patientAddress) {
    try {
      const [
        evaluationTokenIds,
        currentLevel,
        firstDiagnosisDate,
        lastUpdateDate,
        primaryDiagnosis,
        comorbidities,
        totalUpdates
      ] = await this.contract.getPatientDiagnosisHistory(patientAddress);

      // Get detailed updates
      const updates = [];
      for (let i = 0; i < totalUpdates; i++) {
        const update = await this.contract.getDiagnosisUpdate(patientAddress, i);
        updates.push({
          timestamp: new Date(Number(update[0]) * 1000).toISOString(),
          previousLevel: Object.keys(this.severityLevels)[update[1]],
          newLevel: Object.keys(this.severityLevels)[update[2]],
          notes: update[3],
          updatedBy: update[4],
          evaluationTokenId: update[5].toString()
        });
      }

      return {
        success: true,
        patientAddress,
        evaluationTokenIds: evaluationTokenIds.map(id => id.toString()),
        currentSeverityLevel: Object.keys(this.severityLevels)[currentLevel],
        firstDiagnosisDate: new Date(Number(firstDiagnosisDate) * 1000).toISOString(),
        lastUpdateDate: new Date(Number(lastUpdateDate) * 1000).toISOString(),
        primaryDiagnosis,
        comorbidities,
        totalUpdates: totalUpdates.toString(),
        detailedUpdates: updates
      };

    } catch (error) {
      console.error('❌ Failed to get diagnosis history:', error);
      throw error;
    }
  }

  /**
   * Get access history for tracking
   */
  async getEvaluationAccessHistory(tokenId) {
    try {
      const accessRecords = await this.contract.getAccessHistory(tokenId);

      const formattedRecords = accessRecords.map(record => ({
        accessor: record.accessor,
        accessTime: new Date(Number(record.accessTime) * 1000).toISOString(),
        purpose: record.purpose,
        isPaid: record.isPaid,
        paymentTx: record.paymentTx
      }));

      return {
        success: true,
        tokenId: tokenId.toString(),
        accessHistory: formattedRecords,
        totalAccesses: formattedRecords.length
      };

    } catch (error) {
      console.error('❌ Failed to get access history:', error);
      throw error;
    }
  }

  // Utility functions

  async uploadAndEncryptFile(file, patientAddress) {
    // Generate encryption key
    const encryptionKey = crypto.randomBytes(32);

    // Encrypt file
    const cipher = crypto.createCipher('aes-256-cbc', encryptionKey);
    let encryptedData = cipher.update(file.buffer, 'utf8', 'hex');
    encryptedData += cipher.final('hex');

    // Generate file hash
    const fileHash = crypto.createHash('sha256').update(file.buffer).digest('hex');

    // Upload to S3
    const fileName = `evaluations/${patientAddress}/${Date.now()}-${fileHash}.enc`;

    const uploadParams = {
      Bucket: this.bucketName,
      Key: fileName,
      Body: Buffer.from(encryptedData, 'hex'),
      ContentType: 'application/octet-stream',
      ServerSideEncryption: 'AES256'
    };

    await this.s3.upload(uploadParams).promise();

    // Encrypt the encryption key for storage
    const encryptedKey = this.encryptFileKey(encryptionKey.toString('hex'));

    return {
      fileLocation: `s3://${this.bucketName}/${fileName}`,
      fileHash: ethers.keccak256(ethers.toUtf8Bytes(fileHash)),
      encryptedKey
    };
  }

  async downloadDecryptedFile(fileLocation, decryptedKey) {
    // Extract S3 key from location
    const s3Key = fileLocation.replace(`s3://${this.bucketName}/`, '');

    // Download from S3
    const downloadParams = {
      Bucket: this.bucketName,
      Key: s3Key
    };

    const data = await this.s3.getObject(downloadParams).promise();

    // Decrypt file
    const decipher = crypto.createDecipher('aes-256-cbc', Buffer.from(decryptedKey, 'hex'));
    let decryptedData = decipher.update(data.Body, 'hex', 'utf8');
    decryptedData += decipher.final('utf8');

    return decryptedData;
  }

  encryptFileKey(key) {
    const cipher = crypto.createCipher('aes-256-cbc', process.env.MASTER_KEY || 'default-master-key');
    let encrypted = cipher.update(key, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return ethers.keccak256(ethers.toUtf8Bytes(encrypted));
  }

  decryptFileKey(encryptedKey) {
    try {
      const decipher = crypto.createDecipher('aes-256-cbc', process.env.MASTER_KEY || 'default-master-key');
      let decrypted = decipher.update(encryptedKey.slice(2), 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error) {
      console.error('Key decryption failed:', error);
      return null;
    }
  }

  async verifyInsurancePayment(txHash, amountUSD, insuranceXRPL) {
    // Verify XRPL payment via Flare State Connector
    try {
      const verificationRequest = {
        attestationType: 'Payment',
        sourceId: 'XRPL',
        requestBody: {
          transactionId: txHash,
          inUtxo: '0',
          utxo: '0'
        }
      };

      // Call Flare FDC (reuse existing logic)
      const response = await this.submitFDCRequest(verificationRequest);

      return {
        isValid: response.status === 'VALID',
        txHash,
        verificationHash: response.attestationHash
      };

    } catch (error) {
      console.error('Payment verification failed:', error);
      return { isValid: false, error: error.message };
    }
  }

  async submitFDCRequest(requestBody) {
    const config = {
      method: 'post',
      url: `${process.env.FLARE_FDC_URL || 'https://fdc-api.flare.network'}/attestation-client/api/proof/get-specific-proof`,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.FLARE_API_KEY || ''
      },
      data: requestBody,
      timeout: 30000
    };

    const response = await axios(config);
    return response.data;
  }

  async checkAccessRole(address) {
    // Check if address has HOSPITAL_ROLE or INSURANCE_ROLE
    // Simplified for demonstration
    return true;
  }

  async logFileAccess(tokenId, accessor, purpose) {
    // Additional logging can be implemented here
    console.log(`📋 Access logged: Token ${tokenId} accessed by ${accessor} for ${purpose}`);
  }

  // Admin functions

  async addVerifiedInsurance(insuranceProvider) {
    const tx = await this.contract.addVerifiedInsurance(insuranceProvider);
    await tx.wait();
    return { success: true, provider: insuranceProvider };
  }

  async grantRole(role, address) {
    const roleHash = ethers.keccak256(ethers.toUtf8Bytes(role));
    const tx = await this.contract.grantRole(roleHash, address);
    await tx.wait();
    return { success: true, role, address };
  }
}

module.exports = new AutismMedicalService();