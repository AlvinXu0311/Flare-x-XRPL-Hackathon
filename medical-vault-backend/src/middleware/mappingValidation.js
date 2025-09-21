const { body, param, query } = require('express-validator');

const validateStoreMapping = [
  body('txHash')
    .isString()
    .matches(/^0x[a-fA-F0-9]{64}$/)
    .withMessage('Invalid transaction hash format'),

  body('walletAddress')
    .isString()
    .matches(/^0x[a-fA-F0-9]{40}$/)
    .withMessage('Invalid wallet address format'),

  body('contentHash')
    .isString()
    .matches(/^0x[a-fA-F0-9]{64}$/)
    .withMessage('Invalid content hash format'),

  body('fileName')
    .isString()
    .isLength({ min: 1, max: 255 })
    .withMessage('File name must be between 1 and 255 characters'),

  body('fileSize')
    .isInt({ min: 0, max: 1000000000 }) // Max 1GB
    .withMessage('File size must be a positive integer (max 1GB)'),

  body('contentType')
    .isString()
    .isLength({ min: 1, max: 100 })
    .withMessage('Content type is required'),

  body('patientId')
    .isString()
    .matches(/^0x[a-fA-F0-9]{64}$/)
    .withMessage('Invalid patient ID format'),

  body('docType')
    .isInt({ min: 0, max: 2 })
    .withMessage('Document type must be 0, 1, or 2'),

  body('blockNumber')
    .isInt({ min: 0 })
    .withMessage('Block number must be a positive integer'),

  body('gasUsed')
    .isString()
    .isLength({ min: 1 })
    .withMessage('Gas used is required'),

  body('version')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Version must be a positive integer'),

  body('localFileId')
    .isString()
    .isLength({ min: 1 })
    .withMessage('Local file ID is required'),

  body('contentURI')
    .isString()
    .isLength({ min: 1 })
    .withMessage('Content URI is required'),

  body('deviceInfo')
    .optional()
    .isObject()
    .withMessage('Device info must be an object'),

  body('deviceInfo.userAgent')
    .optional()
    .isString()
    .isLength({ max: 500 })
    .withMessage('User agent too long'),

  body('deviceInfo.deviceId')
    .optional()
    .isString()
    .isLength({ max: 100 })
    .withMessage('Device ID too long')
];

const validateWalletAddress = [
  param('address')
    .matches(/^0x[a-fA-F0-9]{40}$/)
    .withMessage('Invalid wallet address format')
];

const validateTxHash = [
  param('hash')
    .matches(/^0x[a-fA-F0-9]{64}$/)
    .withMessage('Invalid transaction hash format')
];

const validatePatientId = [
  param('patientId')
    .matches(/^0x[a-fA-F0-9]{64}$/)
    .withMessage('Invalid patient ID format')
];

const validatePagination = [
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),

  query('offset')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Offset must be a non-negative integer')
];

const validateLocalStatusUpdate = [
  body('isAvailableLocally')
    .isBoolean()
    .withMessage('isAvailableLocally must be a boolean value')
];

module.exports = {
  validateStoreMapping,
  validateWalletAddress,
  validateTxHash,
  validatePatientId,
  validatePagination,
  validateLocalStatusUpdate
};