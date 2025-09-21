<template>
  <div class="document-download">
    <h2>View Medical Documents</h2>

    <!-- Smart Account Section -->
    <div class="smart-account-section">
      <div class="account-toggle">
        <label class="toggle-label">
          <input
            type="checkbox"
            v-model="useSmartAccount"
            @change="onSmartAccountToggle"
          />
          <span class="toggle-text">Use Smart Account with XRP Transaction History</span>
        </label>
      </div>

      <div v-if="useSmartAccount && xrpTransactionHistory.length > 0" class="xrp-history">
        <h4>📜 XRP Transaction History</h4>
        <div class="transaction-list">
          <div
            v-for="tx in xrpTransactionHistory"
            :key="tx.hash"
            class="transaction-item"
          >
            <div class="tx-info">
              <span class="tx-hash">{{ tx.hash.substring(0, 10) }}...</span>
              <span class="tx-amount">{{ tx.amount }} XRP</span>
              <span class="tx-memo" v-if="tx.memo">{{ tx.memo }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Your Uploaded Documents -->
    <div class="uploaded-documents">
      <div class="header-with-refresh">
        <h3>Your Stored Documents</h3>
        <div class="header-actions">
          <button @click="loadUserDocuments" class="load-docs-btn" :disabled="isLoading">
            {{ isLoading ? 'Loading...' : 'Show All My Files' }}
          </button>
          <button @click="forceRefresh" class="refresh-btn" :disabled="isRefreshing" v-if="userDocuments.length > 0">
            {{ isRefreshing ? 'Refreshing...' : 'Force Refresh' }}
          </button>
          <button @click="deleteAllFiles" class="delete-all-btn" v-if="userDocuments.length > 0">
            Delete All My Files
          </button>
        </div>
      </div>
      <p>Search for your documents using the options below:</p>

      <div v-if="userDocuments.length === 0" class="no-documents">
        <p>Use the search options below to find and view your stored documents.</p>
        <p>Enter a transaction hash or use the "Show All My Files" button to load your documents.</p>
      </div>

      <div v-else class="documents-list">
        <div
          v-for="doc in userDocuments"
          :key="doc.txHash"
          class="document-card"
        >
          <div class="doc-info">
            <h4>
              {{ doc.filename || 'Document' }}
              <span v-if="doc.fileExists !== undefined" class="file-status" :data-exists="doc.fileExists">
                {{ doc.fileExists ? 'File Available' : 'File Missing' }}
              </span>
            </h4>
            <p><strong>Type:</strong> {{ getDocTypeName(doc.docType) }}</p>
            <p><strong>Content Type:</strong> {{ doc.contentType || 'text' }}</p>
            <p><strong>Stored:</strong> {{ formatDate(doc.uploadDate) }}</p>

            <!-- Blockchain-specific information -->
            <div v-if="doc.isBlockchainDocument || doc.isTransactionLookup" class="blockchain-info">
              <p><strong>Version:</strong> {{ doc.version }}</p>
              <p><strong>Uploader:</strong> {{ doc.uploader }}</p>
              <p v-if="doc.blockNumber"><strong>Block:</strong> {{ doc.blockNumber }}</p>
              <p v-if="doc.gasUsed"><strong>⛽ Gas Used:</strong> {{ doc.gasUsed }}</p>
              <p v-if="doc.lastUpdated"><strong>🕒 Last Updated:</strong> {{ doc.lastUpdated }}</p>
            </div>

            <p><strong>Content Hash:</strong>
              <span class="hash-display">{{ doc.contentHash }}</span>
            </p>
            <p><strong>Tx Hash:</strong>
              <span class="hash-display">{{ doc.txHash }}</span>
            </p>
          </div>

          <div class="doc-actions">
            <button
              @click="viewDocument(doc)"
              :disabled="isViewing[doc.txHash]"
              class="view-btn"
            >
              {{ isViewing[doc.txHash] ? 'Decrypting...' : (doc.contentType === 'file' ? 'Download File' : 'View Text') }}
            </button>
            <button @click="viewOnBlockchain(doc.txHash)" class="blockchain-btn">
              View on Blockchain
            </button>
            <button
              @click="deleteFile(doc.txHash)"
              :disabled="isDeleting[doc.txHash]"
              class="delete-btn"
            >
              {{ isDeleting[doc.txHash] ? 'Deleting...' : 'Delete' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Manual Document Lookup -->
    <div class="manual-lookup">
      <h3>Find Documents on Blockchain</h3>

      <!-- Patient ID Lookup -->
      <div class="lookup-section">
        <h4>Look up by Patient ID</h4>
        <p>Enter patient information to retrieve documents from smart contract:</p>

        <div class="input-group">
          <label for="lookupMrn">Medical Record Number (MRN):</label>
          <input
            id="lookupMrn"
            v-model="lookupMrn"
            type="text"
            placeholder="Enter MRN"
          />
        </div>

        <div class="input-group">
          <label for="lookupSalt">Salt:</label>
          <input
            id="lookupSalt"
            v-model="lookupSalt"
            type="text"
            placeholder="Enter salt value"
          />
        </div>

        <button
          @click="lookupDocuments"
          :disabled="!lookupMrn || !lookupSalt || isLookingUp"
          class="lookup-btn"
        >
          {{ isLookingUp ? 'Looking up...' : 'Find by Patient ID' }}
        </button>
      </div>

      <!-- Transaction Hash Lookup -->
      <div class="lookup-section">
        <h4>Look up by Transaction Hash</h4>
        <p>Find document using blockchain transaction hash:</p>

        <div class="input-group">
          <label for="lookupTxHash">Transaction Hash:</label>
          <input
            id="lookupTxHash"
            v-model="lookupTxHash"
            type="text"
            placeholder="0x..."
          />
        </div>

        <button
          @click="lookupByTxHash"
          :disabled="!lookupTxHash || isLookingUpTx"
          class="lookup-btn secondary"
        >
          {{ isLookingUpTx ? 'Looking up...' : 'Find by Transaction' }}
        </button>
      </div>

      <!-- <div class="blockchain-decrypt-info">
        <h4>🔐 Blockchain Retrieval</h4>
        <p>This will retrieve document metadata from the blockchain. Files are decrypted locally with your wallet signature.</p>
        <div class="blockchain-benefits">
          <span>Decentralized document registry</span>
          <span>Immutable audit trail</span>
          <span>Version tracking</span>
          <span>Uploader verification</span>
        </div>
      </div> -->
    </div>

    <!-- Viewed Document Content -->
    <div v-if="viewedDocument" class="viewed-document">
      <h3>{{ viewedDocument.filename }}</h3>
      <div class="document-meta">
        <p><strong>Type:</strong> {{ viewedDocument.type }}</p>
        <p><strong>Date:</strong> {{ viewedDocument.date }}</p>
        <p><strong>Hash:</strong> {{ viewedDocument.hash }}</p>
      </div>
      <div class="document-content">
        <pre>{{ viewedDocument.content }}</pre>
      </div>
      <button @click="viewedDocument = null" class="close-btn">Close</button>
    </div>

    <!-- Delete Confirmation Dialog -->
    <div v-if="showDeleteConfirm" class="delete-confirm-overlay">
      <div class="delete-confirm-dialog">
        <h3>Confirm Deletion</h3>
        <p v-if="deleteTargetType === 'single'">
          Are you sure you want to delete this document? This action cannot be undone.
        </p>
        <p v-else>
          Are you sure you want to delete ALL your documents? This will remove all files associated with your wallet address. This action cannot be undone.
        </p>
        <div class="dialog-actions">
          <button @click="cancelDelete" class="cancel-btn">Cancel</button>
          <button @click="confirmDelete" class="confirm-delete-btn">Delete</button>
        </div>
      </div>
    </div>

    <!-- Local Storage Info -->
    <div class="storage-info">
      <h3>💾 Local Storage Information</h3>
      <div v-if="storageInfo" class="storage-details">
        <div class="storage-item">
          <span class="label">Files Stored:</span>
          <span class="value">{{ storageInfo.fileCount }}</span>
        </div>
        <div class="storage-item">
          <span class="label">Storage Used:</span>
          <span class="value">{{ formatFileSize(storageInfo.usage) }}</span>
        </div>
        <div class="storage-item">
          <span class="label">Storage Quota:</span>
          <span class="value">{{ formatFileSize(storageInfo.quota) }}</span>
        </div>
        <div class="storage-item">
          <span class="label">Usage:</span>
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: storagePercentage + '%' }"></div>
          </div>
          <span class="value">{{ storagePercentage.toFixed(1) }}%</span>
        </div>
      </div>
      <button @click="refreshStorageInfo" class="refresh-btn">
        Refresh Storage Info
      </button>
    </div>

    <!-- Status Display -->
    <div v-if="status" class="status">
      <p>{{ status }}</p>
    </div>

    <!-- Error Display -->
    <div v-if="error" class="error">
      <p>{{ error }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { ethers } from 'ethers'
import { decryptTextWithWallet, decryptFileWithWallet, hashPatientId } from '@/utils/encryption'
import { getStoredFileByTxHash, createDownloadBlob, formatFileSize, getLocalStorageInfo, deleteFileByTxHash, deleteFilesByWallet } from '@/utils/local-storage'
import { mappingService } from '@/utils/mapping-service'
import { flareXrpSmartAccountService } from '@/utils/flare-xrp-smart-account'

// Props
interface Props {
  account: string
  contract: any
  isConnected: boolean
}

const props = defineProps<Props>()

// Reactive state
const userDocuments = ref<any[]>([])
const lookupMrn = ref('')
const lookupSalt = ref('')
const lookupTxHash = ref('')
const isViewing = ref<Record<string, boolean>>({})
const isLookingUp = ref(false)
const isLookingUpTx = ref(false)
const viewedDocument = ref<any>(null)
const status = ref('')
const error = ref('')
const storageInfo = ref<any>(null)
const isRefreshing = ref(false)
const isLoading = ref(false)
const isDeleting = ref<Record<string, boolean>>({})
const showDeleteConfirm = ref(false)
const deleteTargetType = ref<'single' | 'all'>('single')

// Smart Account state
const useSmartAccount = ref(false)
const xrpTransactionHistory = ref<any[]>([])
const deleteTargetTxHash = ref('')

// Smart Account functions
const onSmartAccountToggle = async () => {
  if (useSmartAccount.value) {
    try {
      await loadXrpTransactionHistory()
    } catch (error) {
      console.error('Failed to initialize smart account:', error)
      useSmartAccount.value = false
    }
  } else {
    xrpTransactionHistory.value = []
  }
}

const loadXrpTransactionHistory = async () => {
  try {
    const history = await flareXrpSmartAccountService.getTransactionHistory()
    xrpTransactionHistory.value = history.filter((tx: any) => {
      // Filter for transactions with medical-related memos
      try {
        const memo = JSON.parse(tx.memo || '{}')
        return memo.patientId || memo.docType !== undefined
      } catch {
        return false
      }
    })
  } catch (error) {
    console.error('Failed to load XRP transaction history:', error)
  }
}

// Document type names
const getDocTypeName = (type: string | number): string => {
  const types: Record<string, string> = {
    '0': 'Diagnosis',
    '1': 'Referral',
    '2': '📝 Intake'
  }
  return types[type.toString()] || 'Unknown'
}

// Format date
const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString()
}

// Load user's uploaded documents from localStorage and database
const loadUserDocuments = async () => {
  if (isLoading.value) return

  isLoading.value = true
  try {
    // Clear caches before loading to ensure fresh data
    console.log('🧹 Clearing caches before loading documents...')

    // Clear browser caches
    if ('caches' in window) {
      try {
        const cacheNames = await caches.keys()
        await Promise.all(cacheNames.map(name => caches.delete(name)))
        console.log('Browser caches cleared')
      } catch (cacheError) {
        console.warn('Could not clear browser caches:', (cacheError as Error).message)
      }
    }

    // Clear any component/service caches
    if ((window as any).mappingServiceCache) {
      (window as any).mappingServiceCache.clear()
      console.log('Mapping service cache cleared')
    }

    console.log('Loading user documents from local storage and database...')

    // Get documents from localStorage (legacy)
    const localUploads = JSON.parse(localStorage.getItem('medicalVaultUploads') || '[]')
    console.log('Local uploads found:', localUploads.length)

    // Filter documents uploaded by current wallet and verify they exist
    console.log('Verifying localStorage entries...')
    const verifiedLocalDocs = []

    for (const doc of localUploads) {
      if (doc.metadata?.walletAddress?.toLowerCase() === props.account.toLowerCase()) {
        // Check if file actually exists in IndexedDB
        try {
          const storedFile = await getStoredFileByTxHash(doc.txHash)
          if (storedFile && storedFile.encryptedContent) {
            verifiedLocalDocs.push(doc)
            console.log(`LocalStorage file exists: ${doc.filename} (${doc.txHash?.substring(0,10)}...)`)
          } else {
            console.log(`LocalStorage file missing: ${doc.filename} (${doc.txHash?.substring(0,10)}...)`)
          }
        } catch (error) {
          console.log(`LocalStorage file check error: ${doc.filename} - ${(error as Error).message}`)
        }
      }
    }

    const localDocs = verifiedLocalDocs

    // Try to get documents from database as well
    let dbDocs: any[] = []
    try {
      console.log('Fetching documents from database...')
      const mappings = await mappingService.getMappingsByWallet(props.account.toLowerCase())

      // Convert database mappings and verify file existence
      console.log('Verifying file existence for database records...')

      const verifiedDbDocs = []
      for (const mapping of mappings) {
        const doc = {
          fileId: mapping.localFileId,
          filename: mapping.fileName,
          contentType: mapping.contentType.includes('text') ? 'text' : 'file',
          contentHash: mapping.contentHash,
          contentURI: mapping.contentURI,
          patientId: mapping.patientId,
          docType: mapping.docType.toString(),
          uploadDate: mapping.uploadDate,
          encryptionMethod: mapping.encryptionMethod || 'wallet-signature',
          txHash: mapping.txHash,
          version: mapping.version,
          blockNumber: mapping.blockNumber,
          gasUsed: mapping.gasUsed,
          fileExists: false,
          verificationStatus: 'checking'
        }

        // Check if file actually exists in IndexedDB
        try {
          const storedFile = await getStoredFileByTxHash(mapping.txHash)
          if (storedFile && storedFile.encryptedContent) {
            doc.fileExists = true
            doc.verificationStatus = 'exists'
            console.log(`File exists: ${mapping.fileName} (${mapping.txHash.substring(0,10)}...)`)
          } else {
            doc.fileExists = false
            doc.verificationStatus = 'missing'
            console.log(`File missing: ${mapping.fileName} (${mapping.txHash.substring(0,10)}...)`)
          }
        } catch (error) {
          doc.fileExists = false
          doc.verificationStatus = 'error'
          console.log(`File check error: ${mapping.fileName} - ${(error as Error).message}`)
        }

        verifiedDbDocs.push(doc)
      }

      // Only keep documents that have actual files
      dbDocs = verifiedDbDocs.filter(doc => doc.fileExists)

      console.log(`Retrieved ${mappings.length} database records, ${dbDocs.length} have actual files`)
    } catch (dbError) {
      console.warn('Failed to fetch documents from database (using local only):', dbError)
    }

    // Merge and deduplicate documents (database takes priority over localStorage)
    const allDocs = [...dbDocs]

    // Add local docs that aren't already in database
    for (const localDoc of localDocs) {
      const existsInDb = dbDocs.some(dbDoc => dbDoc.txHash === localDoc.txHash)
      if (!existsInDb) {
        allDocs.push(localDoc)
      }
    }

    userDocuments.value = allDocs
    console.log(`Total documents loaded: ${allDocs.length}`)

  } catch (error) {
    console.error('Failed to load user documents:', error)
    userDocuments.value = []
  } finally {
    isLoading.value = false
  }
}

// View document content
const viewDocument = async (doc: any) => {
  if (!props.isConnected || !window.ethereum) {
    error.value = 'Wallet not connected'
    return
  }

  isViewing.value[doc.txHash] = true
  error.value = ''
  status.value = 'Retrieving stored file...'

  try {
    // Get wallet signer with error handling for proxy issues
    let provider: ethers.providers.Web3Provider
    let signer: ethers.providers.JsonRpcSigner

    try {
      provider = new ethers.providers.Web3Provider(window.ethereum, "any")
      signer = provider.getSigner()

      // Test signer to ensure it's working
      await signer.getAddress()
    } catch (providerError) {
      console.error('Provider/signer error:', providerError)
      // Try again with a fresh provider
      await new Promise(resolve => setTimeout(resolve, 100))
      provider = new ethers.providers.Web3Provider(window.ethereum, "any")
      signer = provider.getSigner()
    }

    // Get stored file from IndexedDB
    const storedFile = await getStoredFileByTxHash(doc.txHash)
    if (!storedFile) {
      throw new Error('File not found in local storage. Document may need to be re-uploaded.')
    }

    status.value = 'Decrypting with wallet signature...'

    // Decrypt content based on type
    if (storedFile.contentType.startsWith('text/') || doc.contentType === 'text') {
      // Debug: Log the encrypted content type and format
      console.log('Encrypted content type:', typeof storedFile.encryptedContent)
      console.log('Encrypted content instanceof ArrayBuffer:', storedFile.encryptedContent instanceof ArrayBuffer)
      console.log('Encrypted content length:',
        storedFile.encryptedContent instanceof ArrayBuffer
          ? storedFile.encryptedContent.byteLength
          : (storedFile.encryptedContent as string)?.length || 'undefined')
      console.log('Metadata:', storedFile.metadata)

      // Decrypt text content
      const decryptedText = await decryptTextWithWallet(
        storedFile.encryptedContent,
        signer,
        storedFile.metadata
      )

      viewedDocument.value = {
        content: decryptedText,
        type: getDocTypeName(doc.docType),
        date: formatDate(doc.uploadDate),
        filename: storedFile.filename,
        hash: storedFile.contentHash
      }

      status.value = 'Text decrypted and displayed successfully!'

    } else {
      // Decrypt file content
      const decryptedBuffer = await decryptFileWithWallet(
        storedFile.encryptedContent as string,
        signer,
        storedFile.metadata
      )

      // Create download link
      const blob = createDownloadBlob(decryptedBuffer, storedFile.contentType)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = storedFile.filename || 'medical-document'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      status.value = `File "${storedFile.filename}" downloaded successfully!`
    }

    setTimeout(() => {
      status.value = ''
    }, 3000)

  } catch (err: any) {
    console.error('View failed:', err)
    error.value = `Failed to access document: ${err.message}`
  } finally {
    isViewing.value[doc.txHash] = false
  }
}

// Look up documents from blockchain
const lookupDocuments = async () => {
  if (!props.isConnected || !window.ethereum) {
    error.value = 'Wallet not connected'
    return
  }

  isLookingUp.value = true
  error.value = ''
  status.value = 'Looking up documents on blockchain...'

  try {
    const patientId = hashPatientId(lookupMrn.value, lookupSalt.value)
    console.log('Looking up documents for patient ID:', patientId)
    let hasCallStatic = false
    try {
      hasCallStatic = props.contract && props.contract.callStatic && typeof props.contract.callStatic === 'object'
    } catch (e) {
      hasCallStatic = false
    }
    console.log('Contract interface type:', hasCallStatic ? 'ethers.js' : 'custom fallback')

    // Query blockchain for each document type (0=Diagnosis, 1=Referral, 2=Intake)
    status.value = 'Querying smart contract for all document types...'

    const documents = []

    // Check each document type
    for (let docType = 0; docType < 3; docType++) {
      try {
        // First check if document exists
        const exists = await props.contract.documentExists(patientId, docType)

        if (exists) {
          console.log(`Found document type ${docType} for patient`)

          // Get document metadata from contract (with fallback for different contract interfaces)
          let result
          try {
            let hasCallStatic = false
    try {
      hasCallStatic = props.contract && props.contract.callStatic && typeof props.contract.callStatic === 'object'
    } catch (e) {
      hasCallStatic = false
    }
            if (hasCallStatic) {
              result = await props.contract.callStatic.getDocument(patientId, docType)
            } else {
              // Fallback for custom contract interface without callStatic
              result = await props.contract.getDocument(patientId, docType)
            }
          } catch (contractError) {
            console.error(`Error calling getDocument for type ${docType}:`, contractError)
            throw contractError
          }

          const [hashURI, version, updatedAt, uploader] = result

          console.log(`Document ${docType} details:`, {
            hashURI,
            version: version.toString(),
            updatedAt: updatedAt.toString(),
            uploader
          })

          // Try to get additional info from local database
          let additionalInfo = {}
          try {
            const mapping = await mappingService.getMappingByPatientAndType(patientId, docType)
            if (mapping) {
              additionalInfo = {
                filename: mapping.fileName,
                contentType: mapping.contentType,
                txHash: mapping.txHash,
                blockNumber: mapping.blockNumber
              }
            }
          } catch (dbError) {
            console.warn('Could not get additional info from database:', dbError)
          }

          // Get document type name
          const typeName = await props.contract.docKindName(docType)

          documents.push({
            patientId,
            docType: docType.toString(),
            contentHash: hashURI.split('|')[0] || hashURI, // Extract hash from URI
            contentURI: hashURI,
            filename: (additionalInfo as any).filename || `${typeName} Document`,
            contentType: (additionalInfo as any).contentType || 'unknown',
            version: version.toString(),
            uploadDate: new Date(updatedAt.toNumber() * 1000).toISOString(),
            uploader: uploader,
            txHash: (additionalInfo as any).txHash || `contract-${patientId}-${docType}`,
            blockNumber: (additionalInfo as any).blockNumber,
            typeName,
            // Blockchain-specific data
            isBlockchainDocument: true,
            lastUpdated: new Date(updatedAt.toNumber() * 1000).toLocaleString()
          })
        }
      } catch (docError) {
        console.log(`No document of type ${docType} found or error:`, (docError as Error).message)
      }
    }

    if (documents.length === 0) {
      status.value = 'No documents found for this patient ID on blockchain'
      setTimeout(() => {
        status.value = ''
      }, 3000)
      return
    }

    status.value = `Successfully retrieved ${documents.length} document(s) from blockchain`

    // Add blockchain documents to display (with clear marking)
    const blockchainDocs = documents.map(doc => ({
      ...doc,
      filename: `${doc.filename} (On-Chain)`,
      source: 'blockchain'
    }))

    // Remove any existing blockchain lookups and add new ones
    userDocuments.value = userDocuments.value.filter(doc => !doc.isBlockchainDocument)
    userDocuments.value = [...userDocuments.value, ...blockchainDocs]

    setTimeout(() => {
      status.value = ''
    }, 5000)

  } catch (err: any) {
    console.error('Lookup failed:', err)
    error.value = `Lookup failed: ${err.message}`
    if (err.reason) {
      error.value += ` (Reason: ${err.reason})`
    }
  } finally {
    isLookingUp.value = false
  }
}

// Look up document by transaction hash
const lookupByTxHash = async () => {
  if (!props.isConnected || !window.ethereum) {
    error.value = 'Wallet not connected'
    return
  }

  isLookingUpTx.value = true
  error.value = ''
  status.value = 'Looking up transaction on blockchain...'

  try {
    let hasCallStatic = false
    try {
      hasCallStatic = props.contract && props.contract.callStatic && typeof props.contract.callStatic === 'object'
    } catch (e) {
      hasCallStatic = false
    }
    console.log('Contract interface type:', hasCallStatic ? 'ethers.js' : 'custom fallback')
    const provider = new ethers.providers.Web3Provider(window.ethereum, "any")

    // Get transaction receipt
    const receipt = await provider.getTransactionReceipt(lookupTxHash.value)
    if (!receipt) {
      throw new Error('Transaction not found or not confirmed')
    }

    console.log('Transaction receipt:', receipt)
    status.value = 'Analyzing transaction logs...'

    // Look for DocumentUploaded events in the transaction
    const contractAddress = import.meta.env.VITE_VAULT_ADDRESS
    const uploadEventTopic = ethers.utils.id("DocumentUploaded(bytes32,uint8,string,uint256,address)")

    const relevantLogs = receipt.logs.filter(log =>
      log.address.toLowerCase() === contractAddress.toLowerCase() &&
      log.topics[0] === uploadEventTopic
    )

    if (relevantLogs.length === 0) {
      throw new Error('No document upload events found in this transaction')
    }

    status.value = 'Found document upload event, retrieving details...'

    // Decode the event log
    const iface = new ethers.utils.Interface([
      "event DocumentUploaded(bytes32 indexed patientId, uint8 indexed kind, string hashURI, uint256 version, address uploader)"
    ])

    const documents = []
    for (const log of relevantLogs) {
      const decoded = iface.parseLog(log)
      const { patientId, kind, hashURI, version, uploader } = decoded.args

      console.log('Decoded event:', { patientId, kind, hashURI, version, uploader })

      // Get current document state from contract (with fallback for different contract interfaces)
      let currentState
      try {
        let hasCallStatic = false
    try {
      hasCallStatic = props.contract && props.contract.callStatic && typeof props.contract.callStatic === 'object'
    } catch (e) {
      hasCallStatic = false
    }

        // Try different approaches to call getDocument with better error handling
        try {
          if (hasCallStatic) {
            currentState = await props.contract.callStatic.getDocument(patientId, kind)
          } else {
            // Fallback for custom contract interface without callStatic
            currentState = await props.contract.getDocument(patientId, kind)
          }
        } catch (proxyError) {
          console.warn('Proxy error calling getDocument, using fallback approach:', (proxyError as Error).message)
          // Skip document verification if contract call fails due to proxy issues
          currentState = null
        }
      } catch (contractError) {
        console.error(`Error calling getDocument for transaction lookup:`, contractError)
        throw contractError
      }

      // Extract current state (unused for now but needed for contract interface compatibility)
      const [, , ] = currentState || [hashURI, version, null]

      // Get document type name (with fallback for proxy errors)
      let typeName = `Document Type ${kind}`
      try {
        typeName = await props.contract.docKindName(kind)
      } catch (proxyError) {
        console.warn('Proxy error calling docKindName, using fallback:', (proxyError as Error).message)
        // Use a fallback name based on kind number
        const kindNames = ['Medical Record', 'Lab Report', 'Prescription', 'Imaging', 'Insurance', 'Other']
        typeName = kindNames[kind] || `Document Type ${kind}`
      }

      // Try to get additional info from local database
      let additionalInfo = {}
      try {
        const mapping = await mappingService.getMappingByTxHash(lookupTxHash.value)
        if (mapping) {
          additionalInfo = {
            filename: mapping.fileName,
            contentType: mapping.contentType
          }
        }
      } catch (dbError) {
        console.warn('Could not get additional info from database:', dbError)
      }

      documents.push({
        patientId,
        docType: kind.toString(),
        contentHash: hashURI.split('|')[0] || hashURI,
        contentURI: hashURI,
        filename: (additionalInfo as any).filename || `${typeName} Document (Tx: ${receipt.transactionHash.slice(0, 10)}...)`,
        contentType: (additionalInfo as any).contentType || 'unknown',
        version: version.toString(),
        uploadDate: receipt.blockNumber ? (await provider.getBlock(receipt.blockNumber)).timestamp * 1000 : Date.now(),
        uploader: uploader,
        txHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        typeName,
        // Transaction-specific data
        isTransactionLookup: true,
        transactionDetails: {
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed.toString(),
          from: receipt.from,
          to: receipt.to,
          status: receipt.status
        }
      })
    }

    if (documents.length === 0) {
      status.value = 'No document uploads found in this transaction'
      return
    }

    status.value = `Found ${documents.length} document(s) in transaction`

    // Add transaction documents to display
    const txDocs = documents.map(doc => ({
      ...doc,
      filename: `📤 ${doc.filename} (From Tx)`,
      source: 'transaction'
    }))

    // Remove any existing transaction lookups and add new ones
    userDocuments.value = userDocuments.value.filter(doc => !doc.isTransactionLookup)
    userDocuments.value = [...userDocuments.value, ...txDocs]

    setTimeout(() => {
      status.value = ''
    }, 5000)

  } catch (err: any) {
    console.error('Transaction lookup failed:', err)
    error.value = `Transaction lookup failed: ${err.message}`
  } finally {
    isLookingUpTx.value = false
  }
}

// View transaction on blockchain explorer
const viewOnBlockchain = (txHash: string) => {
  const url = `https://coston2-explorer.flare.network/tx/${txHash}`
  window.open(url, '_blank')
}

// Computed storage percentage
const storagePercentage = computed(() => {
  if (!storageInfo.value || storageInfo.value.quota === 0) return 0
  return (storageInfo.value.usage / storageInfo.value.quota) * 100
})

// Refresh storage info
const refreshStorageInfo = async () => {
  try {
    storageInfo.value = await getLocalStorageInfo()
  } catch (error) {
    console.error('Failed to get storage info:', error)
  }
}

// Delete individual file
const deleteFile = async (txHash: string) => {
  if (isDeleting.value[txHash]) return

  deleteTargetTxHash.value = txHash
  deleteTargetType.value = 'single'
  showDeleteConfirm.value = true
}

// Delete all files for current wallet
const deleteAllFiles = async () => {
  deleteTargetType.value = 'all'
  showDeleteConfirm.value = true
}

// Confirm deletion
const confirmDelete = async () => {
  showDeleteConfirm.value = false

  if (deleteTargetType.value === 'single') {
    await deleteSingleFile(deleteTargetTxHash.value)
  } else {
    await deleteAllUserFiles()
  }
}

// Cancel deletion
const cancelDelete = () => {
  showDeleteConfirm.value = false
  deleteTargetTxHash.value = ''
}

// Delete single file implementation
const deleteSingleFile = async (txHash: string) => {
  isDeleting.value[txHash] = true

  try {
    console.log('Deleting file with txHash:', txHash)

    // Delete from IndexedDB
    const deleted = await deleteFileByTxHash(txHash)

    // Delete from database via API
    try {
      await mappingService.deleteMappingByTxHash(txHash)
      console.log('Deleted mapping from database')
    } catch (dbError) {
      console.warn('Failed to delete from database:', dbError)
    }

    // Remove from localStorage
    try {
      const localUploads = JSON.parse(localStorage.getItem('medicalVaultUploads') || '[]')
      const filteredUploads = localUploads.filter((upload: any) => upload.txHash !== txHash)
      localStorage.setItem('medicalVaultUploads', JSON.stringify(filteredUploads))
      console.log('Removed from localStorage')
    } catch (localError) {
      console.warn('Failed to update localStorage:', localError)
    }

    if (deleted) {
      console.log('File deleted successfully')
      // Refresh the document list
      await loadUserDocuments()
      await refreshStorageInfo()
    } else {
      console.warn('File not found in IndexedDB')
    }
  } catch (deleteError) {
    console.error('Failed to delete file:', deleteError)
    error.value = `Failed to delete file: ${(deleteError as Error).message}`
  } finally {
    isDeleting.value[txHash] = false
  }
}

// Delete all files for current wallet
const deleteAllUserFiles = async () => {
  try {
    console.log('Deleting all files for wallet:', props.account)

    // Delete from IndexedDB
    const deletedCount = await deleteFilesByWallet(props.account)
    console.log(`Deleted ${deletedCount} files from IndexedDB`)

    // Delete from database via API
    try {
      await mappingService.clearMappingsByWallet(props.account)
      console.log('Cleared mappings from database')
    } catch (dbError) {
      console.warn('Failed to clear database mappings:', dbError)
    }

    // Clear localStorage
    try {
      const localUploads = JSON.parse(localStorage.getItem('medicalVaultUploads') || '[]')
      const filteredUploads = localUploads.filter((upload: any) =>
        upload.metadata?.walletAddress?.toLowerCase() !== props.account.toLowerCase()
      )
      localStorage.setItem('medicalVaultUploads', JSON.stringify(filteredUploads))
      console.log('Cleared localStorage entries')
    } catch (localError) {
      console.warn('Failed to update localStorage:', localError)
    }

    console.log(`Successfully deleted ${deletedCount} files`)

    // Refresh the document list
    await loadUserDocuments()
    await refreshStorageInfo()

  } catch (deleteError) {
    console.error('Failed to delete files:', deleteError)
    error.value = `Failed to delete files: ${(deleteError as Error).message}`
  }
}

// Force refresh with cache clearing
const forceRefresh = async () => {
  if (isRefreshing.value) return

  isRefreshing.value = true
  try {
    console.log('Force refreshing documents...')

    // Clear all caches
    if ('caches' in window) {
      const cacheNames = await caches.keys()
      await Promise.all(cacheNames.map(name => caches.delete(name)))
      console.log('Browser caches cleared')
    }

    // Clear mapping service cache
    if ((window as any).mappingServiceCache) {
      (window as any).mappingServiceCache.clear()
      console.log('Mapping service cache cleared')
    }

    // Clear component state
    userDocuments.value = []

    // Reload documents
    await loadUserDocuments()
    await refreshStorageInfo()

    console.log('Force refresh completed')
  } catch (error) {
    console.error('Force refresh failed:', error)
  } finally {
    isRefreshing.value = false
  }
}

// Load storage info when component mounts (but not documents)
onMounted(() => {
  refreshStorageInfo()
})

// Watch for account changes - only refresh storage info, not documents
watch(() => props.account, () => {
  // Clear any existing documents when account changes
  userDocuments.value = []
  refreshStorageInfo()
})
</script>

<style scoped>
.document-download {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
}

/* Smart Account Styles */
.smart-account-section {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 2rem;
  color: white;
}

.account-toggle {
  margin-bottom: 1rem;
}

.toggle-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-weight: 500;
}

.toggle-label input[type="checkbox"] {
  width: 18px;
  height: 18px;
  accent-color: white;
}

.toggle-text {
  font-size: 1.1rem;
}

.xrp-history {
  margin-top: 1rem;
  padding: 1rem;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  backdrop-filter: blur(10px);
}

.xrp-history h4 {
  margin-bottom: 1rem;
  color: white;
}

.transaction-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.transaction-item {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  padding: 0.75rem;
}

.tx-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.tx-hash {
  font-family: monospace;
  font-size: 0.9rem;
}

.tx-amount {
  font-weight: bold;
  color: #2ecc71;
}

.tx-memo {
  font-size: 0.8rem;
  opacity: 0.8;
  flex: 1;
  text-align: right;
}

.uploaded-documents, .manual-lookup {
  background: white;
  border-radius: 8px;
  padding: 2rem;
  margin-bottom: 2rem;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.header-with-refresh {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.refresh-btn {
  background: #3498db;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background-color 0.3s;
}

.refresh-btn:hover:not(:disabled) {
  background: #2980b9;
}

.refresh-btn:disabled {
  background: #bdc3c7;
  cursor: not-allowed;
}

.no-documents {
  text-align: center;
  color: #7f8c8d;
  padding: 2rem;
}

.documents-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.document-card {
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: box-shadow 0.3s;
}

.document-card:hover {
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
}

.doc-info h4 {
  margin: 0 0 0.5rem 0;
  color: #2c3e50;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.file-status {
  font-size: 0.75rem;
  font-weight: normal;
  padding: 0.25rem 0.5rem;
  border-radius: 12px;
  white-space: nowrap;
}

.file-status {
  background: #e9ecef;
  color: #495057;
}

.file-status[data-exists="true"] {
  background: #d4edda;
  color: #155724;
}

.file-status[data-exists="false"] {
  background: #f8d7da;
  color: #721c24;
}

.doc-info p {
  margin: 0.25rem 0;
  color: #7f8c8d;
  font-size: 0.9rem;
}

.doc-actions {
  display: flex;
  gap: 0.5rem;
  flex-direction: column;
}

.view-btn, .blockchain-btn, .lookup-btn, .close-btn, .delete-btn, .delete-all-btn, .load-docs-btn, .refresh-btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.3s;
  text-decoration: none;
  text-align: center;
  min-width: 180px;
}

.view-btn {
  background: #27ae60;
  color: white;
}

.view-btn:hover:not(:disabled) {
  background: #219a52;
  transform: translateY(-2px);
}

.view-btn:disabled {
  background: #bdc3c7;
  cursor: not-allowed;
  transform: none;
}

.blockchain-btn {
  background: #3498db;
  color: white;
}

.blockchain-btn:hover {
  background: #2980b9;
  transform: translateY(-2px);
}

.lookup-btn {
  background: #9b59b6;
  color: white;
  width: 100%;
}

.lookup-btn:hover:not(:disabled) {
  background: #8e44ad;
}

.lookup-btn:disabled {
  background: #bdc3c7;
  cursor: not-allowed;
}

.close-btn {
  background: #e74c3c;
  color: white;
  margin-top: 1rem;
}

.close-btn:hover {
  background: #c0392b;
}

.delete-btn {
  background: #e74c3c;
  color: white;
  font-size: 0.9rem;
  min-width: 120px;
}

.delete-btn:hover:not(:disabled) {
  background: #c0392b;
  transform: translateY(-1px);
}

.delete-btn:disabled {
  background: #bdc3c7;
  cursor: not-allowed;
  transform: none;
}

.delete-all-btn {
  background: #e74c3c;
  color: white;
  margin: 1rem 0;
  width: 100%;
  font-size: 1rem;
  border-radius: 6px;
  padding: 1rem;
}

.delete-all-btn:hover:not(:disabled) {
  background: #c0392b;
  transform: translateY(-2px);
}

.delete-all-btn:disabled {
  background: #bdc3c7;
  cursor: not-allowed;
  transform: none;
}

.load-docs-btn {
  background: #3498db;
  color: white;
  margin: 0 0.5rem;
}

.load-docs-btn:hover:not(:disabled) {
  background: #2980b9;
  transform: translateY(-2px);
}

.load-docs-btn:disabled {
  background: #bdc3c7;
  cursor: not-allowed;
  transform: none;
}

.refresh-btn {
  background: #95a5a6;
  color: white;
  margin: 0 0.5rem;
}

.refresh-btn:hover:not(:disabled) {
  background: #7f8c8d;
  transform: translateY(-2px);
}

.refresh-btn:disabled {
  background: #bdc3c7;
  cursor: not-allowed;
  transform: none;
}

.input-group {
  margin-bottom: 1.5rem;
}

.input-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #2c3e50;
}

.input-group input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
}

