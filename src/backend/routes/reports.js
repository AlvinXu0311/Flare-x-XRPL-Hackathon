const express = require('express');
const localStorageService = require('../services/localStorageService');
const s3Service = require('../services/s3Service');
const encryptionService = require('../services/encryptionService');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { limit = 50, offset = 0, status, evaluationType } = req.query;

    const result = localStorageService.getAllEvaluations(parseInt(limit), parseInt(offset));
    let evaluations = result.evaluations;

    if (status) {
      evaluations = evaluations.filter(eval => eval.status === status);
    }
    if (evaluationType) {
      evaluations = evaluations.filter(eval => eval.patientInfo.evaluationType === evaluationType);
    }

    const reports = evaluations.map(evaluation => ({
      id: evaluation.id,
      tokenId: evaluation.nftTokenId,
      patientName: `${evaluation.patientInfo.firstName} ${evaluation.patientInfo.lastName}`,
      type: evaluation.patientInfo.evaluationType,
      uploadDate: evaluation.fileMetadata.uploadDate.split('T')[0],
      fileSize: `${(evaluation.fileMetadata.size / (1024 * 1024)).toFixed(2)} MB`,
      status: evaluation.status,
      hasAccess: false
    }));

    res.json({
      reports,
      pagination: {
        total: result.total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: (parseInt(offset) + parseInt(limit)) < result.total
      }
    });

  } catch (error) {
    console.error('Reports fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch reports',
      details: error.message
    });
  }
});

router.get('/search', async (req, res) => {
  try {
    const { tokenId, patientName, evaluationType, dateFrom, dateTo, hospitalId } = req.query;

    const searchQuery = {};
    if (tokenId) searchQuery.tokenId = tokenId;
    if (patientName) searchQuery.patientName = patientName;
    if (evaluationType) searchQuery.evaluationType = evaluationType;

    const evaluations = localStorageService.searchEvaluations(searchQuery);

    let filteredEvaluations = evaluations;

    if (dateFrom || dateTo) {
      filteredEvaluations = evaluations.filter(evaluation => {
        const uploadDate = new Date(evaluation.fileMetadata.uploadDate);
        if (dateFrom && uploadDate < new Date(dateFrom)) return false;
        if (dateTo && uploadDate > new Date(dateTo)) return false;
        return true;
      });
    }

    const reports = filteredEvaluations.slice(0, 100).map((evaluation) => {
      let hasAccess = false;

      if (hospitalId) {
        const validAccess = localStorageService.findValidAccess(hospitalId, evaluation.id);
        hasAccess = !!validAccess;
      }

      return {
        id: evaluation.id,
        tokenId: evaluation.nftTokenId,
        patientName: `${evaluation.patientInfo.firstName} ${evaluation.patientInfo.lastName}`,
        type: evaluation.patientInfo.evaluationType,
        uploadDate: evaluation.fileMetadata.uploadDate.split('T')[0],
        fileSize: `${(evaluation.fileMetadata.size / (1024 * 1024)).toFixed(2)} MB`,
        status: evaluation.status,
        hasAccess,
        blockchain: evaluation.blockchain
      };
    });

    res.json(reports);

  } catch (error) {
    console.error('Reports search error:', error);
    res.status(500).json({
      error: 'Search failed',
      details: error.message
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { hospitalId } = req.query;

    const evaluation = localStorageService.findEvaluationById(id);

    if (!evaluation) {
      return res.status(404).json({
        error: 'Evaluation not found'
      });
    }

    let hasAccess = false;
    let accessInfo = null;

    if (hospitalId) {
      const validAccess = localStorageService.findValidAccess(hospitalId, evaluation.id);
      if (validAccess) {
        hasAccess = true;
        accessInfo = {
          grantedAt: validAccess.createdAt,
          expiresAt: validAccess.expiresAt,
          downloadCount: 0
        };
      }
    }

    const report = {
      id: evaluation.id,
      tokenId: evaluation.nftTokenId,
      fileHash: evaluation.fileHash,
      patientInfo: {
        name: `${evaluation.patientInfo.firstName} ${evaluation.patientInfo.lastName}`,
        evaluationType: evaluation.patientInfo.evaluationType,
        dateOfBirth: evaluation.patientInfo.dateOfBirth,
        notes: evaluation.patientInfo.notes
      },
      fileMetadata: {
        originalName: evaluation.fileMetadata.originalName,
        mimeType: evaluation.fileMetadata.mimeType,
        size: evaluation.fileMetadata.size,
        uploadDate: evaluation.fileMetadata.uploadDate
      },
      blockchain: evaluation.blockchain,
      status: evaluation.status,
      hasAccess,
      accessInfo
    };

    res.json(report);

  } catch (error) {
    console.error('Report fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch report',
      details: error.message
    });
  }
});

router.post('/', async (req, res) => {
  try {
    const evaluationData = req.body;

    if (!evaluationData.patientInfo || !evaluationData.fileHash) {
      return res.status(400).json({
        error: 'Missing required evaluation data'
      });
    }

    const evaluation = new Evaluation(evaluationData);
    await evaluation.save();

    res.status(201).json({
      success: true,
      evaluationId: evaluation.id,
      message: 'Evaluation record created'
    });

  } catch (error) {
    console.error('Report creation error:', error);
    res.status(500).json({
      error: 'Failed to create evaluation record',
      details: error.message
    });
  }
});

router.get('/:id/logs', async (req, res) => {
  try {
    const { id } = req.params;

    const evaluation = await Evaluation.findOne({ id });
    if (!evaluation) {
      return res.status(404).json({
        error: 'Evaluation not found'
      });
    }

    const accessLogs = await AccessLog.find({ evaluationId: id })
      .sort({ grantedAt: -1 })
      .select('-paymentDetails.transactionHash');

    const logs = accessLogs.map(log => ({
      id: log.id,
      hospitalId: log.hospitalId,
      hospitalName: log.metadata?.hospitalName || 'Unknown Hospital',
      grantedAt: log.grantedAt,
      expiresAt: log.expiresAt,
      status: log.status,
      downloadCount: log.downloadHistory.length,
      lastDownload: log.downloadHistory.length > 0 ?
        log.downloadHistory[log.downloadHistory.length - 1].downloadedAt : null,
      paymentAmount: log.paymentDetails?.amount || 15
    }));

    res.json({
      evaluationId: id,
      patientName: evaluation.getPatientName(),
      accessLogs: logs,
      totalAccesses: logs.length,
      activeAccesses: logs.filter(log => log.status === 'active').length
    });

  } catch (error) {
    console.error('Access logs fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch access logs',
      details: error.message
    });
  }
});

