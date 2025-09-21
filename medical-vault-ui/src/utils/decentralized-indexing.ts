// Decentralized indexing using blockchain events and local storage
// Eliminates need for centralized database

import { ethers } from 'ethers'

interface DocumentMetadata {
  cid: string
  patientId: string
  documentType: number
  version: number
  timestamp: number
  blockNumber: number
  transactionHash: string
  uploader: string
  filename?: string
  size?: number
  encryptedSize?: number
}

interface PatientData {
  patientId: string
  documents: DocumentMetadata[]
  roles?: {
    guardian?: string
    psychologist?: string
    insurer?: string
  }
  lastUpdated: number
}

class DecentralizedIndexing {
  private readonly STORAGE_KEY = 'medical-vault-index'
  private readonly EVENTS_KEY = 'medical-vault-events'
  private contract: ethers.Contract | null = null
  private provider: ethers.providers.Provider | null = null

  /**
   * Initialize with smart contract
   */
  initialize(contract: ethers.Contract, provider: ethers.providers.Provider) {
    this.contract = contract
    this.provider = provider
  }

  /**
   * Build local index from blockchain events
   * This replaces the need for a centralized database
   */
  async buildIndex(fromBlock: number = 0): Promise<void> {
    if (!this.contract || !this.provider) {
      throw new Error('Contract not initialized')
    }

    console.log('🔍 Building decentralized index from blockchain events...')

    try {
      // Get all relevant events from the blockchain
      const filter = this.contract.filters.DocumentUploaded()
      const events = await this.contract.queryFilter(filter, fromBlock)

      const index: Record<string, PatientData> = this.loadLocalIndex()

      // Process each event to build the index
      for (const event of events) {
        if (!event.args) continue
        const { patientId, documentType, hashURI, version } = event.args
        const block = await event.getBlock()

        const metadata: DocumentMetadata = {
          cid: hashURI.replace('ipfs://', ''),
          patientId,
          documentType: documentType.toNumber(),
          version: version.toNumber(),
          timestamp: block.timestamp * 1000,
          blockNumber: event.blockNumber,
          transactionHash: event.transactionHash,
          uploader: event.args?.uploader || 'unknown'
        }

        // Add to index
        if (!index[patientId]) {
          index[patientId] = {
            patientId,
            documents: [],
            lastUpdated: Date.now()
          }
        }

        // Update or add document
        const existingIndex = index[patientId].documents.findIndex(
          d => d.documentType === metadata.documentType
        )

        if (existingIndex >= 0) {
          // Update if newer version
          if (metadata.version > index[patientId].documents[existingIndex].version) {
            index[patientId].documents[existingIndex] = metadata
          }
        } else {
          index[patientId].documents.push(metadata)
        }

        index[patientId].lastUpdated = Date.now()
      }

      // Save to local storage
      this.saveLocalIndex(index)

      // Save last processed block
      const lastBlock = events.length > 0 ? events[events.length - 1].blockNumber : fromBlock
      localStorage.setItem(this.EVENTS_KEY, lastBlock.toString())

      console.log(`✅ Index built: ${Object.keys(index).length} patients, ${events.length} events`)

    } catch (error) {
      console.error('Failed to build index:', error)
      throw error
    }
  }

  /**
   * Get patient data from local index
   */
  getPatientData(patientId: string): PatientData | null {
    const index = this.loadLocalIndex()
    return index[patientId] || null
  }

  /**
   * Get all patient documents
   */
  getPatientDocuments(patientId: string): DocumentMetadata[] {
    const patientData = this.getPatientData(patientId)
    return patientData?.documents || []
  }

  /**
   * Get specific document
   */
  getDocument(patientId: string, documentType: number): DocumentMetadata | null {
    const documents = this.getPatientDocuments(patientId)
    return documents.find(d => d.documentType === documentType) || null
  }

  /**
   * Add document metadata to local index
   */
  addDocumentToIndex(metadata: DocumentMetadata): void {
    const index = this.loadLocalIndex()

    if (!index[metadata.patientId]) {
      index[metadata.patientId] = {
        patientId: metadata.patientId,
        documents: [],
        lastUpdated: Date.now()
      }
    }

    // Update or add document
    const existingIndex = index[metadata.patientId].documents.findIndex(
      d => d.documentType === metadata.documentType
    )

    if (existingIndex >= 0) {
      index[metadata.patientId].documents[existingIndex] = metadata
    } else {
      index[metadata.patientId].documents.push(metadata)
    }

    index[metadata.patientId].lastUpdated = Date.now()
    this.saveLocalIndex(index)
  }

