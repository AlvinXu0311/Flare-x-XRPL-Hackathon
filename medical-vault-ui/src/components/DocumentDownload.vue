<template>
  <div class="document-download">
    <h2>View Medical Documents</h2>

    <!-- Your Uploaded Documents -->
    <div class="uploaded-documents">
      <h3>📄 Your Stored Documents</h3>
      <p>Documents you've stored on the blockchain with your wallet:</p>

      <div v-if="userDocuments.length === 0" class="no-documents">
        <p>No documents found. Store some documents first!</p>
      </div>

      <div v-else class="documents-list">
        <div
          v-for="doc in userDocuments"
          :key="doc.txHash"
          class="document-card"
        >
          <div class="doc-info">
            <h4>{{ doc.filename || 'Document' }}</h4>
            <p><strong>Type:</strong> {{ getDocTypeName(doc.docType) }}</p>
            <p><strong>Content Type:</strong> {{ doc.contentType || 'text' }}</p>
            <p><strong>Stored:</strong> {{ formatDate(doc.uploadDate) }}</p>
            <p><strong>Content Hash:</strong> {{ doc.contentHash }}</p>
            <p><strong>Tx Hash:</strong> {{ doc.txHash }}</p>
          </div>

          <div class="doc-actions">
            <button
              @click="viewDocument(doc)"
              :disabled="isViewing[doc.txHash]"
              class="view-btn"
            >
              {{ isViewing[doc.txHash] ? 'Decrypting...' : (doc.contentType === 'file' ? '📥 Download File' : '📄 View Text') }}
            </button>
            <button @click="viewOnBlockchain(doc.txHash)" class="blockchain-btn">
              🔗 View on Blockchain
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Manual Document Lookup -->
    <div class="manual-lookup">
      <h3>🔍 Look up Document by Patient ID</h3>
      <p>Enter patient information to retrieve documents:</p>

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

      <div class="blockchain-decrypt-info">
        <h4>🔐 Blockchain Retrieval</h4>
        <p>This will retrieve documents from the blockchain and attempt to decrypt them with your wallet signature.</p>
      </div>

      <button
        @click="lookupDocuments"
        :disabled="!lookupMrn || !lookupSalt || isLookingUp"
        class="lookup-btn"
      >
        {{ isLookingUp ? 'Looking up...' : '🔍 Look up Documents' }}
      </button>
    </div>

    <!-- Viewed Document Content -->
    <div v-if="viewedDocument" class="viewed-document">
      <h3>📄 {{ viewedDocument.filename }}</h3>
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
        🔄 Refresh Storage Info
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
import { decryptTextWithWallet, decryptFileWithWallet, hashPatientId, parseContentURI } from '@/utils/encryption'
import { getStoredFileByTxHash, getAllStoredFiles, createDownloadBlob, formatFileSize, getLocalStorageInfo } from '@/utils/local-storage'
import { mappingService } from '@/utils/mapping-service'

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
const isViewing = ref<Record<string, boolean>>({})
const isLookingUp = ref(false)
const viewedDocument = ref<any>(null)
const status = ref('')
const error = ref('')
const storageInfo = ref<any>(null)

// Document type names
const getDocTypeName = (type: string | number): string => {
  const types: Record<string, string> = {
    '0': '🩺 Diagnosis',
    '1': '📋 Referral',
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
  try {
    console.log('🔄 Loading user documents from local storage and database...')

    // Get documents from localStorage (legacy)
    const localUploads = JSON.parse(localStorage.getItem('medicalVaultUploads') || '[]')
    console.log('Local uploads found:', localUploads.length)

    // Filter documents uploaded by current wallet
    const localDocs = localUploads.filter((doc: any) =>
      doc.metadata?.walletAddress?.toLowerCase() === props.account.toLowerCase()
    )

    // Try to get documents from database as well
    let dbDocs: any[] = []
    try {
      console.log('🔄 Fetching documents from database...')
      const mappings = await mappingService.getMappingsByWallet(props.account.toLowerCase())

      // Convert database mappings to the format expected by the UI
      dbDocs = mappings.map((mapping: any) => ({
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
        gasUsed: mapping.gasUsed
      }))

      console.log(`✅ Retrieved ${dbDocs.length} documents from database`)
    } catch (dbError) {
      console.warn('⚠️ Failed to fetch documents from database (using local only):', dbError)
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
    console.log(`✅ Total documents loaded: ${allDocs.length}`)

  } catch (error) {
    console.error('❌ Failed to load user documents:', error)
    userDocuments.value = []
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
      // Decrypt text content
      const decryptedText = await decryptTextWithWallet(
        storedFile.encryptedContent as string,
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

    // Query blockchain for documents
    status.value = 'Querying smart contract...'

    // Get document count for this patient
    const count = await props.contract.getDocumentCount(patientId)

    if (count.eq(0)) {
      status.value = 'No documents found for this patient ID'
      return
    }

    status.value = `Found ${count.toString()} document(s). Loading...`

    // Get all documents for this patient
    const documents = []
    for (let i = 0; i < count.toNumber(); i++) {
      const doc = await props.contract.getDocument(patientId, i)

      // Parse the content URI to get hash and metadata
      const { hash, metadata } = parseContentURI(doc.ipfsHash)

      documents.push({
        patientId,
        docType: doc.docType.toString(),
        contentHash: hash,
        contentURI: doc.ipfsHash,
        filename: metadata.filename || 'Document',
        contentType: metadata.type || 'text',
        version: doc.version.toString(),
        uploadDate: new Date(doc.timestamp.toNumber() * 1000).toISOString(),
        txHash: 'blockchain-lookup-' + i // Placeholder
      })
    }

    status.value = `Successfully retrieved ${documents.length} document(s)`

    // Add to user documents for display
    userDocuments.value = [...userDocuments.value, ...documents]

    setTimeout(() => {
      status.value = ''
    }, 3000)

  } catch (err: any) {
    console.error('Lookup failed:', err)
    error.value = `Lookup failed: ${err.message}`
  } finally {
    isLookingUp.value = false
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

// Load documents when component mounts
onMounted(() => {
  loadUserDocuments()
  refreshStorageInfo()
})

// Watch for account changes
watch(() => props.account, () => {
  loadUserDocuments()
})
</script>

<style scoped>
.document-download {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
}

.uploaded-documents, .manual-lookup {
  background: white;
  border-radius: 8px;
  padding: 2rem;
  margin-bottom: 2rem;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
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

.view-btn, .blockchain-btn, .lookup-btn, .close-btn {
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
}
</style>