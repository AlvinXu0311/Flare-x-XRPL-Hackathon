const express = require('express');
const xrplService = require('../services/xrplService');
const flareService = require('../services/flareService');

const router = express.Router();

router.post('/mint-medical-record', async (req, res) => {
  try {
    const { evaluationData, patientAddress, ipfsUri } = req.body;

    if (!evaluationData || !patientAddress) {
      return res.status(400).json({
        error: 'Evaluation data and patient address are required'
      });
    }

    // Create metadata for IPFS
    const metadata = flareService.createMedicalRecordMetadata({
      patientName: `${evaluationData.patientInfo.firstName} ${evaluationData.patientInfo.lastName}`,
      evaluationType: evaluationData.patientInfo.evaluationType,
      uploadDate: new Date().toISOString(),
      fileHash: evaluationData.fileHash,
      patientId: evaluationData.patientInfo.patientId || 'anonymous'
    });

    // Try to mint on Flare first
    let flareResult = null;
    try {
      flareResult = await flareService.mintMedicalRecordNFT(
        patientAddress,
        evaluationData.fileHash,
        ipfsUri || 'ipfs://QmPlaceholderHash',
        evaluationData.patientInfo.evaluationType
      );
    } catch (error) {
      console.error('Flare minting failed:', error.message);
      throw new Error(`Flare tokenization failed: ${error.message}`);
    }

    // Also create XRPL NFT for cross-chain compatibility
    let xrplResult = null;
    if (xrplService.isConnected()) {
      try {
        xrplResult = await xrplService.mintEvaluationNFT(evaluationData);
      } catch (error) {
        console.log('XRPL minting failed:', error.message);
      }
    }

    res.json({
      success: true,
      flareToken: {
        tokenId: flareResult.tokenId,
        transactionHash: flareResult.transactionHash,
        blockNumber: flareResult.blockNumber,
        network: 'Flare Coston2'
      },
      xrplToken: xrplResult ? {
        nftTokenId: xrplResult.nftTokenId,
        transactionHash: xrplResult.transactionHash,
        ledgerIndex: xrplResult.ledgerIndex,
        network: 'XRPL'
      } : null,
      metadata,
      ipfsUri: ipfsUri || 'ipfs://QmPlaceholderHash'
    });

  } catch (error) {
    console.error('Medical record minting error:', error);
    res.status(500).json({
      error: 'Medical record minting failed',
      details: error.message
    });
  }
});

router.post('/mint-access-nft', async (req, res) => {
  try {
    const { accessData } = req.body;

    if (!accessData || !accessData.evaluationId || !accessData.hospitalId) {
      return res.status(400).json({
        error: 'Access data with evaluation ID and hospital ID is required'
      });
    }

    if (!xrplService.isConnected()) {
      return res.status(503).json({
        error: 'XRPL service not available'
      });
    }

    const accessNftResult = await xrplService.mintAccessNFT(accessData);

    res.json({
      success: true,
      accessNftId: accessNftResult.accessNftId,
      transactionHash: accessNftResult.transactionHash,
      ledgerIndex: accessNftResult.ledgerIndex,
      metadata: accessNftResult.metadata
    });

  } catch (error) {
    console.error('Access NFT minting error:', error);
    res.status(500).json({
      error: 'Access NFT minting failed',
      details: error.message
    });
  }
});

router.post('/verify-tx', async (req, res) => {
  try {
    const { transactionHash, expectedAmount, expectedDestination } = req.body;

    if (!transactionHash) {
      return res.status(400).json({
        error: 'Transaction hash is required'
      });
    }

    let verificationResult;

    {
      if (!xrplService.isConnected()) {
        return res.status(503).json({
          error: 'XRPL service not available'
        });
      }

      const xrplVerification = await xrplService.verifyPayment(transactionHash);

      if (expectedAmount && parseFloat(xrplVerification.amount) < expectedAmount) {
        return res.status(400).json({
          error: 'Insufficient payment amount',
          expected: expectedAmount,
          received: xrplVerification.amount
        });
      }

      if (expectedDestination && xrplVerification.destination !== expectedDestination) {
        return res.status(400).json({
          error: 'Payment destination mismatch',
          expected: expectedDestination,
          received: xrplVerification.destination
        });
      }

      verificationResult = {
        verified: xrplVerification.validated,
        amount: xrplVerification.amount,
        source: xrplVerification.source,
        destination: xrplVerification.destination,
        timestamp: xrplVerification.timestamp,
        ledgerIndex: xrplVerification.ledgerIndex,
        memo: xrplVerification.memo,
        method: 'xrpl'
      };
    }

    const flareVerification = await flareService.verifyXRPLTransaction(
      transactionHash,
      expectedAmount || 15,
      expectedDestination || xrplService.getPlatformAddress()
    );

    res.json({
      success: true,
      transactionHash,
      xrplVerification: verificationResult,
      flareVerification: {
        isValid: flareVerification.isValid,
        verificationHash: flareVerification.verificationHash,
        error: flareVerification.error
      },
      overallValid: verificationResult.verified && flareVerification.isValid
    });

  } catch (error) {
    console.error('Transaction verification error:', error);
    res.status(500).json({
      error: 'Transaction verification failed',
      details: error.message
    });
  }
});

