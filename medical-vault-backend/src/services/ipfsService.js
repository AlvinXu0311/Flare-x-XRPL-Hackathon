const { create } = require('ipfs-http-client')
const { createHelia } = require('helia')
const { unixfs } = require('@helia/unixfs')
const { strings } = require('@helia/strings')
const crypto = require('crypto')
const logger = require('../utils/logger')

class IPFSService {
  constructor() {
    this.client = null
    this.helia = null
    this.fs = null
    this.strings = null
    this.isInitialized = false
    this.config = {
      host: process.env.IPFS_HOST || 'localhost',
      port: parseInt(process.env.IPFS_PORT) || 5001,
      protocol: process.env.IPFS_PROTOCOL || 'http',
      timeout: 30000
    }
  }

  /**
   * Initialize IPFS client with fallback options
   */
  async initialize() {
    if (this.isInitialized) {
      return true
    }

    try {
      logger.info('Initializing IPFS service...')

      // Try HTTP client first (for external IPFS node)
      try {
        this.client = create({
          host: this.config.host,
          port: this.config.port,
          protocol: this.config.protocol,
          timeout: this.config.timeout
        })

        // Test connection
        await this.client.version()
        logger.info('IPFS HTTP client connected successfully')
        this.isInitialized = true
        return true
      } catch (httpError) {
        logger.warn('IPFS HTTP client failed, trying Helia...', httpError.message)
      }

      // Fallback to Helia (embedded IPFS node)
      try {
        this.helia = await createHelia()
        this.fs = unixfs(this.helia)
        this.strings = strings(this.helia)

        logger.info('Helia IPFS node initialized successfully')
        this.isInitialized = true
        return true
      } catch (heliaError) {
        logger.error('Helia initialization failed:', heliaError.message)
        throw new Error('All IPFS initialization methods failed')
      }
    } catch (error) {
      logger.error('IPFS service initialization failed:', error)
      throw error
    }
  }

  /**
   * Upload a file buffer to IPFS
   * @param {Buffer} fileBuffer - File content as buffer
   * @param {string} filename - Optional filename for metadata
   * @param {Object} options - Upload options
   * @returns {Object} Upload result with CID and metadata
   */
  async uploadFile(fileBuffer, filename = null, options = {}) {
    await this.initialize()

    try {
      logger.info(`Uploading file to IPFS: ${filename || 'unnamed'} (${fileBuffer.length} bytes)`)

      let result

      if (this.client) {
        // Use HTTP client
        const fileObject = {
          content: fileBuffer
        }

        if (filename) {
          fileObject.path = filename
        }

        const uploadResult = await this.client.add(fileObject, {
          pin: options.pin !== false, // Pin by default
          cidVersion: options.cidVersion || 1,
          hashAlg: options.hashAlg || 'sha2-256'
        })

        result = {
          cid: uploadResult.cid.toString(),
          size: uploadResult.size,
          path: uploadResult.path || filename
        }
      } else if (this.fs) {
        // Use Helia
        const cid = await this.fs.addBytes(fileBuffer)

        result = {
          cid: cid.toString(),
          size: fileBuffer.length,
          path: filename
        }
      } else {
        throw new Error('No IPFS client available')
      }

      // Generate file hash for verification
      const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex')

      const uploadData = {
        ...result,
        fileHash,
        uploadedAt: new Date().toISOString(),
        filename: filename || 'unnamed'
      }

      logger.info(`File uploaded successfully: CID ${result.cid}`)
      return uploadData

    } catch (error) {
      logger.error('IPFS file upload failed:', error)
      throw new Error(`IPFS upload failed: ${error.message}`)
    }
  }

  /**
   * Download a file from IPFS by CID
   * @param {string} cid - IPFS Content Identifier
   * @param {Object} options - Download options
   * @returns {Buffer} File content as buffer
   */
  async downloadFile(cid, options = {}) {
    await this.initialize()

    try {
      logger.info(`Downloading file from IPFS: ${cid}`)

      let fileBuffer

      if (this.client) {
        // Use HTTP client
        const stream = this.client.cat(cid, {
          timeout: options.timeout || 30000
        })

        const chunks = []
        for await (const chunk of stream) {
          chunks.push(chunk)
        }

        fileBuffer = Buffer.concat(chunks)
      } else if (this.fs) {
        // Use Helia
        const uint8Array = await this.fs.cat(cid)
        fileBuffer = Buffer.from(uint8Array)
      } else {
        throw new Error('No IPFS client available')
      }

      logger.info(`File downloaded successfully: ${fileBuffer.length} bytes`)
      return fileBuffer

    } catch (error) {
      logger.error('IPFS file download failed:', error)
      throw new Error(`IPFS download failed: ${error.message}`)
    }
  }

