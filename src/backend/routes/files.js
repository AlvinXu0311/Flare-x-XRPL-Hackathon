const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const localStorageService = require('../services/localStorageService');
const s3Service = require('../services/s3Service');
const encryptionService = require('../services/encryptionService');
const xrplService = require('../services/xrplService');
const flareRegistryService = require('../services/flareRegistryService');

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024,
    files: 1
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, DOC, and DOCX files are allowed.'));
    }
  }
});

router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'No file uploaded'
      });
    }

    const patientInfo = JSON.parse(req.body.patientInfo || '{}');

    if (!patientInfo.firstName || !patientInfo.lastName || !patientInfo.dateOfBirth || !patientInfo.evaluationType) {
      return res.status(400).json({
        error: 'Missing required patient information'
      });
    }

    // Check for new tokenization flow (patientAddress) vs old flow (walletInfo)
    const patientAddress = patientInfo.patientAddress;
    const isNewFlow = !!patientAddress;

    console.log('📋 Patient Info:', {
      name: `${patientInfo.firstName} ${patientInfo.lastName}`,
      evaluationType: patientInfo.evaluationType,
      flow: isNewFlow ? 'tokenization' : 'legacy',
      patientAddress: patientAddress
    });

    const evaluationId = uuidv4();
    const fileBuffer = req.file.buffer;
    const fileExtension = path.extname(req.file.originalname);

    const fileHash = encryptionService.generateFileHash(fileBuffer);

    const encryptionResult = encryptionService.encryptFile(fileBuffer);

    const s3Key = s3Service.generateFileKey(patientInfo, fileExtension);

    const uploadResult = await s3Service.uploadFile(
      encryptionResult.encryptedData,
      s3Key,
      'application/octet-stream',
      {
        originalName: req.file.originalname,
        originalMimeType: req.file.mimetype,
        encrypted: 'true',
        evaluationId
      }
    );

    let nftResult = null;
    let flareResult = null;

    if (isNewFlow) {
      // New tokenization flow: Use blockchain service API
      console.log('🚀 Using new tokenization flow');
      try {
        const axios = require('axios');
        const response = await axios.post('http://localhost:3000/api/blockchain/mint-medical-record', {
          evaluationData: {
            patientInfo,
            fileHash
          },
          patientAddress,
          ipfsUri: `ipfs://Qm${evaluationId.replace(/-/g, '')}`
        });

        if (response.data.success) {
          console.log('✅ Tokenization successful via blockchain API');
          nftResult = {
            nftTokenId: response.data.flareToken?.tokenId,
            transactionHash: response.data.flareToken?.transactionHash,
            ledgerIndex: response.data.flareToken?.blockNumber || 0,
            metadata: response.data.metadata,
            platformWallet: patientAddress,
            mintedBy: 'flare-tokenization',
            userOwned: true
          };

          if (response.data.xrplToken) {
            nftResult.xrplTokenId = response.data.xrplToken.nftTokenId;
            nftResult.xrplTransactionHash = response.data.xrplToken.transactionHash;
          }
        }
      } catch (tokenError) {
        console.error('❌ Tokenization failed:', tokenError.message);
        throw new Error(`Blockchain tokenization failed: ${tokenError.message}`);
      }
    } else {
      // Legacy flow: Direct XRPL minting
      console.log('🔄 Using legacy XRPL flow');
      const walletInfo = patientInfo.walletInfo || {
        address: null,
        canMint: false,
        option: 'platform',
        seed: null
      };

      try {
        if (xrplService.isConnected()) {
          const nftData = {
            evaluationId,
            fileHash,
            patientInfo,
            s3Key,
            walletInfo
          };

          console.log('🎨 Minting NFT with platform wallet');
          nftResult = await xrplService.mintEvaluationNFT(nftData);
        }
      } catch (nftError) {
        console.error('XRPL NFT minting failed:', nftError.message);
        throw new Error(`XRPL NFT minting failed: ${nftError.message}`);
      }
    }

    const evaluationData = {
      id: evaluationId,
      nftTokenId: nftResult?.nftTokenId,
      fileHash,
      s3Key,
      encryptionKey: encryptionResult.encryptionKey,
      patientInfo: {
        firstName: patientInfo.firstName,
        lastName: patientInfo.lastName,
        dateOfBirth: patientInfo.dateOfBirth,
        evaluationType: patientInfo.evaluationType,
        notes: patientInfo.notes || '',
        patientAddress: isNewFlow ? patientAddress : null
      },
      tokenization: isNewFlow ? {
        flow: 'flare-tokenization',
        patientAddress: patientAddress,
        flareTokenId: nftResult?.nftTokenId,
        xrplTokenId: nftResult?.xrplTokenId || null,
        userOwned: true,
        mintedBy: nftResult?.mintedBy
      } : {
        flow: 'legacy-xrpl',
        address: patientInfo.walletInfo?.address,
        option: patientInfo.walletInfo?.option,
        canMint: patientInfo.walletInfo?.canMint,
        userOwned: nftResult?.userOwned || false,
        mintedBy: nftResult?.mintedBy || 'platform'
      },
      fileMetadata: {
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        uploadDate: new Date().toISOString()
      },
      blockchain: nftResult ? {
        primary: isNewFlow ? 'flare' : 'xrpl',
        flare: isNewFlow ? {
          tokenId: nftResult.nftTokenId,
          transactionHash: nftResult.transactionHash,
          blockNumber: nftResult.ledgerIndex,
          networkId: 'flare-coston2',
          mintedAt: new Date().toISOString(),
          patientAddress: patientAddress
        } : null,
        xrpl: {
          nftTokenId: nftResult.xrplTokenId || nftResult.nftTokenId,
          transactionHash: nftResult.xrplTransactionHash || nftResult.transactionHash,
          networkId: 'xrpl-testnet',
          mintedAt: new Date().toISOString(),
          walletAddress: nftResult.platformWallet
        }
      } : null,
      status: 'tokenized'
    };

    const evaluation = localStorageService.createEvaluation(evaluationData);

    res.status(200).json({
      success: true,
      evaluationId,
      nftTokenId: evaluation.nftTokenId,
      fileHash,
      uploadDate: evaluation.fileMetadata.uploadDate,
      blockchain: evaluation.blockchain,
      message: 'File uploaded and NFT minted successfully'
    });

  } catch (error) {
    console.error('File upload error:', error);
    res.status(500).json({
      error: 'File upload failed',
      details: error.message
    });
  }
});

