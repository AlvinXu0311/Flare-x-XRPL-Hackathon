const express = require('express')
const { Patient, Document, User } = require('../models')
const { authMiddleware, requireRole } = require('../middleware/auth')
const { patientValidationRules } = require('../middleware/validation')
const blockchainService = require('../services/blockchainService')
const logger = require('../utils/logger')

const router = express.Router()

/**
 * @route POST /api/v1/patients
 * @desc Create a new patient
 * @access Private (Admin only)
 */
router.post('/',
  authMiddleware,
  requireRole(['admin']),
  patientValidationRules.create,
  async (req, res) => {
    try {
      const {
        patientId,
        firstName,
        lastName,
        dateOfBirth,
        gender,
        email,
        phone,
        address,
        emergencyContact,
        medicalHistory,
        allergies,
        medications
      } = req.body

      // Check if patient already exists
      const existingPatient = await Patient.findOne({ where: { patientId } })
      if (existingPatient) {
        return res.status(409).json({
          success: false,
          error: 'Patient already exists with this ID'
        })
      }

      // Create patient
      const patient = await Patient.create({
        patientId,
        firstName,
        lastName,
        dateOfBirth,
        gender,
        email,
        phone,
        address,
        emergencyContact,
        medicalHistory,
        allergies,
        medications
      })

      logger.info('Patient created successfully', {
        patientId: patient.patientId,
        createdBy: req.user.id
      })

      res.status(201).json({
        success: true,
        data: { patient: patient.toSafeJSON() }
      })

    } catch (error) {
      logger.logError(error, req)
      res.status(500).json({
        success: false,
        error: 'Failed to create patient'
      })
    }
  }
)

/**
 * @route GET /api/v1/patients/:patientId
 * @desc Get patient by ID
 * @access Private
 */
router.get('/:patientId',
  authMiddleware,
  async (req, res) => {
    try {
      const { patientId } = req.params

      // Check permissions
      const hasPermission = await blockchainService.checkReadPermission(
        patientId,
        req.user.walletAddress
      )

      if (!hasPermission && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        })
      }

      const patient = await Patient.findOne({
        where: { patientId },
        include: [
          {
            model: Document,
            as: 'documents',
            attributes: ['id', 'documentType', 'title', 'status', 'createdAt'],
            limit: 10,
            order: [['createdAt', 'DESC']]
          }
        ]
      })

      if (!patient) {
        return res.status(404).json({
          success: false,
          error: 'Patient not found'
        })
      }

      res.json({
        success: true,
        data: { patient: patient.toSafeJSON() }
      })

    } catch (error) {
      logger.logError(error, req)
      res.status(500).json({
        success: false,
        error: 'Failed to fetch patient'
      })
    }
  }
)

/**
 * @route PUT /api/v1/patients/:patientId
 * @desc Update patient information
 * @access Private (Admin or Guardian only)
 */
router.put('/:patientId',
  authMiddleware,
  async (req, res) => {
    try {
      const { patientId } = req.params

      // Find patient
      const patient = await Patient.findOne({ where: { patientId } })
      if (!patient) {
        return res.status(404).json({
          success: false,
          error: 'Patient not found'
        })
      }

      // Check permissions
      const isAdmin = req.user.role === 'admin'
      const isGuardian = patient.guardianAddress?.toLowerCase() === req.user.walletAddress.toLowerCase()

      if (!isAdmin && !isGuardian) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        })
      }

      // Update patient
      const allowedFields = [
        'firstName', 'lastName', 'email', 'phone', 'address',
        'emergencyContact', 'medicalHistory', 'allergies', 'medications'
      ]

      const updateData = {}
      allowedFields.forEach(field => {
        if (req.body[field] !== undefined) {
          updateData[field] = req.body[field]
        }
      })

      await patient.update(updateData)

      logger.info('Patient updated successfully', {
        patientId: patient.patientId,
        updatedBy: req.user.id
      })

      res.json({
        success: true,
        data: { patient: patient.toSafeJSON() }
      })

    } catch (error) {
      logger.logError(error, req)
      res.status(500).json({
        success: false,
        error: 'Failed to update patient'
      })
    }
  }
)

/**
 * @route GET /api/v1/patients
 * @desc List patients (Admin only)
 * @access Private (Admin only)
 */
