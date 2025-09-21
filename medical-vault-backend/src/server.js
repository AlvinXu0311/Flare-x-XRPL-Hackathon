require('dotenv').config()

const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const morgan = require('morgan')
const compression = require('compression')
const rateLimit = require('express-rate-limit')
const path = require('path')

const logger = require('./utils/logger')
const routes = require('./routes')
const { sequelize } = require('./models')

// Create Express app
const app = express()

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}))

// CORS configuration
const corsOptions = {
  origin: (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:3000').split(','),
  credentials: process.env.CORS_CREDENTIALS === 'true',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-user-agent']
}

app.use(cors(corsOptions))

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  skipSuccessfulRequests: process.env.RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS === 'true',
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later.'
  }
})

app.use(limiter)

// Compression middleware
app.use(compression())

// Body parsing middleware
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// HTTP request logging
app.use(morgan('combined', { stream: logger.stream }))

// Request ID middleware for tracing
app.use((req, res, next) => {
  req.id = Math.random().toString(36).substring(2, 15)
  res.setHeader('X-Request-ID', req.id)
  next()
})

// Request timing middleware
app.use((req, res, next) => {
  req.startTime = Date.now()
  res.on('finish', () => {
    const responseTime = Date.now() - req.startTime
    logger.logRequest(req, res, responseTime)
  })
  next()
})

// Create upload directory if it doesn't exist
const uploadDir = process.env.UPLOAD_TEMP_DIR || './tmp/uploads'
const fs = require('fs')
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

// API routes
const apiPrefix = process.env.API_PREFIX || '/api/v1'
app.use(apiPrefix, routes)

// Serve static files (for API documentation, etc.)
if (process.env.ENABLE_API_DOCS === 'true') {
  app.use('/docs', express.static(path.join(__dirname, '../docs')))
}

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  })
})

// Global error handler
app.use((error, req, res, next) => {
  logger.logError(error, req)

  // Handle multer errors
  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      error: 'File too large'
    })
  }

  if (error.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      success: false,
      error: 'Unexpected file field'
    })
  }

  // Handle validation errors
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: 'Validation error',
      details: error.errors
    })
  }

  // Handle Sequelize errors
  if (error.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({
      success: false,
      error: 'Resource already exists'
    })
  }

  if (error.name === 'SequelizeForeignKeyConstraintError') {
    return res.status(400).json({
      success: false,
      error: 'Invalid reference'
    })
  }

  // Default error response
  res.status(error.status || 500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: error.stack })
  })
})

// Graceful shutdown handling
const gracefulShutdown = async (signal) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`)

  try {
    // Close database connections
    await sequelize.close()
    logger.info('Database connections closed')

    // Additional cleanup can be added here
    // - Close IPFS connections
    // - Close Redis connections
    // - Finish pending operations

    process.exit(0)
  } catch (error) {
    logger.error('Error during graceful shutdown:', error)
    process.exit(1)
  }
}

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Promise Rejection:', { reason, promise })
})

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error)
  process.exit(1)
})

// Start server
const PORT = process.env.PORT || 3001
const HOST = process.env.HOST || '0.0.0.0'

async function startServer() {
  try {
    // Test database connection
    await sequelize.authenticate()
    logger.info('Database connection established successfully')

    // Sync database (only in development)
    if (process.env.NODE_ENV === 'development') {
      await sequelize.sync({ alter: true })
      logger.info('Database synchronized')
    }

    // Start HTTP server
    const server = app.listen(PORT, HOST, () => {
      logger.info(`Medical Vault Backend API server running on ${HOST}:${PORT}`)
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`)
      logger.info(`API Prefix: ${apiPrefix}`)
    })

    // Handle server errors
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(`Port ${PORT} is already in use`)
      } else {
        logger.error('Server error:', error)
      }
      process.exit(1)
    })

    return server

  } catch (error) {
    logger.error('Failed to start server:', error)
    process.exit(1)
  }
}

// Start the server if this file is run directly
if (require.main === module) {
  startServer()
}

module.exports = { app, startServer }