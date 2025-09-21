<template>
  <div class="decentralized-download">
    <div class="download-header">
      <h2>📥 Decentralized Document Download</h2>
      <p class="decentralized-notice">
        🌐 <strong>Direct from IPFS:</strong> Download files directly from the decentralized network.
        Works even if this website is offline!
      </p>
    </div>

    <!-- Search and Filter -->
    <div class="search-section">
      <div class="search-form">
        <div class="form-row">
          <div class="form-group">
            <label for="searchPatientId">Patient ID:</label>
            <input
              id="searchPatientId"
              v-model="searchCriteria.patientId"
              type="text"
              placeholder="0x1234567890abcdef..."
              class="input-field"
            />
          </div>
          <div class="form-group">
            <label for="searchDocType">Document Type:</label>
            <select
              id="searchDocType"
              v-model="searchCriteria.documentType"
              class="select-field"
            >
              <option value="">All Types</option>
              <option value="0">🩺 Diagnosis</option>
              <option value="1">📋 Referral</option>
              <option value="2">📝 Intake</option>
            </select>
          </div>
        </div>
        <button @click="searchDocuments" class="search-btn">
          🔍 Search Documents
        </button>
      </div>

      <!-- Index Status -->
      <div class="index-status">
        <div class="status-header">
          <h3>📊 Local Index Status</h3>
          <button @click="syncWithBlockchain" :disabled="isSyncing" class="sync-btn">
            {{ isSyncing ? '🔄 Syncing...' : '🔄 Sync with Blockchain' }}
          </button>
        </div>
        <div class="stats-grid">
          <div class="stat-item">
            <span class="stat-value">{{ indexStats.totalPatients }}</span>
            <span class="stat-label">Patients</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">{{ indexStats.totalDocuments }}</span>
            <span class="stat-label">Documents</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">{{ indexStats.indexSize }}</span>
            <span class="stat-label">Index Size</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">{{ formatDate(indexStats.lastUpdated) }}</span>
            <span class="stat-label">Last Updated</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Documents List -->
    <div class="documents-section">
      <h3>📋 Available Documents</h3>

      <div v-if="isLoading" class="loading">
        <div class="spinner"></div>
        <p>Loading documents...</p>
      </div>

      <div v-else-if="documents.length === 0" class="no-documents">
        <p>No documents found. Try:</p>
        <ul>
          <li>Syncing with blockchain to update your local index</li>
          <li>Searching for a specific patient ID</li>
          <li>Uploading documents first</li>
        </ul>
      </div>

      <div v-else class="documents-grid">
        <div
          v-for="document in documents"
          :key="`${document.patientId}-${document.documentType}`"
          class="document-card"
        >
          <div class="document-header">
            <h4>{{ getDocumentTypeName(document.documentType) }}</h4>
            <span class="document-version">v{{ document.version }}</span>
          </div>

          <div class="document-info">
            <div class="info-row">
              <span class="label">Patient ID:</span>
              <code class="patient-id">{{ document.patientId.slice(0, 10) }}...</code>
            </div>
            <div class="info-row">
              <span class="label">IPFS CID:</span>
              <code class="cid">{{ document.cid.slice(0, 20) }}...</code>
              <button @click="copyToClipboard(document.cid)" class="copy-btn">📋</button>
            </div>
            <div class="info-row">
              <span class="label">Upload Date:</span>
              <span>{{ formatDate(document.timestamp) }}</span>
            </div>
            <div v-if="document.filename" class="info-row">
              <span class="label">Filename:</span>
              <span>{{ document.filename }}</span>
            </div>
            <div v-if="document.size" class="info-row">
              <span class="label">Size:</span>
              <span>{{ formatFileSize(document.size) }}</span>
            </div>
          </div>

          <!-- Availability Status -->
          <div class="availability-status">
            <div
              v-if="fileAvailability[document.cid] !== undefined"
              class="availability-indicator"
              :class="{ 'available': fileAvailability[document.cid] }"
            >
              <span class="status-dot"></span>
              <span>{{ fileAvailability[document.cid] ? 'Available on IPFS' : 'Checking...' }}</span>
            </div>
            <button
              @click="checkFileAvailability(document.cid)"
              class="check-btn"
              :disabled="isCheckingAvailability[document.cid]"
            >
              {{ isCheckingAvailability[document.cid] ? '⏳' : '🔍 Check' }}
            </button>
          </div>

          <!-- Download Section -->
          <div class="download-section">
            <div class="password-input">
              <input
                v-model="downloadPasswords[document.cid]"
                type="password"
                placeholder="Enter decryption password"
                class="password-field"
                @keyup.enter="downloadDocument(document)"
              />
            </div>
            <button
              @click="downloadDocument(document)"
              :disabled="!downloadPasswords[document.cid] || isDownloading[document.cid]"
              class="download-btn"
            >
              <span v-if="!isDownloading[document.cid]">📥 Download</span>
              <span v-else>⏳ Downloading...</span>
            </button>
          </div>

          <!-- Download Progress -->
          <div v-if="downloadProgress[document.cid]" class="download-progress">
            <div class="progress-text">
              {{ downloadProgress[document.cid].status }}
            </div>
            <div class="progress-bar">
              <div
                class="progress-fill"
                :style="{ width: downloadProgress[document.cid].percentage + '%' }"
              ></div>
            </div>
          </div>

          <!-- Alternative Access Methods -->
          <div class="alternative-access">
            <details>
              <summary>🌐 Alternative Access Methods</summary>
              <div class="access-methods">
                <div class="method">
                  <strong>Direct IPFS:</strong>
                  <code>ipfs://{{ document.cid }}</code>
                </div>
                <div class="method">
                  <strong>Public Gateway:</strong>
                  <a :href="`https://ipfs.io/ipfs/${document.cid}`" target="_blank">
                    https://ipfs.io/ipfs/{{ document.cid }}
                  </a>
                </div>
                <div class="method">
                  <strong>Cloudflare Gateway:</strong>
                  <a :href="`https://cloudflare-ipfs.com/ipfs/${document.cid}`" target="_blank">
                    https://cloudflare-ipfs.com/ipfs/{{ document.cid }}
                  </a>
                </div>
                <p class="method-note">
                  ⚠️ Note: Files are encrypted. You'll need the password to decrypt them.
                </p>
              </div>
            </details>
          </div>

          <!-- Blockchain Verification -->
          <div class="blockchain-verification">
            <button
              @click="verifyOnBlockchain(document)"
              class="verify-btn"
              :disabled="isVerifying[document.cid]"
            >
              {{ isVerifying[document.cid] ? '⏳ Verifying...' : '⛓️ Verify on Blockchain' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Direct CID Download -->
    <div class="direct-download-section">
      <h3>🎯 Direct CID Download</h3>
      <p>If you have a file's IPFS CID, you can download it directly:</p>

      <div class="direct-download-form">
        <div class="form-row">
          <input
            v-model="directCid"
            type="text"
            placeholder="QmXXXXXX... or bafy..."
            class="input-field"
          />
          <input
            v-model="directPassword"
            type="password"
            placeholder="Decryption password"
            class="input-field"
          />
          <input
            v-model="directFilename"
            type="text"
            placeholder="Original filename (optional)"
            class="input-field"
          />
        </div>
        <button
          @click="downloadDirectCid"
          :disabled="!directCid || !directPassword || isDirectDownloading"
          class="download-btn"
        >
          {{ isDirectDownloading ? '⏳ Downloading...' : '📥 Download from CID' }}
        </button>
      </div>
    </div>

    <!-- Emergency Access Instructions -->
    <div class="emergency-access">
      <details>
        <summary>🚨 Emergency Access Instructions</summary>
        <div class="emergency-content">
          <h4>If this website is unavailable:</h4>
          <ol>
            <li>
              <strong>Install IPFS Desktop:</strong>
              <a href="https://github.com/ipfs/ipfs-desktop" target="_blank">
                Download from GitHub
              </a>
            </li>
            <li>
              <strong>Access via command line:</strong>
              <code>ipfs cat [CID] > encrypted_file.bin</code>
            </li>
            <li>
              <strong>Use any IPFS gateway:</strong>
              <code>https://gateway.ipfs.io/ipfs/[CID]</code>
            </li>
            <li>
              <strong>Decrypt locally:</strong>
              Use any AES-256-GCM decryption tool with your password
            </li>
          </ol>
          <p class="emergency-note">
            💡 Your files are permanently stored on IPFS and can be accessed through
            any IPFS node or gateway, independent of this application.
          </p>
        </div>
      </details>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { decentralizedStorage } from '@/utils/decentralized-storage'
import { decentralizedIndexing } from '@/utils/decentralized-indexing'

interface Props {
  account: string
  contract: any
  isConnected: boolean
}

const props = defineProps<Props>()

// Search and filter state
const searchCriteria = reactive({
  patientId: '',
  documentType: '',
  dateFrom: '',
  dateTo: ''
})

// Documents and loading state
const documents = ref<any[]>([])
const isLoading = ref(false)
const isSyncing = ref(false)

// Download state
const downloadPasswords = reactive<Record<string, string>>({})
const isDownloading = reactive<Record<string, boolean>>({})
const downloadProgress = reactive<Record<string, any>>({})

// Availability checking
const fileAvailability = reactive<Record<string, boolean>>({})
const isCheckingAvailability = reactive<Record<string, boolean>>({})

// Verification state
const isVerifying = reactive<Record<string, boolean>>({})

// Direct download
const directCid = ref('')
const directPassword = ref('')
const directFilename = ref('')
const isDirectDownloading = ref(false)

// Index statistics
const indexStats = ref({
  totalPatients: 0,
  totalDocuments: 0,
  lastUpdated: 0,
  indexSize: '0 Bytes'
})

// Document type names
const getDocumentTypeName = (type: number): string => {
  const types: Record<number, string> = { 0: '🩺 Diagnosis', 1: '📋 Referral', 2: '📝 Intake' }
  return types[type] || 'Unknown'
}

// Search documents
const searchDocuments = async () => {
  isLoading.value = true

  try {
    const query: any = {}

    if (searchCriteria.patientId) {
      query.patientId = searchCriteria.patientId
    }

    if (searchCriteria.documentType !== '') {
      query.documentType = parseInt(searchCriteria.documentType)
    }

    const results = decentralizedIndexing.searchDocuments(query)
    documents.value = results.sort((a, b) => b.timestamp - a.timestamp)

    // Check availability for visible documents
    for (const doc of documents.value.slice(0, 10)) {
      checkFileAvailability(doc.cid)
    }

  } catch (error) {
    console.error('Search failed:', error)
  } finally {
    isLoading.value = false
  }
}

// Sync with blockchain
const syncWithBlockchain = async () => {
  if (!props.contract) return

  isSyncing.value = true

  try {
    await decentralizedIndexing.syncWithBlockchain()
    updateIndexStats()
    await searchDocuments() // Refresh current view

    console.log('✅ Sync completed')
  } catch (error) {
    console.error('Sync failed:', error)
  } finally {
    isSyncing.value = false
  }
}

// Check file availability on IPFS
const checkFileAvailability = async (cid: string) => {
  if (isCheckingAvailability[cid]) return

  isCheckingAvailability[cid] = true

  try {
    const available = await decentralizedStorage.checkFileAvailability(cid)
    fileAvailability[cid] = available
  } catch (error) {
    console.error('Availability check failed:', error)
    fileAvailability[cid] = false
  } finally {
    isCheckingAvailability[cid] = false
  }
}

// Download document
const downloadDocument = async (document: any) => {
  const password = downloadPasswords[document.cid]
  if (!password) return

  isDownloading[document.cid] = true
  downloadProgress[document.cid] = { status: 'Starting download...', percentage: 0 }

  try {
    downloadProgress[document.cid] = { status: 'Connecting to IPFS...', percentage: 25 }

    const blob = await decentralizedStorage.downloadFile(
      document.cid,
      password,
      document.filename || 'medical-document'
    )

    downloadProgress[document.cid] = { status: 'Decrypting file...', percentage: 75 }

    // Trigger download
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = document.filename || `medical-doc-${document.documentType}-${Date.now()}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    downloadProgress[document.cid] = { status: 'Download complete!', percentage: 100 }

    // Clear progress after delay
    setTimeout(() => {
      delete downloadProgress[document.cid]
    }, 3000)

    console.log('✅ File downloaded successfully')

  } catch (error) {
    console.error('Download failed:', error)
    downloadProgress[document.cid] = { status: 'Download failed: ' + (error as Error).message, percentage: 0 }

    setTimeout(() => {
      delete downloadProgress[document.cid]
    }, 5000)
  } finally {
    isDownloading[document.cid] = false
  }
}

// Download direct CID
const downloadDirectCid = async () => {
  if (!directCid.value || !directPassword.value) return

  isDirectDownloading.value = true

  try {
    const blob = await decentralizedStorage.downloadFile(
      directCid.value,
      directPassword.value,
      directFilename.value || 'downloaded-file'
    )

    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = directFilename.value || `ipfs-download-${Date.now()}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    console.log('✅ Direct CID download successful')

  } catch (error) {
    console.error('Direct download failed:', error)
    alert(`Download failed: ${(error as Error).message}`)
  } finally {
    isDirectDownloading.value = false
  }
}

// Verify document on blockchain
const verifyOnBlockchain = async (document: any) => {
  if (!props.contract) return

  isVerifying[document.cid] = true

  try {
    const blockchainData = await props.contract.getDocMeta(
      document.patientId,
      document.documentType
    )

    const expectedCid = blockchainData.hashURI.replace('ipfs://', '')

    if (expectedCid === document.cid) {
      alert('✅ Document verified on blockchain!')
    } else {
      alert('❌ Document CID mismatch with blockchain record')
    }

  } catch (error) {
    console.error('Verification failed:', error)
    alert(`Verification failed: ${(error as Error).message}`)
  } finally {
    isVerifying[document.cid] = false
  }
}

// Update index statistics
const updateIndexStats = () => {
  indexStats.value = decentralizedIndexing.getStats()
}

// Utility functions
const formatDate = (timestamp: number): string => {
  if (!timestamp) return 'Never'
  return new Date(timestamp).toLocaleDateString()
}

const formatFileSize = (bytes: number): string => {
  if (!bytes) return 'Unknown'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text)
    // Could show a toast notification
  } catch (error) {
    console.error('Copy failed:', error)
  }
}

