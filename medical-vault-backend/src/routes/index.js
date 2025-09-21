const express = require('express')
const authRoutes = require('./auth')
const documentRoutes = require('./documents')
const patientRoutes = require('./patients')
const blockchainRoutes = require('./blockchain')
const healthRoutes = require('./health')

const router = express.Router()

// Health check endpoint
router.use('/health', healthRoutes)

// Authentication routes
router.use('/auth', authRoutes)

// Document management routes
router.use('/documents', documentRoutes)

// Patient management routes
router.use('/patients', patientRoutes)

// Blockchain interaction routes
router.use('/blockchain', blockchainRoutes)

// API info endpoint
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Medical Vault API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      auth: '/auth',
      documents: '/documents',
      patients: '/patients',
      blockchain: '/blockchain'
    }
  })
})

module.exports = router