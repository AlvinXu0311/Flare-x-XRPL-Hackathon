const DocumentMapping = require('../models/DocumentMapping');
const { validationResult } = require('express-validator');

/**
 * Store a new document mapping
 * POST /api/mappings
 */
const storeMapping = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const {
      txHash,
      walletAddress,
      contentHash,
      fileName,
      fileSize,
      contentType,
      patientId,
      docType,
      blockNumber,
      gasUsed,
      version,
      localFileId,
      contentURI,
      deviceInfo
    } = req.body;

    // Check if mapping already exists
    const existingMapping = await DocumentMapping.findByTxHash(txHash);
    if (existingMapping) {
      return res.status(409).json({
        success: false,
        message: 'Mapping already exists for this transaction hash'
      });
    }

    // Create new mapping
    const mapping = new DocumentMapping({
      txHash,
      walletAddress,
      contentHash,
      fileName,
      fileSize,
      contentType,
      patientId,
      docType,
      blockNumber,
      gasUsed,
      version,
      localFileId,
      contentURI,
      deviceInfo,
      isAvailableLocally: true
    });

    await mapping.save();

    console.log(`✅ Document mapping stored: ${txHash} -> ${fileName}`);

    res.status(201).json({
      success: true,
      message: 'Document mapping stored successfully',
      data: {
        id: mapping._id,
        txHash: mapping.txHash,
        fileName: mapping.fileName,
        uploadDate: mapping.uploadDate
      }
    });

  } catch (error) {
    console.error('❌ Store mapping error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to store document mapping',
      error: error.message
    });
  }
};

/**
 * Get mappings by wallet address
 * GET /api/mappings/wallet/:address
 */
const getMappingsByWallet = async (req, res) => {
  try {
    const { address } = req.params;
    const { limit = 20, offset = 0 } = req.query;

    const mappings = await DocumentMapping.find({ walletAddress: address })
      .sort({ uploadDate: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset))
      .select('-deviceInfo'); // Exclude sensitive device info

    res.json({
      success: true,
      data: mappings,
      count: mappings.length
    });

  } catch (error) {
    console.error('❌ Get mappings by wallet error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve mappings',
      error: error.message
    });
  }
};

/**
 * Get mapping by transaction hash
 * GET /api/mappings/tx/:hash
 */
const getMappingByTxHash = async (req, res) => {
  try {
    const { hash } = req.params;

    const mapping = await DocumentMapping.findByTxHash(hash);
    if (!mapping) {
      return res.status(404).json({
        success: false,
        message: 'Mapping not found for this transaction hash'
      });
    }

    // Update last accessed time
    await mapping.updateLastAccessed();

    res.json({
      success: true,
      data: mapping
    });

  } catch (error) {
    console.error('❌ Get mapping by tx hash error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve mapping',
      error: error.message
    });
  }
};

/**
 * Get mappings by patient ID
 * GET /api/mappings/patient/:patientId
 */
const getMappingsByPatient = async (req, res) => {
  try {
    const { patientId } = req.params;

    const mappings = await DocumentMapping.findByPatient(patientId)
      .select('-deviceInfo');

    res.json({
      success: true,
      data: mappings,
      count: mappings.length
    });

  } catch (error) {
    console.error('❌ Get mappings by patient error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve patient mappings',
      error: error.message
    });
  }
};

/**
 * Update local availability status
 * PATCH /api/mappings/:txHash/local-status
 */
const updateLocalStatus = async (req, res) => {
  try {
    const { txHash } = req.params;
    const { isAvailableLocally } = req.body;

    const mapping = await DocumentMapping.findByTxHash(txHash);
    if (!mapping) {
      return res.status(404).json({
        success: false,
        message: 'Mapping not found'
      });
    }

    mapping.isAvailableLocally = isAvailableLocally;
    await mapping.save();

    res.json({
      success: true,
      message: 'Local status updated successfully',
      data: {
        txHash: mapping.txHash,
        isAvailableLocally: mapping.isAvailableLocally
      }
    });

  } catch (error) {
    console.error('❌ Update local status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update local status',
      error: error.message
    });
  }
};

/**
 * Delete mapping
 * DELETE /api/mappings/:txHash
 */
const deleteMapping = async (req, res) => {
  try {
    const { txHash } = req.params;

    const mapping = await DocumentMapping.findOneAndDelete({ txHash });
    if (!mapping) {
      return res.status(404).json({
        success: false,
        message: 'Mapping not found'
      });
    }

    res.json({
      success: true,
      message: 'Mapping deleted successfully',
      data: {
        txHash: mapping.txHash,
        fileName: mapping.fileName
      }
    });

  } catch (error) {
    console.error('❌ Delete mapping error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete mapping',
      error: error.message
    });
  }
};

/**
 * Get mapping statistics
 * GET /api/mappings/stats/:walletAddress
 */
const getMappingStats = async (req, res) => {
  try {
    const { walletAddress } = req.params;

    const stats = await DocumentMapping.aggregate([
      { $match: { walletAddress } },
      {
        $group: {
          _id: null,
          totalMappings: { $sum: 1 },
          totalFileSize: { $sum: '$fileSize' },
          locallyAvailable: {
            $sum: { $cond: ['$isAvailableLocally', 1, 0] }
          },
          docTypes: {
            $push: '$docType'
          }
        }
      },
      {
        $project: {
          _id: 0,
          totalMappings: 1,
          totalFileSize: 1,
          locallyAvailable: 1,
          percentageLocal: {
            $multiply: [
              { $divide: ['$locallyAvailable', '$totalMappings'] },
              100
            ]
          }
        }
      }
    ]);

    res.json({
      success: true,
      data: stats.length > 0 ? stats[0] : {
        totalMappings: 0,
        totalFileSize: 0,
        locallyAvailable: 0,
        percentageLocal: 0
      }
    });

  } catch (error) {
    console.error('❌ Get mapping stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve mapping statistics',
      error: error.message
    });
  }
};

module.exports = {
  storeMapping,
  getMappingsByWallet,
  getMappingByTxHash,
  getMappingsByPatient,
  updateLocalStatus,
  deleteMapping,
  getMappingStats
};