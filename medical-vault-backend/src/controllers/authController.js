const jwt = require('jsonwebtoken')
const { User } = require('../models')
const { ethers } = require('ethers')
const logger = require('../utils/logger')

class AuthController {
  /**
   * Register a new user
   */
  async register(req, res) {
    try {
      const {
        walletAddress,
        email,
        username,
        firstName,
        lastName,
        role = 'patient',
        phone,
        bio,
        licenseNumber,
        specialty,
        organization
      } = req.body

      // Check if user already exists
      const existingUser = await User.findOne({
        where: {
          $or: [
            { walletAddress: walletAddress.toLowerCase() },
            { email },
            { username }
          ]
        }
      })

      if (existingUser) {
        return res.status(409).json({
          success: false,
          error: 'User already exists with this wallet address, email, or username'
        })
      }

      // Create new user
      const user = await User.create({
        walletAddress: walletAddress.toLowerCase(),
        email,
        username,
        firstName,
        lastName,
        role,
        phone,
        bio,
        licenseNumber,
        specialty,
        organization
      })

      // Generate JWT token
      const token = jwt.sign(
        { userId: user.id },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
      )

      logger.info('User registered successfully', {
        userId: user.id,
        walletAddress: user.walletAddress,
        role: user.role
      })

      res.status(201).json({
        success: true,
        data: {
          user: user.toSafeJSON(),
          token
        }
      })

    } catch (error) {
      logger.logError(error, req)
      res.status(500).json({
        success: false,
        error: 'Registration failed'
      })
    }
  }

  /**
   * Login with wallet signature
   */
  async loginWithWallet(req, res) {
    try {
      const { walletAddress, signature, message } = req.body

      if (!walletAddress || !signature || !message) {
        return res.status(400).json({
          success: false,
          error: 'Wallet address, signature, and message required'
        })
      }

      // Verify signature
      const recoveredAddress = ethers.utils.verifyMessage(message, signature)

      if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
        return res.status(401).json({
          success: false,
          error: 'Invalid signature'
        })
      }

      // Find user
      const user = await User.findOne({
        where: { walletAddress: walletAddress.toLowerCase() }
      })

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found. Please register first.'
        })
      }

      if (!user.isActive) {
        return res.status(403).json({
          success: false,
          error: 'Account is deactivated'
        })
      }

      // Update login stats
      await user.updateLoginStats()

      // Generate JWT token
      const token = jwt.sign(
        { userId: user.id },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
      )

      logger.info('User logged in successfully', {
        userId: user.id,
        walletAddress: user.walletAddress
      })

      res.json({
        success: true,
        data: {
          user: user.toSafeJSON(),
          token
        }
      })

    } catch (error) {
      logger.logError(error, req)
      res.status(500).json({
        success: false,
        error: 'Login failed'
      })
    }
  }

  /**
   * Login with email/password (optional)
   */
  async loginWithPassword(req, res) {
    try {
      const { email, password } = req.body

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          error: 'Email and password required'
        })
      }

      // Find user
      const user = await User.findOne({ where: { email } })

      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Invalid credentials'
        })
      }

      // Validate password
      const isValidPassword = await user.validatePassword(password)

      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          error: 'Invalid credentials'
        })
      }

      if (!user.isActive) {
        return res.status(403).json({
          success: false,
          error: 'Account is deactivated'
        })
      }

      // Update login stats
      await user.updateLoginStats()

      // Generate JWT token
      const token = jwt.sign(
        { userId: user.id },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
      )

      logger.info('User logged in with password', {
        userId: user.id,
        email: user.email
      })

      res.json({
        success: true,
        data: {
          user: user.toSafeJSON(),
          token
        }
      })

    } catch (error) {
      logger.logError(error, req)
      res.status(500).json({
        success: false,
        error: 'Login failed'
      })
    }
  }

  /**
   * Get current user profile
   */
  async getProfile(req, res) {
    try {
      res.json({
        success: true,
        data: {
          user: req.user.toSafeJSON()
        }
      })
    } catch (error) {
      logger.logError(error, req)
      res.status(500).json({
        success: false,
        error: 'Failed to fetch profile'
      })
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(req, res) {
    try {
      const {
        firstName,
        lastName,
        email,
        phone,
        bio,
        specialty,
        organization,
        timezone,
        preferences
      } = req.body

      // Update user
      await req.user.update({
        firstName: firstName || req.user.firstName,
        lastName: lastName || req.user.lastName,
        email: email || req.user.email,
        phone: phone || req.user.phone,
        bio: bio || req.user.bio,
        specialty: specialty || req.user.specialty,
        organization: organization || req.user.organization,
        timezone: timezone || req.user.timezone,
        preferences: preferences || req.user.preferences
      })

      logger.info('User profile updated', {
        userId: req.user.id
      })

      res.json({
        success: true,
        data: {
          user: req.user.toSafeJSON()
        }
      })

    } catch (error) {
      logger.logError(error, req)
      res.status(500).json({
        success: false,
        error: 'Failed to update profile'
      })
    }
  }

  /**
   * Logout (client-side token invalidation)
   */
  async logout(req, res) {
    try {
      logger.info('User logged out', {
        userId: req.user.id
      })

      res.json({
        success: true,
        message: 'Logged out successfully'
      })
    } catch (error) {
      logger.logError(error, req)
      res.status(500).json({
        success: false,
        error: 'Logout failed'
      })
    }
  }

  /**
   * Generate nonce for wallet signature
   */
  async generateNonce(req, res) {
    try {
      const { walletAddress } = req.params

      if (!ethers.utils.isAddress(walletAddress)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid wallet address'
        })
      }

      const nonce = Math.random().toString(36).substring(2, 15)
      const timestamp = Date.now()
      const message = `Please sign this message to authenticate with Medical Vault.\n\nWallet: ${walletAddress}\nNonce: ${nonce}\nTimestamp: ${timestamp}`

      res.json({
        success: true,
        data: {
          message,
          nonce,
          timestamp
        }
      })

    } catch (error) {
      logger.logError(error, req)
      res.status(500).json({
        success: false,
        error: 'Failed to generate nonce'
      })
    }
  }
}

module.exports = new AuthController()