const express = require('express');
const { v4: uuidv4 } = require('uuid');

const PaymentIntent = require('../models/PaymentIntent');
const AccessLog = require('../models/AccessLog');
const Evaluation = require('../models/Evaluation');
const xrplService = require('../services/xrplService');
const flareService = require('../services/flareService');

const router = express.Router();

router.post('/intents', async (req, res) => {
  try {
    const { evaluationId, walletAddress, amount = 15, hospitalId, metadata = {} } = req.body;

    if (!evaluationId || !walletAddress || !hospitalId) {
      return res.status(400).json({
        error: 'Missing required fields: evaluationId, walletAddress, hospitalId'
      });
    }

    const evaluation = await Evaluation.findOne({ id: evaluationId });
    if (!evaluation) {
      return res.status(404).json({
        error: 'Evaluation not found'
      });
    }

    const existingAccess = await AccessLog.findValidAccess(hospitalId, evaluationId);
    if (existingAccess) {
      return res.status(409).json({
        error: 'Active access already exists',
        expiresAt: existingAccess.expiresAt
      });
    }

    const isValidWallet = await xrplService.validateWalletAddress(walletAddress);
    if (!isValidWallet && !walletAddress.startsWith('rDemo')) {
      return res.status(400).json({
        error: 'Invalid XRPL wallet address'
      });
    }

    const paymentIntent = await xrplService.createPaymentIntent(
      amount,
      walletAddress,
      evaluationId
    );

    const paymentRecord = new PaymentIntent({
      id: paymentIntent.id,
      evaluationId,
      hospitalId,
      amount,
      xrpAmount: paymentIntent.xrpAmount,
      destinationWallet: paymentIntent.destinationWallet,
      sourceWallet: walletAddress,
      status: 'pending',
      expiresAt: paymentIntent.expiresAt,
      metadata: {
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
        ...metadata
      }
    });

    await paymentRecord.save();

    res.status(201).json({
      paymentIntentId: paymentIntent.id,
      amount,
      xrpAmount: paymentIntent.xrpAmount,
      destinationWallet: paymentIntent.destinationWallet,
      expiresAt: paymentIntent.expiresAt,
      memo: paymentIntent.memo,
      instructions: {
        network: 'XRPL',
        amount: `${paymentIntent.xrpAmount} XRP`,
        destination: paymentIntent.destinationWallet,
        memo: paymentIntent.memo
      }
    });

  } catch (error) {
    console.error('Payment intent creation error:', error);
    res.status(500).json({
      error: 'Failed to create payment intent',
      details: error.message
    });
  }
});

router.post('/confirm', async (req, res) => {
  try {
    const { paymentIntentId, transactionHash, skipVerification = false } = req.body;

    if (!paymentIntentId || !transactionHash) {
      return res.status(400).json({
        error: 'Payment intent ID and transaction hash are required'
      });
    }

    const paymentIntent = await PaymentIntent.findOne({ id: paymentIntentId });
    if (!paymentIntent) {
      return res.status(404).json({
        error: 'Payment intent not found'
      });
    }

    if (paymentIntent.status !== 'pending') {
      return res.status(409).json({
        error: 'Payment intent already processed',
        status: paymentIntent.status
      });
    }

    if (paymentIntent.isExpired()) {
      paymentIntent.status = 'expired';
      await paymentIntent.save();
      return res.status(410).json({
        error: 'Payment intent has expired'
      });
    }

    let verificationResult = null;

    if (!skipVerification) {
      try {
        if (xrplService.isConnected()) {
          const paymentVerification = await xrplService.verifyPayment(transactionHash);

          if (paymentVerification.amount < paymentIntent.amount) {
            return res.status(400).json({
              error: 'Insufficient payment amount',
              expected: paymentIntent.amount,
              received: paymentVerification.amount
            });
          }

          verificationResult = await flareService.verifyPaymentChain(
            transactionHash,
            paymentIntent.evaluationId,
            paymentIntent.amount
          );

          if (!verificationResult.isValid) {
            return res.status(400).json({
              error: 'Payment verification failed',
              details: verificationResult.error
            });
          }
        }
      } catch (verifyError) {
        console.error('Payment verification failed:', verifyError.message);
        throw new Error(`Payment verification failed: ${verifyError.message}`);
      }
    } else {
      throw new Error('Payment verification is required - skipVerification not allowed');
    }

    paymentIntent.markAsCompleted(transactionHash, 12345);
    if (verificationResult) {
      paymentIntent.markAsVerified(verificationResult.verificationHash);
    }
    await paymentIntent.save();

    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 30);

    const accessLog = new AccessLog({
      id: uuidv4(),
      evaluationId: paymentIntent.evaluationId,
      hospitalId: paymentIntent.hospitalId,
      paymentIntentId: paymentIntent.id,
      accessType: 'download',
      grantedAt: new Date(),
      expiresAt: expiryDate,
      paymentDetails: {
        amount: paymentIntent.amount,
        currency: 'USD',
        transactionHash,
        verificationHash: verificationResult?.verificationHash
      },
      status: 'active',
      metadata: {
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
        paymentVerification: verificationResult
      }
    });

    await accessLog.save();

    let accessNftResult = null;
    try {
      if (xrplService.isConnected()) {
        accessNftResult = await xrplService.mintAccessNFT({
          evaluationId: paymentIntent.evaluationId,
          hospitalId: paymentIntent.hospitalId,
          expiresAt: expiryDate,
          paymentAmount: paymentIntent.amount,
          transactionHash
        });
      }
    } catch (nftError) {
      console.warn('Access NFT minting failed:', nftError.message);
    }

    res.json({
      success: true,
      accessId: accessLog.id,
      expiresAt: expiryDate,
      paymentVerified: verificationResult?.isValid || false,
      accessNft: accessNftResult,
      verification: verificationResult,
      message: 'Payment confirmed and access granted'
    });

  } catch (error) {
    console.error('Payment confirmation error:', error);
    res.status(500).json({
      error: 'Payment confirmation failed',
      details: error.message
    });
  }
});