// Initialize
onMounted(async () => {
  if (props.contract) {
    decentralizedIndexing.initialize(props.contract, props.contract.provider)
  }

  updateIndexStats()
  await searchDocuments()
})
</script>

<style scoped>
.decentralized-download {
  max-width: 1000px;
  margin: 0 auto;
  padding: 2rem;
}

.download-header h2 {
  color: #2c3e50;
  margin-bottom: 1rem;
  font-size: 1.8rem;
}

.decentralized-notice {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 2rem;
}

.search-section {
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  margin-bottom: 2rem;
}

.search-form {
  margin-bottom: 2rem;
}

.form-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 600;
  color: #2c3e50;
}

.input-field, .select-field {
  width: 100%;
  padding: 0.75rem;
  border: 2px solid #ecf0f1;
  border-radius: 8px;
  font-size: 1rem;
}

.search-btn, .sync-btn {
  background: #3498db;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
  transition: background 0.3s;
}

.search-btn:hover, .sync-btn:hover {
  background: #2980b9;
}

.index-status {
  border-top: 1px solid #ecf0f1;
  padding-top: 1.5rem;
}

.status-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
}

.stat-item {
  text-align: center;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 8px;
}

.stat-value {
  display: block;
  font-size: 1.5rem;
  font-weight: bold;
  color: #2c3e50;
}