router.get('/balance', async (req, res) => {
  try {
    const { address } = req.query;

    if (!address) {
      return res.status(400).json({
        error: 'Wallet address is required'
      });
    }

    if (!xrplService.isConnected()) {
      return res.status(503).json({
        error: 'XRPL service not available'
      });
    }

    const accountInfo = await xrplService.getAccountInfo(address);

    res.json({
      address: accountInfo.address,
      balance: accountInfo.balance,
      balanceXRP: `${accountInfo.balance} XRP`,
      sequence: accountInfo.sequence,
      ownerCount: accountInfo.ownerCount,
      flags: accountInfo.flags
    });

  } catch (error) {
    console.error('Balance fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch wallet balance',
      details: error.message
    });
  }
});

router.post('/payment', async (req, res) => {
  try {
    const { sourceWallet, destinationAddress, amount, memo } = req.body;

    if (!sourceWallet || !destinationAddress || !amount) {
      return res.status(400).json({
        error: 'Source wallet, destination address, and amount are required'
      });
    }

    if (!xrplService.isConnected()) {
      return res.status(503).json({
        error: 'XRPL service not available'
      });
    }

    if (typeof sourceWallet === 'string') {
      return res.status(400).json({
        error: 'Source wallet must be a wallet object with seed or private key'
      });
    }

    const paymentResult = await xrplService.sendPayment(
      sourceWallet,
      destinationAddress,
      amount
    );

    res.json({
      success: true,
      transactionHash: paymentResult.result.hash,
      amount: amount,
      source: sourceWallet.address,
      destination: destinationAddress,
      ledgerIndex: paymentResult.result.ledger_index,
      fee: paymentResult.result.Fee,
      memo: memo || null
    });

  } catch (error) {
    console.error('Payment error:', error);
    res.status(500).json({
      error: 'Payment failed',
      details: error.message
    });
  }
});

router.get('/nfts/:address', async (req, res) => {
  try {
    const { address } = req.params;

    if (!xrplService.isConnected()) {
      return res.status(503).json({
        error: 'XRPL service not available'
      });
    }

    const nfts = await xrplService.getNFTsByAccount(address);

    const processedNfts = nfts.map(nft => {
      let metadata = null;
      if (nft.URI) {
        try {
          const uriString = Buffer.from(nft.URI, 'hex').toString();
          metadata = JSON.parse(uriString);
        } catch (e) {
          metadata = { uri: nft.URI };
        }
      }

      return {
        nftTokenId: nft.NFTokenID,
        uri: nft.URI,
        metadata,
        flags: nft.Flags,
        transferFee: nft.TransferFee,
        nftTokenTaxon: nft.NFTokenTaxon,
        issuer: nft.Issuer
      };
    });

    res.json({
      address,
      nfts: processedNfts,
      count: processedNfts.length
    });

  } catch (error) {
    console.error('NFTs fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch NFTs',
      details: error.message
    });
  }
});

router.post('/validate-address', async (req, res) => {
  try {
    const { address } = req.body;

    if (!address) {
      return res.status(400).json({
        error: 'Address is required'
      });
    }

    const isValid = await xrplService.validateWalletAddress(address);

    res.json({
      address,
      isValid,
      format: isValid ? 'valid XRPL address' : 'invalid format'
    });

  } catch (error) {
    console.error('Address validation error:', error);
    res.status(500).json({
      error: 'Address validation failed',
      details: error.message
    });
  }
});