router.get('/',
  authMiddleware,
  requireRole(['admin']),
  async (req, res) => {
    try {
      const { page = 1, limit = 20, search } = req.query

      const where = {}
      if (search) {
        where[Op.or] = [
          { firstName: { [Op.iLike]: `%${search}%` } },
          { lastName: { [Op.iLike]: `%${search}%` } },
          { email: { [Op.iLike]: `%${search}%` } },
          { patientId: { [Op.iLike]: `%${search}%` } }
        ]
      }

      const offset = (parseInt(page) - 1) * parseInt(limit)

      const { count, rows: patients } = await Patient.findAndCountAll({
        where,
        attributes: { exclude: ['encryptionKey'] },
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit),
        offset
      })

      res.json({
        success: true,
        data: {
          patients,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: count,
            pages: Math.ceil(count / parseInt(limit))
          }
        }
      })

    } catch (error) {
      logger.logError(error, req)
      res.status(500).json({
        success: false,
        error: 'Failed to list patients'
      })
    }
  }
)

/**
 * @route POST /api/v1/patients/:patientId/roles/guardian
 * @desc Set patient guardian
 * @access Private (Admin only)
 */
router.post('/:patientId/roles/guardian',
  authMiddleware,
  requireRole(['admin']),
  patientValidationRules.setRole,
  async (req, res) => {
    try {
      const { patientId } = req.params
      const { address } = req.body

      // Set guardian on blockchain
      const result = await blockchainService.setGuardian(patientId, address)

      // Update local database
      await Patient.update(
        { guardianAddress: address.toLowerCase() },
        { where: { patientId } }
      )

      logger.info('Guardian set successfully', {
        patientId,
        guardianAddress: address,
        txHash: result.transactionHash
      })

      res.json({
        success: true,
        data: {
          message: 'Guardian set successfully',
          transactionHash: result.transactionHash
        }
      })

    } catch (error) {
      logger.logError(error, req)
      res.status(500).json({
        success: false,
        error: 'Failed to set guardian'
      })
    }
  }
)

/**
 * @route POST /api/v1/patients/:patientId/roles/psychologist
 * @desc Set pediatric psychologist
 * @access Private (Admin only)
 */
router.post('/:patientId/roles/psychologist',
  authMiddleware,
  requireRole(['admin']),
  patientValidationRules.setRole,
  async (req, res) => {
    try {
      const { patientId } = req.params
      const { address } = req.body

      // Set psychologist on blockchain
      const result = await blockchainService.setPediatricPsychologist(patientId, address)

      // Update local database
      await Patient.update(
        { psychologistAddress: address.toLowerCase() },
        { where: { patientId } }
      )

      logger.info('Psychologist set successfully', {
        patientId,
        psychologistAddress: address,
        txHash: result.transactionHash
      })

      res.json({
        success: true,
        data: {
          message: 'Psychologist set successfully',
          transactionHash: result.transactionHash
        }
      })

    } catch (error) {
      logger.logError(error, req)
      res.status(500).json({
        success: false,
        error: 'Failed to set psychologist'
      })
    }
  }
)

/**
 * @route POST /api/v1/patients/:patientId/roles/insurer
 * @desc Set insurer
 * @access Private (Admin only)
 */
router.post('/:patientId/roles/insurer',
  authMiddleware,
  requireRole(['admin']),
  patientValidationRules.setRole,
  async (req, res) => {
    try {
      const { patientId } = req.params
      const { address } = req.body

      // Set insurer on blockchain
      const result = await blockchainService.setInsurer(patientId, address)

      // Update local database
      await Patient.update(
        { insurerAddress: address.toLowerCase() },
        { where: { patientId } }
      )

      logger.info('Insurer set successfully', {
        patientId,
        insurerAddress: address,
        txHash: result.transactionHash
      })

      res.json({
        success: true,
        data: {
          message: 'Insurer set successfully',
          transactionHash: result.transactionHash
        }
      })

    } catch (error) {
      logger.logError(error, req)
      res.status(500).json({
        success: false,
        error: 'Failed to set insurer'
      })
    }
  }
)

/**
 * @route GET /api/v1/patients/:patientId/roles
 * @desc Get patient roles from blockchain
 * @access Private
 */
router.get('/:patientId/roles',
  authMiddleware,
  async (req, res) => {
    try {
      const { patientId } = req.params

      // Check permissions
      const hasPermission = await blockchainService.checkReadPermission(
        patientId,
        req.user.walletAddress
      )

      if (!hasPermission && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        })
      }

      const roles = await blockchainService.getPatientRoles(patientId)

      res.json({
        success: true,
        data: { roles }
      })

    } catch (error) {
      logger.logError(error, req)
      res.status(500).json({
        success: false,
        error: 'Failed to fetch patient roles'
      })
    }
  }
)

module.exports = router