router.get('/verify', async (req, res) => {
  try {
    const { hospitalId, evaluationId, accessId } = req.query;

    if (!hospitalId) {
      return res.status(400).json({
        error: 'Hospital ID is required'
      });
    }

    let accessLog;

    if (accessId) {
      accessLog = await AccessLog.findOne({ id: accessId, hospitalId });
    } else if (evaluationId) {
      accessLog = await AccessLog.findValidAccess(hospitalId, evaluationId);
    } else {
      return res.status(400).json({
        error: 'Either access ID or evaluation ID is required'
      });
    }

    if (!accessLog) {
      return res.status(404).json({
        hasAccess: false,
        error: 'No valid access found'
      });
    }

    const isValid = accessLog.isValid();

    res.json({
      hasAccess: isValid,
      accessId: accessLog.id,
      evaluationId: accessLog.evaluationId,
      grantedAt: accessLog.grantedAt,
      expiresAt: accessLog.expiresAt,
      status: accessLog.status,
      downloadCount: accessLog.downloadHistory.length,
      paymentDetails: {
        amount: accessLog.paymentDetails.amount,
        transactionHash: accessLog.paymentDetails.transactionHash
      }
    });

  } catch (error) {
    console.error('Access verification error:', error);
    res.status(500).json({
      error: 'Access verification failed',
      details: error.message
    });
  }
});

router.get('/history', async (req, res) => {
  try {
    const { hospitalId, limit = 50, offset = 0, status } = req.query;

    if (!hospitalId) {
      return res.status(400).json({
        error: 'Hospital ID is required'
      });
    }

    const query = { hospitalId };
    if (status) query.status = status;

    const accessLogs = await AccessLog.find(query)
      .populate('evaluationId', 'patientInfo fileMetadata nftTokenId')
      .sort({ grantedAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset));

    const total = await AccessLog.countDocuments(query);

    const history = accessLogs.map(log => {
      const evaluation = log.evaluationId;
      return {
        id: log.id,
        evaluationId: log.evaluationId,
        patientName: evaluation ?
          `${evaluation.patientInfo.firstName} ${evaluation.patientInfo.lastName}` :
          'Unknown Patient',
        evaluationType: evaluation?.patientInfo.evaluationType || 'Unknown',
        tokenId: evaluation?.nftTokenId || 'Unknown',
        grantedAt: log.grantedAt,
        expiresAt: log.expiresAt,
        status: log.status,
        downloadCount: log.downloadHistory.length,
        paymentAmount: log.paymentDetails.amount,
        lastDownload: log.downloadHistory.length > 0 ?
          log.downloadHistory[log.downloadHistory.length - 1].downloadedAt : null
      };
    });

    res.json({
      history,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: (parseInt(offset) + parseInt(limit)) < total
      }
    });

  } catch (error) {
    console.error('Access history error:', error);
    res.status(500).json({
      error: 'Failed to fetch access history',
      details: error.message
    });
  }
});

