const { body, param, query, validationResult } = require('express-validator')
const { ethers } = require('ethers')

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req)

  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array()
    })
  }

  next()
}

const validateEthereumAddress = (field) => {
  return body(field)
    .custom((value) => {
      if (!ethers.utils.isAddress(value)) {
        throw new Error('Invalid Ethereum address')
      }
      return true
    })
}

const validateBytes32 = (field) => {
  return body(field)
    .custom((value) => {
      if (!ethers.utils.isHexString(value, 32)) {
        throw new Error('Invalid bytes32 format')
      }
      return true
    })
}

const validateIPFSCid = (field) => {
  return body(field)
    .custom((value) => {
      // Basic IPFS CID validation (can be improved)
      if (!/^(Qm[1-9A-HJ-NP-Za-km-z]{44}|baf[a-z0-9]{56})$/.test(value)) {
        throw new Error('Invalid IPFS CID format')
      }
      return true
    })
}

const validateDocumentType = (field) => {
  return body(field)
    .isInt({ min: 0, max: 2 })
    .withMessage('Document type must be 0 (Diagnosis), 1 (Referral), or 2 (Intake)')
}

// User validation rules
const userValidationRules = {
  register: [
    body('walletAddress')
      .custom((value) => {
        if (!ethers.utils.isAddress(value)) {
          throw new Error('Invalid wallet address')
        }
        return true
      }),
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email required'),
    body('username')
      .isLength({ min: 3, max: 50 })
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage('Username must be 3-50 characters, alphanumeric and underscore only'),
    body('firstName')
      .isLength({ min: 1, max: 100 })
      .trim()
      .withMessage('First name required (1-100 characters)'),
    body('lastName')
      .isLength({ min: 1, max: 100 })
      .trim()
      .withMessage('Last name required (1-100 characters)'),
    body('role')
      .optional()
      .isIn(['admin', 'guardian', 'psychologist', 'insurer', 'patient'])
      .withMessage('Invalid role'),
    body('phone')
      .optional()
      .isMobilePhone()
      .withMessage('Invalid phone number'),
    handleValidationErrors
  ],

  updateProfile: [
    body('firstName')
      .optional()
      .isLength({ min: 1, max: 100 })
      .trim(),
    body('lastName')
      .optional()
      .isLength({ min: 1, max: 100 })
      .trim(),
    body('email')
      .optional()
      .isEmail()
      .normalizeEmail(),
    body('phone')
      .optional()
      .isMobilePhone(),
    body('bio')
      .optional()
      .isLength({ max: 1000 }),
    handleValidationErrors
  ]
}

// Patient validation rules
const patientValidationRules = {
  create: [
    validateBytes32('patientId'),
    body('firstName')
      .isLength({ min: 1, max: 100 })
      .trim()
      .withMessage('First name required'),
    body('lastName')
      .isLength({ min: 1, max: 100 })
      .trim()
      .withMessage('Last name required'),
    body('dateOfBirth')
      .isISO8601()
      .toDate()
      .withMessage('Valid date of birth required'),
    body('gender')
      .isIn(['male', 'female', 'other'])
      .withMessage('Gender must be male, female, or other'),
    body('email')
      .optional()
      .isEmail()
      .normalizeEmail(),
    body('phone')
      .optional()
      .isMobilePhone(),
    handleValidationErrors
  ],

  setRole: [
    validateBytes32('patientId'),
    validateEthereumAddress('address'),
    body('role')
      .isIn(['guardian', 'psychologist', 'insurer'])
      .withMessage('Role must be guardian, psychologist, or insurer'),
    handleValidationErrors
  ]
}

// Document validation rules
const documentValidationRules = {
  upload: [
    validateBytes32('patientId'),
    validateDocumentType('documentType'),
    body('title')
      .isLength({ min: 1, max: 255 })
      .trim()
      .withMessage('Document title required (1-255 characters)'),
    body('description')
      .optional()
      .isLength({ max: 1000 })
      .trim(),
    handleValidationErrors
  ],

  getDocument: [
    validateBytes32('patientId'),
    validateDocumentType('documentType'),
    handleValidationErrors
  ]
}

// Access validation rules
const accessValidationRules = {
  grantAccess: [
    validateBytes32('patientId'),
    validateEthereumAddress('readerAddress'),
    body('allowed')
      .isBoolean()
      .withMessage('Allowed must be boolean'),
    body('reason')
      .optional()
      .isLength({ max: 500 })
      .trim(),
    handleValidationErrors
  ],

  checkPermission: [
    validateBytes32('patientId'),
    validateEthereumAddress('address'),
    handleValidationErrors
  ]
}

// Blockchain validation rules
const blockchainValidationRules = {
  uploadDocument: [
    validateBytes32('patientId'),
    validateDocumentType('documentType'),
    body('hashURI')
      .matches(/^ipfs:\/\/.+/)
      .withMessage('Invalid IPFS URI format'),
    handleValidationErrors
  ]
}

module.exports = {
  handleValidationErrors,
  validateEthereumAddress,
  validateBytes32,
  validateIPFSCid,
  validateDocumentType,
  userValidationRules,
  patientValidationRules,
  documentValidationRules,
  accessValidationRules,
  blockchainValidationRules
}