.stat-label {
  font-size: 0.9rem;
  color: #7f8c8d;
}

.documents-section {
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  margin-bottom: 2rem;
}

.loading {
  text-align: center;
  padding: 3rem;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #ecf0f1;
  border-left: 4px solid #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 1rem;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.no-documents {
  text-align: center;
  padding: 3rem;
  color: #7f8c8d;
}

.documents-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 1.5rem;
}

.document-card {
  border: 2px solid #ecf0f1;
  border-radius: 12px;
  padding: 1.5rem;
  transition: border-color 0.3s;
}

.document-card:hover {
  border-color: #3498db;
}

.document-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.document-header h4 {
  color: #2c3e50;
  margin: 0;
}

.document-version {
  background: #ecf0f1;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.8rem;
  color: #7f8c8d;
}

.document-info {
  margin-bottom: 1rem;
}

.info-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.label {
  font-weight: 600;
  color: #2c3e50;
  min-width: 100px;
}

.patient-id, .cid {
  font-family: monospace;
  background: #f8f9fa;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.9rem;
}

.copy-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1rem;
}

.availability-status {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
  padding: 0.5rem;
  background: #f8f9fa;
  border-radius: 6px;
}

.availability-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #e74c3c;
}

.availability-indicator.available .status-dot {
  background: #27ae60;
}