.blockchain-decrypt-info {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 1rem;
  border-radius: 8px;
  margin: 1rem 0;
}

.blockchain-decrypt-info h4 {
  margin: 0 0 0.5rem 0;
}

.blockchain-decrypt-info p {
  margin: 0;
  opacity: 0.9;
}

.viewed-document {
  background: white;
  border-radius: 8px;
  padding: 2rem;
  margin-bottom: 2rem;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.document-content {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  padding: 1rem;
  max-height: 400px;
  overflow-y: auto;
}

.document-meta {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  padding: 1rem;
  margin-bottom: 1rem;
}

.document-meta p {
  margin: 0.25rem 0;
  font-size: 0.9rem;
}

.document-content pre {
  margin: 0;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.status {
  background: #e8f5e8;
  color: #27ae60;
  padding: 1rem;
  border-radius: 4px;
  margin-top: 1rem;
  text-align: center;
}

.error {
  background: #ffebee;
  color: #c62828;
  padding: 1rem;
  border-radius: 4px;
  margin-top: 1rem;
}

.storage-info {
  background: white;
  border-radius: 8px;
  padding: 2rem;
  margin-bottom: 2rem;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.storage-details {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.storage-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem;
  background: #f8f9fa;
  border-radius: 4px;
  border: 1px solid #dee2e6;
}

.storage-item .label {
  font-weight: 600;
  color: #495057;
  min-width: 120px;
}

.storage-item .value {
  font-family: 'Courier New', monospace;
  font-size: 0.9rem;
  color: #6c757d;
}

.progress-bar {
  flex: 1;
  height: 20px;
  background: #e9ecef;
  border-radius: 10px;
  margin: 0 1rem;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #28a745 0%, #ffc107 70%, #dc3545 90%);
  transition: width 0.3s ease;
}

.refresh-btn {
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 0.75rem 1rem;
  cursor: pointer;
  font-weight: 500;
  transition: background 0.3s;
}

.refresh-btn:hover {
  background: #0056b3;
}

h2, h3 {
  color: #2c3e50;
  margin-bottom: 1rem;
}

.lookup-section {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
}

.lookup-section h4 {
  margin: 0 0 1rem 0;
  color: #495057;
}

.lookup-btn.secondary {
  background: #6c757d;
  color: white;
}

.lookup-btn.secondary:hover:not(:disabled) {
  background: #545b62;
}

.blockchain-benefits {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.blockchain-benefits span {
  background: rgba(255, 255, 255, 0.2);
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.8rem;
}

.blockchain-info {
  background: #e3f2fd;
  border: 1px solid #bbdefb;
  border-radius: 4px;
  padding: 0.75rem;
  margin: 0.5rem 0;
}

.blockchain-info p {
  margin: 0.25rem 0;
  font-size: 0.85rem;
}

.hash-display {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.8rem;
  background: #f1f3f4;
  padding: 2px 4px;
  border-radius: 3px;
  word-break: break-all;
  color: #1976d2;
}

/* Confirmation Dialog Styles */
.delete-confirm-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.delete-confirm-dialog {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  max-width: 400px;
  width: 90%;
  text-align: center;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
}

.delete-confirm-dialog h3 {
  margin: 0 0 1rem 0;
  color: #e74c3c;
}

.delete-confirm-dialog p {
  margin: 0 0 1.5rem 0;
  color: #2c3e50;
  line-height: 1.5;
}

.dialog-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
}

.cancel-btn {
  padding: 0.75rem 1.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
  color: #2c3e50;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.3s;
}

.cancel-btn:hover {
  background: #f8f9fa;
  border-color: #adb5bd;
}

.confirm-delete-btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 4px;
  background: #e74c3c;
  color: white;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.3s;
}

.confirm-delete-btn:hover {
  background: #c0392b;
}

@media (max-width: 768px) {
  .document-card {
    flex-direction: column;
    text-align: center;
    gap: 1rem;
  }

  .doc-actions {
    flex-direction: row;
    justify-content: center;
  }

  .view-btn, .blockchain-btn {
    min-width: 140px;
  }

  .delete-confirm-dialog {
    margin: 1rem;
    width: calc(100% - 2rem);
  }

  .dialog-actions {
    flex-direction: column;
  }

  .cancel-btn, .confirm-delete-btn {
    width: 100%;
  }
}
</style>