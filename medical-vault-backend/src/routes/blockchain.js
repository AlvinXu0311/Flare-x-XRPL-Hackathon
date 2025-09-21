const express = require('express')
const { authMiddleware, requireRole } = require('../middleware/auth')
const { accessValidationRules, blockchainValidationRules } = require('../middleware/validation')
const blockchainService = require('../services/blockchainService')
const { AccessLog } = require('../models')
const logger = require('../utils/logger')

const router = express.Router()

/**
 * @route POST /api/v1/blockchain/upload
 * @desc Upload document metadata to blockchain
 * @access Private
 */
router.post('/upload',
  authMiddleware,
  blockchainValidationRules.uploadDocument,
  async (req, res) => {
    try {
      const { patientId, documentType, hashURI } = req.body

      // Check permissions (implement your access control logic)
      const hasPermission = await blockchainService.checkReadPermission(
        patientId,
        req.user.walletAddress
      )

      if (!hasPermission && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        })
      }

      const result = await blockchainService.uploadDocument(
        patientId,
        parseInt(documentType),
        hashURI
      )

      // Log the blockchain transaction
      await AccessLog.logAccess({
        patientId,
        accessedBy: req.user.id,
        accessType: 'upload',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        blockchainTxHash: result.transactionHash,
        success: true
      })

      logger.logBlockchainEvent('DocumentUploaded', {
        patientId,
        documentType,
        txHash: result.transactionHash,
        userId: req.user.id
      })

      res.json({
        success: true,
        data: result
      })

    } catch (error) {
      logger.logError(error, req)
      res.status(500).json({
        success: false,
        error: 'Blockchain upload failed'
      })
    }
  }
)

/**
 * @route GET /api/v1/blockchain/document/:patientId/:documentType
 * @desc Get document metadata from blockchain
 * @access Private
 */
router.get('/document/:patientId/:documentType',
  authMiddleware,
  async (req, res) => {
    try {
      const { patientId, documentType } = req.params

      // Check permissions
      const hasPermission = await blockchainService.checkReadPermission(
        patientId,
        req.user.walletAddress
      )

      if (!hasPermission && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        })
      }

      const documentData = await blockchainService.getDocumentMeta(
        patientId,
        parseInt(documentType)
      )

      // Log access
      await AccessLog.logAccess({
        patientId,
        accessedBy: req.user.id,
        accessType: 'view',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        success: true,
        metadata: { documentType }
      })

      res.json({
        success: true,
        data: { documentData }
      })

    } catch (error) {
      logger.logError(error, req)
      res.status(500).json({
        success: false,
        error: 'Failed to fetch document from blockchain'
      })
    }
  }
)

/**
 * @route POST /api/v1/blockchain/access/grant
 * @desc Grant read access to an address
 * @access Private (Guardian, Admin, or Patient)
 */
router.post('/access/grant',
  authMiddleware,
  accessValidationRules.grantAccess,
  async (req, res) => {
    try {
      const { patientId, readerAddress, allowed, reason } = req.body

      // Check if user has permission to grant access
      const hasPermission = await blockchainService.checkReadPermission(
        patientId,
        req.user.walletAddress
      )

      if (!hasPermission && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        })
      }

      const result = await blockchainService.grantReadAccess(
        patientId,
        readerAddress,
        allowed
      )

      // Log the access grant
      await AccessLog.logAccess({
        patientId,
        accessedBy: req.user.id,
        accessType: 'share',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        blockchainTxHash: result.transactionHash,
        accessReason: reason,
        success: true,
        metadata: {
          readerAddress,
          allowed
        }
      })

      logger.logBlockchainEvent('AccessGranted', {
        patientId,
        readerAddress,
        allowed,
        txHash: result.transactionHash,
        grantedBy: req.user.id
      })

      res.json({
        success: true,
        data: {
          message: `Access ${allowed ? 'granted' : 'revoked'} successfully`,
          ...result
        }
      })

    } catch (error) {
      logger.logError(error, req)
      res.status(500).json({
        success: false,
        error: 'Failed to grant access'
      })
    }
  }
)

/**
 * @route GET /api/v1/blockchain/access/check/:patientId/:address
 * @desc Check if address has read permission
 * @access Private
 */
router.get('/access/check/:patientId/:address',
  authMiddleware,
  async (req, res) => {
    try {
      const { patientId, address } = req.params

      // Only allow checking own permissions or admin
      if (req.user.walletAddress.toLowerCase() !== address.toLowerCase() && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Can only check own permissions'
        })
      }

      const hasPermission = await blockchainService.checkReadPermission(patientId, address)

      res.json({
        success: true,
        data: {
          patientId,
          address,
          hasPermission
        }
      })

    } catch (error) {
      logger.logError(error, req)
      res.status(500).json({
        success: false,
        error: 'Failed to check permissions'
      })
    }
  }
)

/**
 * @route GET /api/v1/blockchain/events
 * @desc Get contract events
 * @access Private (Admin only)
 */
router.get('/events',
  authMiddleware,
  requireRole(['admin']),
  async (req, res) => {
    try {
      const { fromBlock = 0, toBlock = 'latest', limit = 100 } = req.query

      const events = await blockchainService.getContractEvents(
        parseInt(fromBlock),
        toBlock === 'latest' ? 'latest' : parseInt(toBlock)
      )

      // Limit results
      const limitedEvents = events.slice(0, parseInt(limit))

      res.json({
        success: true,
        data: {
          events: limitedEvents,
          total: events.length,
          fromBlock,
          toBlock
        }
      })

    } catch (error) {
      logger.logError(error, req)
      res.status(500).json({
        success: false,
        error: 'Failed to fetch events'
      })
    }
  }
)

/**
 * @route GET /api/v1/blockchain/gas-price
 * @desc Get current gas price
 * @access Private
 */
router.get('/gas-price',
  authMiddleware,
  async (req, res) => {
    try {
      const gasPrice = await blockchainService.getGasPrice()

      res.json({
        success: true,
        data: gasPrice
      })

    } catch (error) {
      logger.logError(error, req)
      res.status(500).json({
        success: false,
        error: 'Failed to fetch gas price'
      })
    }
  }
)

/**
 * @route GET /api/v1/blockchain/health
 * @desc Check blockchain service health
 * @access Public
 */
router.get('/health', async (req, res) => {
  try {
    const health = await blockchainService.healthCheck()

    res.json({
      success: health.healthy,
      data: health
    })

  } catch (error) {
    logger.logError(error, req)
    res.status(500).json({
      success: false,
      error: 'Health check failed'
    })
  }
})

module.exports = router