router.get('/presign', async (req, res) => {
  try {
    const { filename, contentType } = req.query;

    if (!filename || !contentType) {
      return res.status(400).json({
        error: 'Filename and content type are required'
      });
    }

    const fileKey = `temp/${uuidv4()}_${filename}`;
    const uploadUrl = await s3Service.getSignedUploadUrl(fileKey, contentType);

    res.json({
      uploadUrl,
      fileKey,
      expiresIn: 3600
    });

  } catch (error) {
    console.error('Presigned URL error:', error);
    res.status(500).json({
      error: 'Failed to generate upload URL',
      details: error.message
    });
  }
});

router.post('/decrypt', async (req, res) => {
  try {
    const { evaluationId, hospitalId } = req.body;

    if (!evaluationId || !hospitalId) {
      return res.status(400).json({
        error: 'Evaluation ID and Hospital ID are required'
      });
    }

    const evaluation = localStorageService.findEvaluationById(evaluationId);
    if (!evaluation) {
      return res.status(404).json({
        error: 'Evaluation not found'
      });
    }

    const validAccess = localStorageService.findValidAccess(hospitalId, evaluationId);
    if (!validAccess) {
      return res.status(403).json({
        error: 'Access denied. Payment required.'
      });
    }

    const downloadResult = await s3Service.downloadFile(evaluation.s3Key);

    const decryptionResult = encryptionService.decryptFile(
      downloadResult.fileBuffer,
      evaluation.encryptionKey
    );

    res.set({
      'Content-Type': evaluation.fileMetadata.mimeType,
      'Content-Disposition': `attachment; filename="${evaluation.fileMetadata.originalName}"`,
      'Content-Length': decryptionResult.decryptedData.length
    });

    res.send(decryptionResult.decryptedData);

  } catch (error) {
    console.error('File decryption error:', error);
    res.status(500).json({
      error: 'File decryption failed',
      details: error.message
    });
  }
});

router.get('/download/:fileKey', async (req, res) => {
  try {
    const { fileKey } = req.params;
    const decodedKey = decodeURIComponent(fileKey);

    if (s3Service.isLocal) {
      const downloadResult = await s3Service.downloadFile(decodedKey);

      res.set({
        'Content-Type': downloadResult.contentType,
        'Content-Length': downloadResult.fileBuffer.length,
        'Cache-Control': 'private, no-cache'
      });

      res.send(downloadResult.fileBuffer);
    } else {
      const signedUrl = await s3Service.getSignedDownloadUrl(decodedKey, 60);
      res.redirect(signedUrl);
    }

  } catch (error) {
    console.error('File download error:', error);
    res.status(404).json({
      error: 'File not found',
      details: error.message
    });
  }
});

router.get('/info/:evaluationId', async (req, res) => {
  try {
    const { evaluationId } = req.params;

    const evaluation = localStorageService.findEvaluationById(evaluationId);
    if (!evaluation) {
      return res.status(404).json({
        error: 'Evaluation not found'
      });
    }

    res.json({
      id: evaluation.id,
      nftTokenId: evaluation.nftTokenId,
      patientName: `${evaluation.patientInfo.firstName} ${evaluation.patientInfo.lastName}`,
      evaluationType: evaluation.patientInfo.evaluationType,
      uploadDate: evaluation.fileMetadata.uploadDate,
      fileSize: evaluation.fileMetadata.size,
      status: evaluation.status,
      blockchain: evaluation.blockchain
    });

  } catch (error) {
    console.error('File info error:', error);
    res.status(500).json({
      error: 'Failed to get file information',
      details: error.message
    });
  }
});

