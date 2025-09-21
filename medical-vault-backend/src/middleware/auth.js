const jwt = require('jsonwebtoken')
const { User } = require('../models')
const logger = require('../utils/logger')

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '')

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Access denied. No token provided.'
      })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    const user = await User.findByPk(decoded.userId)
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        error: 'Invalid token or user inactive.'
      })
    }

    req.user = user
    next()

  } catch (error) {
    logger.logError(error, req)

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: 'Invalid token.'
      })
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token expired.'
      })
    }

    res.status(500).json({
      success: false,
      error: 'Authentication error.'
    })
  }
}

const optionalAuth = async (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '')

  if (!token) {
    return next()
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const user = await User.findByPk(decoded.userId)

    if (user && user.isActive) {
      req.user = user
    }
  } catch (error) {
    // Ignore auth errors for optional auth
  }

  next()
}

const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required.'
      })
    }

    const userRoles = Array.isArray(roles) ? roles : [roles]

    if (!userRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions.'
      })
    }

    next()
  }
}

const requireWalletOwnership = (req, res, next) => {
  const walletAddress = req.params.walletAddress || req.body.walletAddress

  if (!walletAddress) {
    return res.status(400).json({
      success: false,
      error: 'Wallet address required.'
    })
  }

  if (req.user.walletAddress.toLowerCase() !== walletAddress.toLowerCase()) {
    return res.status(403).json({
      success: false,
      error: 'Can only access own wallet data.'
    })
  }

  next()
}

module.exports = {
  authMiddleware,
  optionalAuth,
  requireRole,
  requireWalletOwnership
}