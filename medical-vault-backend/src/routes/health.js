const express = require('express')
const { sequelize } = require('../models')
// const ipfsService = require('../services/ipfsService') // DISABLED - Not using IPFS
const blockchainService = require('../services/blockchainService')
const logger = require('../utils/logger')

const router = express.Router()

/**
 * @route GET /api/v1/health
 * @desc Basic health check
 * @access Public
 */
router.get('/', async (req, res) => {
  const healthCheck = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {}
  }

  try {
    // Check database
    await sequelize.authenticate()
    healthCheck.services.database = { status: 'healthy' }
  } catch (error) {
    healthCheck.services.database = { status: 'unhealthy', error: error.message }
    healthCheck.status = 'unhealthy'
  }

  res.status(healthCheck.status === 'healthy' ? 200 : 503).json({
    success: healthCheck.status === 'healthy',
    data: healthCheck
  })
})

/**
 * @route GET /api/v1/health/detailed
 * @desc Detailed health check including external services
 * @access Public
 */
router.get('/detailed', async (req, res) => {
  const healthCheck = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    services: {}
  }

  // Check database
  try {
    await sequelize.authenticate()
    const dbStats = await sequelize.query('SELECT version()', { type: sequelize.QueryTypes.SELECT })
    healthCheck.services.database = {
      status: 'healthy',
      version: dbStats[0]?.version || 'unknown'
    }
  } catch (error) {
    healthCheck.services.database = {
      status: 'unhealthy',
      error: error.message
    }
    healthCheck.status = 'unhealthy'
  }

  // IPFS disabled - using local storage
  healthCheck.services.storage = {
    status: 'healthy',
    type: 'local_filesystem',
    note: 'Using local file storage instead of IPFS'
  }

  // Check blockchain
  try {
    const blockchainHealth = await blockchainService.healthCheck()
    healthCheck.services.blockchain = blockchainHealth
    if (!blockchainHealth.healthy) {
      healthCheck.status = 'degraded'
    }
  } catch (error) {
    healthCheck.services.blockchain = {
      status: 'unhealthy',
      error: error.message
    }
    healthCheck.status = 'unhealthy'
  }

  const statusCode = healthCheck.status === 'healthy' ? 200 :
                    healthCheck.status === 'degraded' ? 200 : 503

  res.status(statusCode).json({
    success: healthCheck.status !== 'unhealthy',
    data: healthCheck
  })
})

/**
 * @route GET /api/v1/health/ready
 * @desc Readiness probe for Kubernetes
 * @access Public
 */
router.get('/ready', async (req, res) => {
  try {
    // Check if all critical services are ready
    await sequelize.authenticate()
    // await ipfsService.initialize() // DISABLED - Not using IPFS
    await blockchainService.initialize()

    res.json({
      success: true,
      status: 'ready'
    })
  } catch (error) {
    logger.error('Readiness check failed', error)
    res.status(503).json({
      success: false,
      status: 'not ready',
      error: error.message
    })
  }
})

/**
 * @route GET /api/v1/health/live
 * @desc Liveness probe for Kubernetes
 * @access Public
 */
router.get('/live', (req, res) => {
  res.json({
    success: true,
    status: 'alive',
    timestamp: new Date().toISOString()
  })
})

module.exports = router