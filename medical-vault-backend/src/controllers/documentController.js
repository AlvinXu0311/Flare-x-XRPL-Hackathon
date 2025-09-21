const multer = require('multer')
const path = require('path')
const crypto = require('crypto')
const { Document, Patient, User, AccessLog } = require('../models')
// const ipfsService = require('../services/ipfsService') // DISABLED - Not using IPFS
const blockchainService = require('../services/blockchainService')
const logger = require('../utils/logger')
const fs = require('fs').promises

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = process.env.UPLOAD_TEMP_DIR || './tmp/uploads'
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname))
  }
})

const fileFilter = (req, file, cb) => {
  const allowedTypes = (process.env.ALLOWED_FILE_TYPES || 'pdf,doc,docx,txt,jpg,jpeg,png,dicom').split(',')
  const fileExt = path.extname(file.originalname).slice(1).toLowerCase()

  if (allowedTypes.includes(fileExt)) {
    cb(null, true)
  } else {
    cb(new Error(`File type .${fileExt} not allowed. Allowed types: ${allowedTypes.join(', ')}`), false)
  }
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE?.replace('MB', '') || '50') * 1024 * 1024
  }
})

class DocumentController {
  /**
   * Upload document
   */
  async uploadDocument(req, res) {
    try {
      const { patientId, documentType, title, description, tags } = req.body
      const file = req.file

      if (!file) {
        return res.status(400).json({
          success: false,
          error: 'No file provided'
        })
      }

      // Check if patient exists
      const patient = await Patient.findOne({ where: { patientId } })
      if (!patient) {
        await fs.unlink(file.path) // Clean up uploaded file
        return res.status(404).json({
          success: false,
          error: 'Patient not found'
        })
      }

      // Check permissions (implement your access control logic here)
      // For now, assuming user has permission

      // Read file
      const fileBuffer = await fs.readFile(file.path)

      // Encrypt file (simple example - you may want more sophisticated encryption)
      const encryptionKey = crypto.randomBytes(32)
      const cipher = crypto.createCipher('aes-256-cbc', encryptionKey)
      let encryptedBuffer = Buffer.concat([cipher.update(fileBuffer), cipher.final()])

      // Generate file hash
      const fileHash = crypto.createHash('sha256').update(encryptedBuffer).digest('hex')

      // Store file locally (replacing IPFS)
      logger.info('Storing document locally', {
        patientId,
        documentType,
        filename: file.originalname
      })

      const localFilename = `${patientId}-${documentType}-${Date.now()}-${file.originalname}`
      const storageDir = process.env.STORAGE_DIR || './storage/documents'

      // Ensure storage directory exists
      await fs.mkdir(storageDir, { recursive: true })

      const localFilePath = path.join(storageDir, localFilename)
      await fs.writeFile(localFilePath, encryptedBuffer)

      // Create a local URI instead of IPFS
      const localURI = `local://${localFilename}`

      // Mock IPFS result for compatibility
      const ipfsResult = { cid: fileHash } // Use file hash as CID

      // Create database record
      const document = await Document.create({
        patientId,
        documentType: parseInt(documentType),
        title,
        description,
        originalFilename: file.originalname,
        fileType: path.extname(file.originalname).slice(1),
        fileSize: file.size,
        ipfsCid: ipfsResult.cid,
        ipfsURI: localURI,
        encryptionHash: fileHash,
        uploadedBy: req.user.id,
        status: 'processing',
        tags: tags ? JSON.parse(tags) : null,
        metadata: {
          encryptionKey: encryptionKey.toString('hex'),
          originalFileHash: crypto.createHash('sha256').update(fileBuffer).digest('hex')
        }
      })

      // Upload metadata to blockchain
      logger.info('Uploading document metadata to blockchain', {
        documentId: document.id,
        patientId,
        documentType
      })

      try {
        const blockchainResult = await blockchainService.uploadDocument(
          patientId,
          parseInt(documentType),
          localURI
        )

        // Update document with blockchain info
        await document.update({
          blockchainTxHash: blockchainResult.transactionHash,
          blockNumber: blockchainResult.blockNumber,
          gasUsed: blockchainResult.gasUsed,
          status: 'completed'
        })

        // Log access
        await AccessLog.logAccess({
          patientId,
          documentId: document.id,
          accessedBy: req.user.id,
          accessType: 'upload',
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          blockchainTxHash: blockchainResult.transactionHash,
          success: true
        })

        logger.info('Document uploaded successfully', {
          documentId: document.id,
          txHash: blockchainResult.transactionHash
        })

      } catch (blockchainError) {
        logger.error('Blockchain upload failed', blockchainError)

        await document.update({
          status: 'failed',
          metadata: {
            ...document.metadata,
            blockchainError: blockchainError.message
          }
        })

        // Still log the access attempt
        await AccessLog.logAccess({
          patientId,
          documentId: document.id,
          accessedBy: req.user.id,
          accessType: 'upload',
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          success: false,
          errorMessage: blockchainError.message
        })
      }

      // Clean up temporary file
      await fs.unlink(file.path)

      res.status(201).json({
        success: true,
        data: {
          document: {
            id: document.id,
            patientId: document.patientId,
            documentType: document.documentType,
            title: document.title,
            description: document.description,
            fileType: document.fileType,
            fileSize: document.fileSize,
            ipfsCid: document.ipfsCid,
            version: document.version,
            status: document.status,
            blockchainTxHash: document.blockchainTxHash,
            createdAt: document.createdAt
          }
        }
      })

    } catch (error) {
      // Clean up temporary file if exists
      if (req.file) {
        try {
          await fs.unlink(req.file.path)
        } catch (cleanupError) {
          logger.error('Failed to cleanup temp file', cleanupError)
        }
      }

      logger.logError(error, req)
      res.status(500).json({
        success: false,
        error: 'Document upload failed'
      })
    }
  }

