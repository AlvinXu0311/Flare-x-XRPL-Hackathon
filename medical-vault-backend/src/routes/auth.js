const express = require('express')
const authController = require('../controllers/authController')
const { authMiddleware } = require('../middleware/auth')
const { userValidationRules } = require('../middleware/validation')

const router = express.Router()

/**
 * @route POST /api/v1/auth/register
 * @desc Register a new user
 * @access Public
 */
router.post('/register', userValidationRules.register, authController.register)

/**
 * @route POST /api/v1/auth/login/wallet
 * @desc Login with wallet signature
 * @access Public
 */
router.post('/login/wallet', authController.loginWithWallet)

/**
 * @route POST /api/v1/auth/login/password
 * @desc Login with email and password
 * @access Public
 */
router.post('/login/password', authController.loginWithPassword)

/**
 * @route GET /api/v1/auth/nonce/:walletAddress
 * @desc Generate nonce for wallet signature
 * @access Public
 */
router.get('/nonce/:walletAddress', authController.generateNonce)

/**
 * @route GET /api/v1/auth/profile
 * @desc Get current user profile
 * @access Private
 */
router.get('/profile', authMiddleware, authController.getProfile)

/**
 * @route PUT /api/v1/auth/profile
 * @desc Update user profile
 * @access Private
 */
router.put('/profile', authMiddleware, userValidationRules.updateProfile, authController.updateProfile)

/**
 * @route POST /api/v1/auth/logout
 * @desc Logout user
 * @access Private
 */
router.post('/logout', authMiddleware, authController.logout)

module.exports = router