router.get('/xrp-rate', async (req, res) => {
  try {
    const rate = await xrplService.getXRPRate();

    res.json({
      rate,
      currency: 'USD',
      timestamp: new Date().toISOString(),
      source: 'CoinGecko API'
    });

  } catch (error) {
    console.error('XRP rate fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch XRP rate',
      details: error.message
    });
  }
});

router.post('/create-payment-intent', async (req, res) => {
  try {
    const { amount, sourceWallet, evaluationId } = req.body;

    if (!amount || !sourceWallet || !evaluationId) {
      return res.status(400).json({
        error: 'Amount, source wallet, and evaluation ID are required'
      });
    }

    const paymentIntent = await xrplService.createPaymentIntent(
      amount,
      sourceWallet,
      evaluationId
    );

    res.json({
      success: true,
      paymentIntent
    });

  } catch (error) {
    console.error('Payment intent creation error:', error);
    res.status(500).json({
      error: 'Failed to create payment intent',
      details: error.message
    });
  }
});

router.get('/platform-wallet', async (req, res) => {
  try {
    const platformAddress = xrplService.getPlatformAddress();

    if (!platformAddress) {
      return res.status(503).json({
        error: 'Platform wallet not initialized'
      });
    }

    const accountInfo = await xrplService.getAccountInfo(platformAddress);

    res.json({
      address: platformAddress,
      balance: accountInfo.balance,
      sequence: accountInfo.sequence,
      ownerCount: accountInfo.ownerCount
    });

  } catch (error) {
    console.error('Platform wallet info error:', error);
    res.status(500).json({
      error: 'Failed to fetch platform wallet information',
      details: error.message
    });
  }
});