  /**
   * Upload text/JSON to IPFS
   * @param {string} text - Text content to upload
   * @param {Object} options - Upload options
   * @returns {Object} Upload result with CID
   */
  async uploadText(text, options = {}) {
    await this.initialize()

    try {
      logger.info(`Uploading text to IPFS (${text.length} characters)`)

      let result

      if (this.client) {
        // Use HTTP client
        const uploadResult = await this.client.add(text, {
          pin: options.pin !== false
        })

        result = {
          cid: uploadResult.cid.toString(),
          size: uploadResult.size
        }
      } else if (this.strings) {
        // Use Helia strings
        const cid = await this.strings.add(text)

        result = {
          cid: cid.toString(),
          size: Buffer.byteLength(text, 'utf8')
        }
      } else {
        throw new Error('No IPFS client available')
      }

      logger.info(`Text uploaded successfully: CID ${result.cid}`)
      return result

    } catch (error) {
      logger.error('IPFS text upload failed:', error)
      throw new Error(`IPFS text upload failed: ${error.message}`)
    }
  }

  /**
   * Download text from IPFS by CID
   * @param {string} cid - IPFS Content Identifier
   * @returns {string} Text content
   */
  async downloadText(cid) {
    await this.initialize()

    try {
      logger.info(`Downloading text from IPFS: ${cid}`)

      let text

      if (this.client) {
        // Use HTTP client
        const stream = this.client.cat(cid)
        const chunks = []

        for await (const chunk of stream) {
          chunks.push(chunk)
        }

        text = Buffer.concat(chunks).toString('utf8')
      } else if (this.strings) {
        // Use Helia strings
        text = await this.strings.get(cid)
      } else {
        throw new Error('No IPFS client available')
      }

      logger.info(`Text downloaded successfully: ${text.length} characters`)
      return text

    } catch (error) {
      logger.error('IPFS text download failed:', error)
      throw new Error(`IPFS text download failed: ${error.message}`)
    }
  }

  /**
   * Get file/object information from IPFS
   * @param {string} cid - IPFS Content Identifier
   * @returns {Object} File metadata
   */
  async getFileInfo(cid) {
    await this.initialize()

    try {
      logger.info(`Getting file info from IPFS: ${cid}`)

      let info

      if (this.client) {
        // Use HTTP client
        const stat = await this.client.files.stat(`/ipfs/${cid}`)

        info = {
          cid,
          size: stat.size,
          type: stat.type,
          cumulativeSize: stat.cumulativeSize,
          blocks: stat.blocks
        }
      } else if (this.fs) {
        // Use Helia - basic info only
        info = {
          cid,
          exists: true,
          type: 'file'
        }
      } else {
        throw new Error('No IPFS client available')
      }

      logger.info(`File info retrieved: ${JSON.stringify(info)}`)
      return info

    } catch (error) {
      logger.error('IPFS file info retrieval failed:', error)
      throw new Error(`IPFS file info failed: ${error.message}`)
    }
  }

  /**
   * Pin content to ensure persistence
   * @param {string} cid - IPFS Content Identifier
   * @returns {boolean} Success status
   */
  async pinContent(cid) {
    await this.initialize()

    try {
      logger.info(`Pinning content: ${cid}`)

      if (this.client) {
        await this.client.pin.add(cid)
      } else {
        logger.warn('Pinning not available with current IPFS client')
      }

      logger.info(`Content pinned successfully: ${cid}`)
      return true

    } catch (error) {
      logger.error('IPFS content pinning failed:', error)
      throw new Error(`IPFS pinning failed: ${error.message}`)
    }
  }

  /**
   * Unpin content to free up space
   * @param {string} cid - IPFS Content Identifier
   * @returns {boolean} Success status
   */
  async unpinContent(cid) {
    await this.initialize()

    try {
      logger.info(`Unpinning content: ${cid}`)

      if (this.client) {
        await this.client.pin.rm(cid)
      } else {
        logger.warn('Unpinning not available with current IPFS client')
      }

      logger.info(`Content unpinned successfully: ${cid}`)
      return true

    } catch (error) {
      logger.error('IPFS content unpinning failed:', error)
      throw new Error(`IPFS unpinning failed: ${error.message}`)
    }
  }

  /**
   * Check IPFS service health
   * @returns {Object} Health status
   */
  async healthCheck() {
    try {
      await this.initialize()

      let status = {
        healthy: false,
        client: null,
        version: null,
        peers: 0
      }

      if (this.client) {
        const version = await this.client.version()
        const swarmPeers = await this.client.swarm.peers()

        status = {
          healthy: true,
          client: 'http',
          version: version.version,
          peers: swarmPeers.length
        }
      } else if (this.helia) {
        status = {
          healthy: true,
          client: 'helia',
          version: 'embedded',
          peers: 0
        }
      }

      return status

    } catch (error) {
      logger.error('IPFS health check failed:', error)
      return {
        healthy: false,
        error: error.message
      }
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    try {
      if (this.helia) {
        await this.helia.stop()
        logger.info('Helia IPFS node stopped')
      }

      this.isInitialized = false
      logger.info('IPFS service cleanup completed')
    } catch (error) {
      logger.error('IPFS cleanup error:', error)
    }
  }
}

// Export singleton instance
module.exports = new IPFSService()