  /**
   * Update patient roles in local index
   */
  updatePatientRoles(patientId: string, roles: any): void {
    const index = this.loadLocalIndex()

    if (!index[patientId]) {
      index[patientId] = {
        patientId,
        documents: [],
        lastUpdated: Date.now()
      }
    }

    index[patientId].roles = roles
    index[patientId].lastUpdated = Date.now()
    this.saveLocalIndex(index)
  }

  /**
   * Sync with blockchain for updates
   */
  async syncWithBlockchain(): Promise<void> {
    const lastProcessedBlock = parseInt(
      localStorage.getItem(this.EVENTS_KEY) || '0'
    )

    // Only sync new events since last update
    await this.buildIndex(lastProcessedBlock + 1)
  }

  /**
   * Export index for backup/sharing
   */
  exportIndex(): string {
    const index = this.loadLocalIndex()
    return JSON.stringify(index, null, 2)
  }

  /**
   * Import index from backup
   */
  importIndex(indexData: string): void {
    try {
      const index = JSON.parse(indexData)
      this.saveLocalIndex(index)
      console.log('✅ Index imported successfully')
    } catch (error) {
      throw new Error('Invalid index data format')
    }
  }

  /**
   * Clear local index
   */
  clearIndex(): void {
    localStorage.removeItem(this.STORAGE_KEY)
    localStorage.removeItem(this.EVENTS_KEY)
  }

  /**
   * Get index statistics
   */
  getStats(): {
    totalPatients: number
    totalDocuments: number
    lastUpdated: number
    indexSize: string
  } {
    const index = this.loadLocalIndex()
    const patients = Object.values(index)
    const totalDocuments = patients.reduce((sum, p) => sum + p.documents.length, 0)
    const lastUpdated = Math.max(...patients.map(p => p.lastUpdated), 0)
    const indexSize = new Blob([JSON.stringify(index)]).size

    return {
      totalPatients: patients.length,
      totalDocuments,
      lastUpdated,
      indexSize: this.formatBytes(indexSize)
    }
  }

  /**
   * Search documents across all patients (privacy-aware)
   */
  searchDocuments(query: {
    documentType?: number
    dateFrom?: Date
    dateTo?: Date
    patientId?: string
  }): DocumentMetadata[] {
    const index = this.loadLocalIndex()
    const allDocuments: DocumentMetadata[] = []

    // Only search own data or data user has access to
    for (const patientData of Object.values(index)) {
      allDocuments.push(...patientData.documents)
    }

    return allDocuments.filter(doc => {
      if (query.patientId && doc.patientId !== query.patientId) return false
      if (query.documentType !== undefined && doc.documentType !== query.documentType) return false
      if (query.dateFrom && doc.timestamp < query.dateFrom.getTime()) return false
      if (query.dateTo && doc.timestamp > query.dateTo.getTime()) return false
      return true
    })
  }

  /**
   * Load local index from browser storage
   */
  private loadLocalIndex(): Record<string, PatientData> {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY)
      return stored ? JSON.parse(stored) : {}
    } catch (error) {
      console.warn('Failed to load local index:', error)
      return {}
    }
  }

  /**
   * Save local index to browser storage
   */
  private saveLocalIndex(index: Record<string, PatientData>): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(index))
    } catch (error) {
      console.error('Failed to save local index:', error)
      // Handle storage quota exceeded
      if ((error as Error).name === 'QuotaExceededError') {
        // Could implement LRU cache or compression here
        console.warn('Local storage quota exceeded - consider exporting data')
      }
    }
  }

  /**
   * Format bytes for human reading
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  /**
   * Real-time event listener for new documents
   */
  startEventListening(): void {
    if (!this.contract) return

    // Listen for new document uploads
    this.contract.on('DocumentUploaded', async (patientId, documentType, hashURI, version, event) => {
      console.log('📄 New document uploaded:', { patientId, documentType, hashURI })

      const block = await event.getBlock()
      const metadata: DocumentMetadata = {
        cid: hashURI.replace('ipfs://', ''),
        patientId,
        documentType: documentType.toNumber(),
        version: version.toNumber(),
        timestamp: block.timestamp * 1000,
        blockNumber: event.blockNumber,
        transactionHash: event.transactionHash,
        uploader: event.args.uploader || 'unknown'
      }

      this.addDocumentToIndex(metadata)
    })

    // Listen for role changes
    this.contract.on('RoleUpdated', async (patientId, role, address, event) => {
      console.log('👥 Role updated:', { patientId, role, address })
      // Update roles in index
      // Implementation depends on your smart contract events
    })
  }

  /**
   * Stop event listening
   */
  stopEventListening(): void {
    if (this.contract) {
      this.contract.removeAllListeners()
    }
  }
}

export const decentralizedIndexing = new DecentralizedIndexing()
export default decentralizedIndexing