.check-btn {
  background: #95a5a6;
  color: white;
  border: none;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8rem;
}

.download-section {
  margin-bottom: 1rem;
}

.password-input {
  margin-bottom: 0.5rem;
}

.password-field {
  width: 100%;
  padding: 0.5rem;
  border: 2px solid #ecf0f1;
  border-radius: 6px;
}

.download-btn {
  width: 100%;
  background: #27ae60;
  color: white;
  border: none;
  padding: 0.75rem;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
}

.download-btn:hover:not(:disabled) {
  background: #219a52;
}

.download-btn:disabled {
  background: #95a5a6;
  cursor: not-allowed;
}

.download-progress {
  margin-top: 0.5rem;
}

.progress-text {
  font-size: 0.9rem;
  color: #7f8c8d;
  margin-bottom: 0.25rem;
}

.progress-bar {
  width: 100%;
  height: 4px;
  background: #ecf0f1;
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #27ae60;
  transition: width 0.3s ease;
}

.alternative-access {
  margin-bottom: 1rem;
}

.alternative-access summary {
  cursor: pointer;
  font-weight: 600;
  color: #3498db;
  margin-bottom: 0.5rem;
}

.access-methods {
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 6px;
  margin-top: 0.5rem;
}

.method {
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
}

.method code, .method a {
  font-family: monospace;
  font-size: 0.8rem;
  word-break: break-all;
}