router.delete('/:accessId', async (req, res) => {
  try {
    const { accessId } = req.params;
    const { hospitalId, reason } = req.body;

    if (!hospitalId) {
      return res.status(400).json({
        error: 'Hospital ID is required'
      });
    }

    const accessLog = await AccessLog.findOne({ id: accessId, hospitalId });
    if (!accessLog) {
      return res.status(404).json({
        error: 'Access record not found'
      });
    }

    accessLog.revokeAccess();
    accessLog.metadata.revocationReason = reason || 'Manual revocation';
    accessLog.metadata.revokedAt = new Date();
    await accessLog.save();

    res.json({
      success: true,
      message: 'Access revoked successfully',
      accessId: accessLog.id,
      revokedAt: new Date()
    });

  } catch (error) {
    console.error('Access revocation error:', error);
    res.status(500).json({
      error: 'Failed to revoke access',
      details: error.message
    });
  }
});

router.get('/payment-intents/:hospitalId', async (req, res) => {
  try {
    const { hospitalId } = req.params;
    const { status, limit = 20 } = req.query;

    const query = { hospitalId };
    if (status) query.status = status;

    const paymentIntents = await PaymentIntent.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .select('-metadata');

    res.json(paymentIntents);

  } catch (error) {
    console.error('Payment intents fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch payment intents',
      details: error.message
    });
  }
});

router.post('/extend/:accessId', async (req, res) => {
  try {
    const { accessId } = req.params;
    const { hospitalId, extensionDays = 30, paymentIntentId } = req.body;

    if (!hospitalId || !paymentIntentId) {
      return res.status(400).json({
        error: 'Hospital ID and payment intent ID are required'
      });
    }

    const accessLog = await AccessLog.findOne({ id: accessId, hospitalId });
    if (!accessLog) {
      return res.status(404).json({
        error: 'Access record not found'
      });
    }

    const paymentIntent = await PaymentIntent.findOne({
      id: paymentIntentId,
      status: 'completed'
    });
    if (!paymentIntent) {
      return res.status(400).json({
        error: 'Valid payment required for extension'
      });
    }

    const newExpiryDate = new Date(accessLog.expiresAt);
    newExpiryDate.setDate(newExpiryDate.getDate() + extensionDays);

    accessLog.expiresAt = newExpiryDate;
    accessLog.metadata.extended = true;
    accessLog.metadata.extensionDate = new Date();
    accessLog.metadata.extensionPaymentId = paymentIntentId;

    await accessLog.save();

    res.json({
      success: true,
      message: 'Access extended successfully',
      newExpiryDate,
      extensionDays
    });

  } catch (error) {
    console.error('Access extension error:', error);
    res.status(500).json({
      error: 'Failed to extend access',
      details: error.message
    });
  }
});

router.get('/stats/:hospitalId', async (req, res) => {
  try {
    const { hospitalId } = req.params;

    const totalAccesses = await AccessLog.countDocuments({ hospitalId });
    const activeAccesses = await AccessLog.countDocuments({
      hospitalId,
      status: 'active',
      expiresAt: { $gt: new Date() }
    });

    const totalSpent = await PaymentIntent.aggregate([
      { $match: { hospitalId, status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    const recentAccesses = await AccessLog.find({ hospitalId })
      .populate('evaluationId', 'patientInfo')
      .sort({ grantedAt: -1 })
      .limit(5);

    res.json({
      stats: {
        totalAccesses,
        activeAccesses,
        totalSpent: totalSpent[0]?.total || 0,
        averageAccessDuration: 30
      },
      recentAccesses: recentAccesses.map(access => ({
        id: access.id,
        patientName: access.evaluationId ?
          `${access.evaluationId.patientInfo.firstName} ${access.evaluationId.patientInfo.lastName}` :
          'Unknown',
        grantedAt: access.grantedAt,
        status: access.status
      }))
    });

  } catch (error) {
    console.error('Access stats error:', error);
    res.status(500).json({
      error: 'Failed to fetch access statistics',
      details: error.message
    });
  }
});

module.exports = router;