  /**
   * Download document
   */
  async downloadDocument(req, res) {
    try {
      const { documentId } = req.params

      // Find document
      const document = await Document.findByPk(documentId, {
        include: [{ model: Patient, as: 'patient' }]
      })

      if (!document) {
        return res.status(404).json({
          success: false,
          error: 'Document not found'
        })
      }

      // Check permissions (implement your access control logic)
      // For now, basic check
      if (document.uploadedBy !== req.user.id) {
        // Check if user has read permission via blockchain
        const hasPermission = await blockchainService.checkReadPermission(
          document.patientId,
          req.user.walletAddress
        )

        if (!hasPermission) {
          return res.status(403).json({
            success: false,
            error: 'Access denied'
          })
        }
      }

      // Download from local storage
      logger.info('Downloading document from local storage', {
        documentId: document.id,
        ipfsCid: document.ipfsCid
      })

      // Extract filename from URI
      const filename = document.ipfsURI.replace('local://', '')
      const storageDir = process.env.STORAGE_DIR || './storage/documents'
      const localFilePath = path.join(storageDir, filename)

      const encryptedBuffer = await fs.readFile(localFilePath)

      // Decrypt file
      const encryptionKey = Buffer.from(document.metadata.encryptionKey, 'hex')
      const decipher = crypto.createDecipher('aes-256-cbc', encryptionKey)
      const decryptedBuffer = Buffer.concat([decipher.update(encryptedBuffer), decipher.final()])

      // Log access
      await AccessLog.logAccess({
        patientId: document.patientId,
        documentId: document.id,
        accessedBy: req.user.id,
        accessType: 'download',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        success: true
      })

      // Set response headers
      res.setHeader('Content-Type', 'application/octet-stream')
      res.setHeader('Content-Disposition', `attachment; filename="${document.originalFilename}"`)
      res.setHeader('Content-Length', decryptedBuffer.length)

      res.send(decryptedBuffer)

    } catch (error) {
      logger.logError(error, req)
      res.status(500).json({
        success: false,
        error: 'Document download failed'
      })
    }
  }

  /**
   * Get document metadata
   */
  async getDocument(req, res) {
    try {
      const { documentId } = req.params

      const document = await Document.findByPk(documentId, {
        include: [
          { model: Patient, as: 'patient' },
          { model: User, as: 'uploader', attributes: ['id', 'firstName', 'lastName', 'role'] }
        ],
        attributes: { exclude: ['metadata'] } // Exclude sensitive encryption data
      })

      if (!document) {
        return res.status(404).json({
          success: false,
          error: 'Document not found'
        })
      }

      // Check permissions
      if (document.uploadedBy !== req.user.id) {
        const hasPermission = await blockchainService.checkReadPermission(
          document.patientId,
          req.user.walletAddress
        )

        if (!hasPermission) {
          return res.status(403).json({
            success: false,
            error: 'Access denied'
          })
        }
      }

      // Log access
      await AccessLog.logAccess({
        patientId: document.patientId,
        documentId: document.id,
        accessedBy: req.user.id,
        accessType: 'view',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        success: true
      })

      res.json({
        success: true,
        data: { document }
      })

    } catch (error) {
      logger.logError(error, req)
      res.status(500).json({
        success: false,
        error: 'Failed to fetch document'
      })
    }
  }

  /**
   * List documents for a patient
   */
  async listDocuments(req, res) {
    try {
      const { patientId } = req.params
      const { documentType, page = 1, limit = 20 } = req.query

      // Check if patient exists
      const patient = await Patient.findOne({ where: { patientId } })
      if (!patient) {
        return res.status(404).json({
          success: false,
          error: 'Patient not found'
        })
      }

      // Check permissions
      const hasPermission = await blockchainService.checkReadPermission(
        patientId,
        req.user.walletAddress
      )

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        })
      }

      // Build query
      const where = { patientId }
      if (documentType !== undefined) {
        where.documentType = parseInt(documentType)
      }

      const offset = (parseInt(page) - 1) * parseInt(limit)

      const { count, rows: documents } = await Document.findAndCountAll({
        where,
        include: [
          { model: User, as: 'uploader', attributes: ['id', 'firstName', 'lastName', 'role'] }
        ],
        attributes: { exclude: ['metadata'] },
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit),
        offset
      })

      res.json({
        success: true,
        data: {
          documents,
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
        error: 'Failed to list documents'
      })
    }
  }

  /**
   * Get document from blockchain
   */
  async getBlockchainDocument(req, res) {
    try {
      const { patientId, documentType } = req.params

      // Check permissions
      const hasPermission = await blockchainService.checkReadPermission(
        patientId,
        req.user.walletAddress
      )

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        })
      }

      const documentData = await blockchainService.getDocumentMeta(
        patientId,
        parseInt(documentType)
      )

      res.json({
        success: true,
        data: { documentData }
      })

    } catch (error) {
      logger.logError(error, req)
      res.status(500).json({
        success: false,
        error: 'Failed to fetch blockchain document'
      })
    }
  }
}

// Export controller and multer middleware
const controller = new DocumentController()

module.exports = {
  uploadDocument: controller.uploadDocument.bind(controller),
  downloadDocument: controller.downloadDocument.bind(controller),
  getDocument: controller.getDocument.bind(controller),
  listDocuments: controller.listDocuments.bind(controller),
  getBlockchainDocument: controller.getBlockchainDocument.bind(controller),
  uploadMiddleware: upload.single('file')
}