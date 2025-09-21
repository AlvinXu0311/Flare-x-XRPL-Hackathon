const express = require('express')
const documentController = require('../controllers/documentController')
const { authMiddleware } = require('../middleware/auth')
const { documentValidationRules } = require('../middleware/validation')

const router = express.Router()

/**
 * @route POST /api/v1/documents/upload
 * @desc Upload a medical document
 * @access Private
 */
router.post('/upload',
  authMiddleware,
  documentController.uploadMiddleware,
  documentValidationRules.upload,
  documentController.uploadDocument
)

/**
 * @route GET /api/v1/documents/:documentId
 * @desc Get document metadata
 * @access Private
 */
router.get('/:documentId',
  authMiddleware,
  documentController.getDocument
)

/**
 * @route GET /api/v1/documents/:documentId/download
 * @desc Download document file
 * @access Private
 */
router.get('/:documentId/download',
  authMiddleware,
  documentController.downloadDocument
)

/**
 * @route GET /api/v1/documents/patient/:patientId
 * @desc List documents for a patient
 * @access Private
 */
router.get('/patient/:patientId',
  authMiddleware,
  documentController.listDocuments
)

/**
 * @route GET /api/v1/documents/blockchain/:patientId/:documentType
 * @desc Get document from blockchain
 * @access Private
 */
router.get('/blockchain/:patientId/:documentType',
  authMiddleware,
  documentValidationRules.getDocument,
  documentController.getBlockchainDocument
)

module.exports = router