.method-note {
  margin-top: 0.5rem;
  font-size: 0.8rem;
  color: #e67e22;
}

.verify-btn {
  width: 100%;
  background: #9b59b6;
  color: white;
  border: none;
  padding: 0.5rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
}

.verify-btn:hover:not(:disabled) {
  background: #8e44ad;
}

.direct-download-section {
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  margin-bottom: 2rem;
}

.direct-download-form .form-row {
  margin-bottom: 1rem;
}

.emergency-access {
  background: #fff3cd;
  border: 2px solid #ffc107;
  padding: 1.5rem;
  border-radius: 12px;
}

.emergency-access summary {
  cursor: pointer;
  font-weight: bold;
  color: #856404;
}

.emergency-content {
  margin-top: 1rem;
}

.emergency-content h4 {
  color: #856404;
  margin-bottom: 1rem;
}

.emergency-content ol {
  margin: 1rem 0;
}

.emergency-content li {
  margin-bottom: 0.5rem;
}

.emergency-content code {
  background: rgba(0, 0, 0, 0.1);
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-family: monospace;
}

.emergency-note {
  margin-top: 1rem;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 6px;
  font-style: italic;
}

@media (max-width: 768px) {
  .decentralized-download {
    padding: 1rem;
  }

  .documents-grid {
    grid-template-columns: 1fr;
  }

  .form-row {
    grid-template-columns: 1fr;
  }

  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .status-header {
    flex-direction: column;
    gap: 1rem;
  }
}
</style>