router.get('/network-info', async (req, res) => {
  try {
    res.json({
      xrpl: {
        connected: xrplService.isConnected(),
        networkUrl: process.env.XRPL_NETWORK || 'wss://s.altnet.rippletest.net:51233',
        isTestNet: process.env.XRPL_TESTNET === 'true',
        platformWallet: xrplService.getPlatformAddress()
      },
      flare: flareService.getNetworkInfo(),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Network info error:', error);
    res.status(500).json({
      error: 'Failed to fetch network information',
      details: error.message
    });
  }
});

router.post('/batch-verify', async (req, res) => {
  try {
    const { transactions } = req.body;

    if (!Array.isArray(transactions) || transactions.length === 0) {
      return res.status(400).json({
        error: 'Transactions array is required'
      });
    }

    if (transactions.length > 10) {
      return res.status(400).json({
        error: 'Maximum 10 transactions per batch'
      });
    }

    const verifications = await flareService.batchVerifyTransactions(transactions);

    res.json({
      success: true,
      verifications,
      batchSize: transactions.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Batch verification error:', error);
    res.status(500).json({
      error: 'Batch verification failed',
      details: error.message
    });
  }
});

router.post('/grant-hospital-access', async (req, res) => {
  try {
    const { tokenId, hospitalAddress, xrplTransactionHash, accessDurationHours } = req.body;

    if (!tokenId || !hospitalAddress || !xrplTransactionHash) {
      return res.status(400).json({
        error: 'Token ID, hospital address, and XRPL transaction hash are required'
      });
    }

    // First verify the XRPL payment
    const paymentVerification = await xrplService.verifyPayment(xrplTransactionHash);

    if (!paymentVerification.validated) {
      return res.status(400).json({
        error: 'XRPL payment not verified',
        details: paymentVerification
      });
    }

    // Verify payment amount (should be at least $15)
    const paymentAmount = parseFloat(paymentVerification.amount);
    if (paymentAmount < 15) { // Assuming XRP rate calculation
      return res.status(400).json({
        error: 'Insufficient payment amount',
        expected: 15,
        received: paymentAmount
      });
    }

    // Grant access on Flare
    let flareResult = null;
    try {
      flareResult = await flareService.grantHospitalAccess(
        tokenId,
        hospitalAddress,
        xrplTransactionHash,
        accessDurationHours || 720 // 30 days default
      );
    } catch (error) {
      console.error('Flare access grant failed:', error.message);
      throw new Error(`Access grant failed: ${error.message}`);
    }

    res.json({
      success: true,
      accessGranted: flareResult.success,
      flareTransaction: flareResult.transactionHash,
      accessValidUntil: flareResult.accessGrantedUntil,
      paymentVerification: {
        amount: paymentVerification.amount,
        transactionHash: xrplTransactionHash,
        verified: true
      }
    });

  } catch (error) {
    console.error('Hospital access grant error:', error);
    res.status(500).json({
      error: 'Failed to grant hospital access',
      details: error.message
    });
  }
});

router.get('/check-hospital-access/:tokenId/:hospitalAddress', async (req, res) => {
  try {
    const { tokenId, hospitalAddress } = req.params;

    if (!tokenId || !hospitalAddress) {
      return res.status(400).json({
        error: 'Token ID and hospital address are required'
      });
    }

    let accessInfo = null;
    try {
      accessInfo = await flareService.checkHospitalAccess(tokenId, hospitalAddress);
    } catch (error) {
      console.error('Flare access check failed:', error.message);
      throw new Error(`Access check failed: ${error.message}`);
    }

    res.json({
      tokenId,
      hospitalAddress,
      hasAccess: accessInfo.hasAccess,
      accessDetails: accessInfo.accessDetails,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Hospital access check error:', error);
    res.status(500).json({
      error: 'Failed to check hospital access',
      details: error.message
    });
  }
});

router.get('/medical-records/:patientAddress', async (req, res) => {
  try {
    const { patientAddress } = req.params;

    if (!patientAddress) {
      return res.status(400).json({
        error: 'Patient address is required'
      });
    }

    let medicalRecords = [];
    try {
      medicalRecords = await flareService.getPatientMedicalRecords(patientAddress);
    } catch (error) {
      console.log('Failed to get medical records from Flare:', error.message);
      // Return empty array if Flare is not available
      medicalRecords = [];
    }

    res.json({
      patientAddress,
      records: medicalRecords,
      count: medicalRecords.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Medical records fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch medical records',
      details: error.message
    });
  }
});

router.get('/health', async (req, res) => {
  try {
    res.json({
      status: 'OK',
      xrpl: {
        connected: xrplService.isConnected(),
        platformWallet: !!xrplService.getPlatformAddress()
      },
      flare: {
        connected: flareService.isConnected(),
        contractInitialized: !!flareService.contract,
        networkInfo: flareService.getNetworkInfo()
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Blockchain health check error:', error);
    res.status(500).json({
      error: 'Health check failed',
      details: error.message
    });
  }
});

router.post('/deploy-contract', async (req, res) => {
  try {
    console.log('📥 Deploy contract request received');
    const { deploymentPrivateKey } = req.body;

    if (!deploymentPrivateKey) {
      return res.status(400).json({
        error: 'Deployment private key is required'
      });
    }

    console.log('🚀 Starting contract deployment process...');

    // Send immediate response to prevent frontend timeout
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Transfer-Encoding': 'chunked'
    });

    // Send initial progress update
    res.write(JSON.stringify({
      status: 'in_progress',
      message: 'Starting contract deployment...',
      step: 'initializing'
    }) + '\n');

    try {
      // Create a progress callback function to send updates to frontend
      const sendProgress = (step, message) => {
        res.write(JSON.stringify({
          status: 'in_progress',
          step: step,
          message: message,
          timestamp: new Date().toISOString()
        }) + '\n');
      };

      // Deploy the smart contract using Flare service with progress updates
      const deploymentResult = await flareService.deployMedicalRecordContractWithProgress(
        deploymentPrivateKey,
        sendProgress
      );

      // Send final success response
      res.write(JSON.stringify({
        status: 'completed',
        success: deploymentResult.success,
        contractAddress: deploymentResult.contractAddress,
        network: deploymentResult.network,
        message: 'Smart contract deployed successfully',
        deploymentOutput: deploymentResult.deploymentOutput
      }) + '\n');

      res.end();

    } catch (deployError) {
      console.error('Contract deployment error:', deployError);

      // Send error response
      res.write(JSON.stringify({
        status: 'error',
        success: false,
        error: 'Contract deployment failed',
        details: deployError.message
      }) + '\n');

      res.end();
    }

  } catch (error) {
    console.error('Deployment request error:', error);

    if (!res.headersSent) {
      res.status(500).json({
        error: 'Contract deployment request failed',
        details: error.message
      });
    }
  }
});

module.exports = router;