router.post('/:id/download', async (req, res) => {
  try {
    const { id } = req.params;
    const { hospitalId } = req.body;

    if (!hospitalId) {
      return res.status(400).json({
        error: 'Hospital ID is required'
      });
    }

    const evaluation = await Evaluation.findOne({ id });
    if (!evaluation) {
      return res.status(404).json({
        error: 'Evaluation not found'
      });
    }

    const accessLog = await AccessLog.findValidAccess(hospitalId, evaluation.id);
    if (!accessLog) {
      return res.status(403).json({
        error: 'Access denied. Payment required.'
      });
    }

    const downloadResult = await s3Service.downloadFile(evaluation.s3Key);

    const decryptionResult = encryptionService.decryptFile(
      downloadResult.fileBuffer,
      evaluation.encryptionKey
    );

    accessLog.addDownload(
      decryptionResult.decryptedData.length,
      req.headers['user-agent'],
      req.ip
    );
    await accessLog.save();

    res.set({
      'Content-Type': evaluation.fileMetadata.mimeType,
      'Content-Disposition': `attachment; filename="${evaluation.fileMetadata.originalName}"`,
      'Content-Length': decryptionResult.decryptedData.length,
      'Cache-Control': 'private, no-cache',
      'X-Download-Id': accessLog.id
    });

    res.send(decryptionResult.decryptedData);

  } catch (error) {
    console.error('File download error:', error);
    res.status(500).json({
      error: 'Download failed',
      details: error.message
    });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const evaluation = await Evaluation.findOne({ id });
    if (!evaluation) {
      return res.status(404).json({
        error: 'Evaluation not found'
      });
    }

    Object.keys(updates).forEach(key => {
      if (key !== 'encryptionKey' && key !== 's3Key') {
        evaluation[key] = updates[key];
      }
    });

    await evaluation.save();

    res.json({
      success: true,
      message: 'Evaluation updated successfully'
    });

  } catch (error) {
    console.error('Report update error:', error);
    res.status(500).json({
      error: 'Failed to update evaluation',
      details: error.message
    });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const evaluation = await Evaluation.findOne({ id });
    if (!evaluation) {
      return res.status(404).json({
        error: 'Evaluation not found'
      });
    }

    await s3Service.deleteFile(evaluation.s3Key);

    await AccessLog.deleteMany({ evaluationId: id });

    await Evaluation.deleteOne({ id });

    res.json({
      success: true,
      message: 'Evaluation and all associated data deleted successfully'
    });

  } catch (error) {
    console.error('Report deletion error:', error);
    res.status(500).json({
      error: 'Failed to delete evaluation',
      details: error.message
    });
  }
});

router.get('/stats/overview', async (req, res) => {
  try {
    const stats = localStorageService.getStats();

    const recentUploads = localStorageService.getAllEvaluations(5, 0).evaluations.map(evaluation => ({
      id: evaluation.id,
      patientName: `${evaluation.patientInfo.firstName} ${evaluation.patientInfo.lastName}`,
      type: evaluation.patientInfo.evaluationType,
      uploadDate: evaluation.fileMetadata.uploadDate
    }));

    res.json({
      stats: {
        totalEvaluations: stats.totalEvaluations,
        totalAccesses: stats.totalAccessLogs,
        activeAccesses: stats.totalAccessLogs,
        evaluationsByType: stats.evaluationsByType
      },
      recentUploads
    });

  } catch (error) {
    console.error('Stats fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch statistics',
      details: error.message
    });
  }
});

module.exports = router;