const express = require('express');
const router = express.Router();

const {
  storeMapping,
  getMappingsByWallet,
  getMappingByTxHash,
  getMappingsByPatient,
  updateLocalStatus,
  deleteMapping,
  getMappingStats
} = require('../controllers/documentMappingController');

const {
  validateStoreMapping,
  validateWalletAddress,
  validateTxHash,
  validatePatientId,
  validatePagination,
  validateLocalStatusUpdate
} = require('../middleware/mappingValidation');

// Rate limiting middleware (if needed)
// const rateLimit = require('express-rate-limit');

/**
 * @route   POST /api/mappings
 * @desc    Store a new document mapping
 * @access  Public (could add auth later)
 */
router.post('/', validateStoreMapping, storeMapping);

/**
 * @route   GET /api/mappings/wallet/:address
 * @desc    Get all mappings for a wallet address
 * @access  Public
 */
router.get('/wallet/:address',
  validateWalletAddress,
  validatePagination,
  getMappingsByWallet
);

/**
 * @route   GET /api/mappings/tx/:hash
 * @desc    Get mapping by transaction hash
 * @access  Public
 */
router.get('/tx/:hash', validateTxHash, getMappingByTxHash);

/**
 * @route   GET /api/mappings/patient/:patientId
 * @desc    Get all mappings for a patient ID
 * @access  Public
 */
router.get('/patient/:patientId', validatePatientId, getMappingsByPatient);

/**
 * @route   GET /api/mappings/stats/:walletAddress
 * @desc    Get mapping statistics for a wallet
 * @access  Public
 */
router.get('/stats/:walletAddress', validateWalletAddress, getMappingStats);

/**
 * @route   PATCH /api/mappings/:txHash/local-status
 * @desc    Update local availability status
 * @access  Public
 */
router.patch('/:txHash/local-status',
  validateTxHash,
  validateLocalStatusUpdate,
  updateLocalStatus
);

/**
 * @route   DELETE /api/mappings/:txHash
 * @desc    Delete a mapping
 * @access  Public
 */
router.delete('/:txHash', validateTxHash, deleteMapping);

module.exports = router;