router.delete('/:evaluationId', async (req, res) => {
  try {
    const { evaluationId } = req.params;
    const { patientSignature } = req.body;

    if (!patientSignature) {
      return res.status(400).json({
        error: 'Patient signature required for deletion'
      });
    }

    const evaluation = localStorageService.findEvaluationById(evaluationId);
    if (!evaluation) {
      return res.status(404).json({
        error: 'Evaluation not found'
      });
    }

    await s3Service.deleteFile(evaluation.s3Key);

    localStorageService.updateEvaluation(evaluationId, { status: 'deleted' });

    res.json({
      success: true,
      message: 'Evaluation deleted successfully'
    });

  } catch (error) {
    console.error('File deletion error:', error);
    res.status(500).json({
      error: 'File deletion failed',
      details: error.message
    });
  }
});

// Hospital Discovery Routes using Flare Registry

router.post('/hospital/discover', async (req, res) => {
  try {
    const { hospitalAddress, evaluationId, nftTokenId } = req.body;

    if (!hospitalAddress) {
      return res.status(400).json({
        error: 'Hospital address required'
      });
    }

    let searchId = evaluationId || nftTokenId;
    if (!searchId) {
      return res.status(400).json({
        error: 'Either evaluation ID or NFT token ID required'
      });
    }

    // Get file location from Flare registry
    const fileLocation = await flareRegistryService.getFileLocation(searchId, hospitalAddress);

    res.json({
      success: true,
      evaluationId: searchId,
      fileLocation: {
        s3Key: fileLocation.s3Key,
        xrplNftId: fileLocation.xrplNftId,
        verified: fileLocation.verification
      },
      flareVerification: {
        hash: fileLocation.flareVerificationHash,
        timestamp: new Date().toISOString()
      },
      message: 'File location verified through Flare State Connector'
    });

  } catch (error) {
    console.error('Hospital discovery error:', error);
    res.status(error.message.includes('not authorized') ? 403 : 500).json({
      error: 'Discovery failed',
      details: error.message
    });
  }
});

router.post('/hospital/access-token', async (req, res) => {
  try {
    const { hospitalAddress, evaluationId } = req.body;

    if (!hospitalAddress || !evaluationId) {
      return res.status(400).json({
        error: 'Hospital address and evaluation ID required'
      });
    }

    // Generate access token using Flare registry
    const tokenData = await flareRegistryService.generateHospitalAccessToken(
      hospitalAddress,
      evaluationId
    );

    res.json({
      success: true,
      accessToken: tokenData.token,
      signature: tokenData.signature,
      validUntil: tokenData.validUntil,
      instructions: {
        usage: 'Include this token in Authorization header for file access',
        format: 'Bearer <accessToken>',
        signature: 'Verify signature against Flare registry contract'
      }
    });

  } catch (error) {
    console.error('Access token generation error:', error);
    res.status(500).json({
      error: 'Token generation failed',
      details: error.message
    });
  }
});

router.get('/hospital/registry', async (req, res) => {
  try {
    // Get public index of all medical records
    const publicIndex = await flareRegistryService.createPublicIndex();

    res.json({
      success: true,
      registry: publicIndex,
      description: 'Open source medical records registry',
      usage: {
        discovery: 'Use evaluation IDs to request access',
        verification: 'All records verified on XRPL and Flare',
        access: 'Requires hospital credentials and authorization'
      }
    });

  } catch (error) {
    console.error('Registry index error:', error);
    res.status(500).json({
      error: 'Registry access failed',
      details: error.message
    });
  }
});

router.post('/hospital/verify-file', async (req, res) => {
  try {
    const { evaluationId, fileHash } = req.body;

    if (!evaluationId || !fileHash) {
      return res.status(400).json({
        error: 'Evaluation ID and file hash required'
      });
    }

    // Verify file integrity using both XRPL and Flare
    const evaluation = localStorageService.findEvaluationById(evaluationId);
    if (!evaluation) {
      return res.status(404).json({
        error: 'Evaluation not found'
      });
    }

    // Verify with Flare State Connector
    const flareVerification = await flareRegistryService.verifyXRPLNFTExists(
      evaluation.nftTokenId
    );

    const verification = {
      fileHashMatch: evaluation.fileHash === fileHash,
      xrplNftExists: flareVerification.isValid,
      flareVerified: flareVerification.flareResponse?.status === 'VALID',
      timestamp: new Date().toISOString()
    };

    res.json({
      success: true,
      verification,
      evaluationId,
      integrity: verification.fileHashMatch && verification.xrplNftExists,
      flareAttestation: flareVerification.verificationHash
    });

  } catch (error) {
    console.error('File verification error:', error);
    res.status(500).json({
      error: 'Verification failed',
      details: error.message
    });
  }
});

router.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    services: {
      s3: s3Service.isConfigured(),
      encryption: true,
      xrpl: xrplService.isConnected(),
      flareRegistry: flareRegistryService.isConnected()
    },
    networks: {
      xrpl: xrplService.isConnected() ? 'connected' : 'disconnected',
      flare: flareRegistryService.getNetworkInfo()
    },
    timestamp: new Date().toISOString()
  });
});

module.exports = router;