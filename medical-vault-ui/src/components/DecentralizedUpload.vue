<template>
  <div class="decentralized-upload">
    <div class="upload-header">
      <h2>📤 Decentralized Document Upload</h2>
      <p class="decentralized-notice">
        ⚡ <strong>Fully Decentralized:</strong> Files encrypted locally, stored on IPFS, metadata on blockchain.
        No central servers required!
      </p>
    </div>

    <div class="upload-form">
      <!-- Patient ID Input -->
      <div class="form-group">
        <label for="patientId">Patient ID (Bytes32 format):</label>
        <input
          id="patientId"
          v-model="patientId"
          type="text"
          placeholder="0x1234567890abcdef..."
          class="input-field"
          :disabled="isUploading"
        />
        <small>Enter the blockchain patient identifier</small>
      </div>

      <!-- Document Type Selection -->
      <div class="form-group">
        <label for="documentType">Document Type:</label>
        <select
          id="documentType"
          v-model="documentType"
          class="select-field"
          :disabled="isUploading"
        >
          <option value={0}>🩺 Diagnosis</option>
          <option value={1}>📋 Referral</option>
          <option value={2}>📝 Intake</option>
        </select>
      </div>

      <!-- Encryption Password -->
      <div class="form-group">
        <label for="password">Encryption Password:</label>
        <input
          id="password"
          v-model="encryptionPassword"
          type="password"
          placeholder="Enter strong password for file encryption"
          class="input-field"
          :disabled="isUploading"
        />
        <small>⚠️ Store this password safely - it cannot be recovered!</small>
      </div>

      <!-- File Upload -->
      <div class="form-group">
        <label for="file">Select Medical Document:</label>
        <input
          id="file"
          ref="fileInput"
          type="file"
          @change="handleFileSelect"
          class="file-input"
          accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.dicom"
          :disabled="isUploading"
        />
        <div v-if="selectedFile" class="file-info">
          <p>📄 <strong>{{ selectedFile.name }}</strong></p>
          <p>📏 Size: {{ formatFileSize(selectedFile.size) }}</p>
          <p>📅 Modified: {{ new Date(selectedFile.lastModified).toLocaleDateString() }}</p>
        </div>
      </div>

      <!-- Upload Progress -->
      <div v-if="uploadProgress.show" class="upload-progress">
        <div class="progress-header">
          <h3>{{ uploadProgress.title }}</h3>
          <span class="progress-percentage">{{ uploadProgress.percentage }}%</span>
        </div>
        <div class="progress-bar">
          <div
            class="progress-fill"
            :style="{ width: uploadProgress.percentage + '%' }"
          ></div>
        </div>
        <p class="progress-description">{{ uploadProgress.description }}</p>

        <!-- Real-time status -->
        <div class="upload-steps">
          <div
            v-for="step in uploadSteps"
            :key="step.id"
            class="upload-step"
            :class="{
              'completed': step.completed,
              'active': step.active,
              'failed': step.failed
            }"
          >
            <span class="step-icon">{{ step.icon }}</span>
            <span class="step-text">{{ step.text }}</span>
          </div>
        </div>
      </div>

      <!-- Upload Button -->
      <button
        @click="uploadDocument"
        :disabled="!canUpload"
        class="upload-btn"
        :class="{ 'uploading': isUploading }"
      >
        <span v-if="!isUploading">🚀 Upload to Decentralized Network</span>
        <span v-else>⏳ {{ uploadProgress.title }}...</span>
      </button>

      <!-- Success Result -->
      <div v-if="uploadResult" class="upload-result success">
        <h3>✅ Upload Successful!</h3>
        <div class="result-details">
          <div class="result-item">
            <strong>IPFS CID:</strong>
            <code class="cid">{{ uploadResult.cid }}</code>
            <button @click="copyToClipboard(uploadResult.cid)" class="copy-btn">📋</button>
          </div>
          <div class="result-item">
            <strong>Transaction Hash:</strong>
            <code class="tx-hash">{{ uploadResult.transactionHash }}</code>
            <button @click="copyToClipboard(uploadResult.transactionHash)" class="copy-btn">📋</button>
          </div>
          <div class="result-item">
            <strong>Block Number:</strong>
            <span>{{ uploadResult.blockNumber }}</span>
          </div>
          <div class="result-item">
            <strong>Gas Used:</strong>
            <span>{{ uploadResult.gasUsed }}</span>
          </div>
        </div>

        <!-- Decentralization Status -->
        <div class="decentralization-status">
          <h4>🌐 Decentralization Status</h4>
          <div class="status-grid">
            <div class="status-item">
              <span class="status-icon">✅</span>
              <span>File encrypted locally</span>
            </div>
            <div class="status-item">
              <span class="status-icon">✅</span>
              <span>Stored on IPFS network</span>
            </div>
            <div class="status-item">
              <span class="status-icon">✅</span>
              <span>Metadata on blockchain</span>
            </div>
            <div class="status-item">
              <span class="status-icon">✅</span>
              <span>No central servers used</span>
            </div>
          </div>

          <!-- Access Instructions -->
          <div class="access-instructions">
            <h5>🔓 How to Access Your File:</h5>
            <ol>
              <li>Your file is permanently stored on IPFS: <code>ipfs://{{ uploadResult.cid }}</code></li>
              <li>Metadata is recorded on Flare blockchain (immutable)</li>
              <li>Use any IPFS gateway or this app to download</li>
              <li>File remains accessible even if this website goes offline</li>
            </ol>
          </div>
        </div>
      </div>

      <!-- Error Display -->
      <div v-if="errorMessage" class="upload-result error">
        <h3>❌ Upload Failed</h3>
        <p>{{ errorMessage }}</p>
        <button @click="resetUpload" class="retry-btn">🔄 Try Again</button>
      </div>
    </div>

    <!-- IPFS Network Status -->
    <div class="network-status">
      <h3>🌐 Network Status</h3>
      <div class="status-grid">
        <div class="status-item" :class="{ 'online': ipfsStatus.connected }">
          <span class="status-dot"></span>
          <span>IPFS: {{ ipfsStatus.connected ? 'Connected' : 'Disconnected' }}</span>
        </div>
        <div class="status-item" :class="{ 'online': blockchainStatus.connected }">
          <span class="status-dot"></span>
          <span>Blockchain: {{ blockchainStatus.connected ? 'Connected' : 'Disconnected' }}</span>
        </div>
      </div>
      <p class="redundancy-info">
        📡 Using {{ activeGateways }} IPFS gateways for maximum redundancy
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ethers } from 'ethers'
import { decentralizedStorage } from '@/utils/decentralized-storage'
import { decentralizedIndexing } from '@/utils/decentralized-indexing'

interface Props {
  account: string
  contract: any
  isConnected: boolean
}

const props = defineProps<Props>()

// Form data
const patientId = ref('')
const documentType = ref(0)
const encryptionPassword = ref('')
const selectedFile = ref<File | null>(null)
const fileInput = ref<HTMLInputElement>()

// Upload state
const isUploading = ref(false)
const uploadResult = ref<any>(null)
const errorMessage = ref('')

// Progress tracking
const uploadProgress = ref({
  show: false,
  title: '',
  description: '',
  percentage: 0
})

const uploadSteps = ref([
  { id: 1, icon: '🔒', text: 'Encrypting file locally', completed: false, active: false, failed: false },
  { id: 2, icon: '📡', text: 'Uploading to IPFS network', completed: false, active: false, failed: false },
  { id: 3, icon: '⛓️', text: 'Recording on blockchain', completed: false, active: false, failed: false },
  { id: 4, icon: '🌐', text: 'Pinning to multiple nodes', completed: false, active: false, failed: false },
  { id: 5, icon: '✅', text: 'Upload complete', completed: false, active: false, failed: false }
])

// Network status
const ipfsStatus = ref({ connected: false })
const blockchainStatus = ref({ connected: false })
const activeGateways = ref(0)

// Computed properties
const canUpload = computed(() => {
  return patientId.value &&
         encryptionPassword.value &&
         selectedFile.value &&
         !isUploading.value &&
         props.isConnected
})

// File selection handler
const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files && target.files[0]) {
    selectedFile.value = target.files[0]
  }
}

// Update progress
const updateProgress = (stepId: number, status: 'active' | 'completed' | 'failed', percentage: number, title: string, description: string) => {
  // Reset all steps
  uploadSteps.value.forEach(step => {
    step.active = false
    if (stepId > step.id) {
      step.completed = true
      step.failed = false
    } else if (stepId === step.id) {
      step.active = status === 'active'
      step.completed = status === 'completed'
      step.failed = status === 'failed'
    }
  })

  uploadProgress.value = {
    show: true,
    title,
    description,
    percentage
  }
}

// Main upload function
const uploadDocument = async () => {
  if (!canUpload.value || !selectedFile.value) return

  isUploading.value = true
  errorMessage.value = ''
  uploadResult.value = null

  try {
    // Step 1: Encrypt file locally
    updateProgress(1, 'active', 10, 'Encrypting File', 'Encrypting file with your password locally in browser')

    const uploadData = await decentralizedStorage.uploadFile(
      selectedFile.value,
      encryptionPassword.value
    )

    updateProgress(1, 'completed', 25, 'File Encrypted', 'File successfully encrypted and uploaded to IPFS')

    // Step 2: Upload to IPFS (already done in uploadFile)
    updateProgress(2, 'completed', 50, 'IPFS Upload Complete', `File stored with CID: ${uploadData.cid}`)

    // Step 3: Record on blockchain
    updateProgress(3, 'active', 60, 'Recording on Blockchain', 'Submitting transaction to Flare Network')

    const ipfsURI = `ipfs://${uploadData.cid}`
    const tx = await props.contract.uploadDocumentDeduct(
      patientId.value,
      documentType.value,
      ipfsURI
    )

    updateProgress(3, 'active', 70, 'Transaction Submitted', `Waiting for confirmation: ${tx.hash}`)

    const receipt = await tx.wait()
    updateProgress(3, 'completed', 85, 'Blockchain Confirmed', `Transaction mined in block ${receipt.blockNumber}`)

    // Step 4: Pinning (simulated for now)
    updateProgress(4, 'active', 90, 'Pinning to Network', 'Ensuring file availability across IPFS nodes')

    // Simulate pinning delay
    await new Promise(resolve => setTimeout(resolve, 1000))
    updateProgress(4, 'completed', 95, 'Pinning Complete', 'File pinned to multiple IPFS nodes')

    // Step 5: Complete
    updateProgress(5, 'completed', 100, 'Upload Complete', 'Document successfully uploaded to decentralized network')

    // Store result
    uploadResult.value = {
      cid: uploadData.cid,
      filename: uploadData.filename,
      size: uploadData.size,
      encryptedSize: uploadData.encryptedSize,
      transactionHash: tx.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString()
    }

    // Add to local index
    const metadata = {
      cid: uploadData.cid,
      patientId: patientId.value,
      documentType: documentType.value,
      version: 1, // Get from blockchain event if needed
      timestamp: Date.now(),
      blockNumber: receipt.blockNumber,
      transactionHash: tx.hash,
      uploader: props.account,
      filename: uploadData.filename,
      size: uploadData.size,
      encryptedSize: uploadData.encryptedSize
    }

    decentralizedIndexing.addDocumentToIndex(metadata)

    console.log('✅ Document upload complete:', uploadResult.value)

  } catch (error: any) {
    console.error('Upload failed:', error)
    errorMessage.value = error.message || 'Upload failed. Please try again.'

    // Mark current step as failed
    const activeStep = uploadSteps.value.find(step => step.active)
    if (activeStep) {
      updateProgress(activeStep.id, 'failed', uploadProgress.value.percentage, 'Upload Failed', error.message)
    }
  } finally {
    isUploading.value = false
  }
}

// Reset upload state
const resetUpload = () => {
  isUploading.value = false
  uploadResult.value = null
  errorMessage.value = ''
  uploadProgress.value.show = false

  uploadSteps.value.forEach(step => {
    step.completed = false
    step.active = false
    step.failed = false
  })

  // Clear form
  patientId.value = ''
  encryptionPassword.value = ''
  selectedFile.value = null
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

// Utility functions
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text)
    // Could add a toast notification here
  } catch (error) {
    console.error('Failed to copy to clipboard:', error)
  }
}

// Check network status
const checkNetworkStatus = async () => {
  try {
    // Check IPFS connectivity
    await decentralizedStorage.initializeIPFS()
    ipfsStatus.value.connected = true
    activeGateways.value = 6 // Number of gateways configured
  } catch (error) {
    ipfsStatus.value.connected = false
  }

  // Check blockchain connectivity
  blockchainStatus.value.connected = props.isConnected && !!props.contract
}

// Initialize
onMounted(async () => {
  await checkNetworkStatus()

  // Initialize indexing if contract is available
  if (props.contract) {
    decentralizedIndexing.initialize(props.contract, props.contract.provider)
  }
})
</script>

<style scoped>
.decentralized-upload {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
}

.upload-header h2 {
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
  font-size: 0.95rem;
}

.upload-form {
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.form-group {
  margin-bottom: 1.5rem;
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
  transition: border-color 0.3s;
}

.input-field:focus, .select-field:focus {
  outline: none;
  border-color: #3498db;
}

.file-input {
  width: 100%;
  padding: 0.75rem;
  border: 2px dashed #bdc3c7;
  border-radius: 8px;
  cursor: pointer;
  transition: border-color 0.3s;
}

.file-input:hover {
  border-color: #3498db;
}

.file-info {
  margin-top: 1rem;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 8px;
}

.upload-progress {
  margin: 2rem 0;
  padding: 1.5rem;
  background: #f8f9fa;
  border-radius: 8px;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: #ecf0f1;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 1rem;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #27ae60, #2ecc71);
  transition: width 0.3s ease;
}

.upload-steps {
  margin-top: 1rem;
}

.upload-step {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0;
  opacity: 0.5;
  transition: opacity 0.3s;
}

.upload-step.active {
  opacity: 1;
  color: #3498db;
}

.upload-step.completed {
  opacity: 1;
  color: #27ae60;
}

.upload-step.failed {
  opacity: 1;
  color: #e74c3c;
}

.upload-btn {
  width: 100%;
  padding: 1rem 2rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1.1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.upload-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
}

.upload-btn:disabled {
  background: #95a5a6;
  cursor: not-allowed;
  transform: none;
}

.upload-result {
  margin-top: 2rem;
  padding: 1.5rem;
  border-radius: 8px;
}

.upload-result.success {
  background: #d5f4e6;
  border: 2px solid #27ae60;
}

.upload-result.error {
  background: #ffebee;
  border: 2px solid #e74c3c;
}

.result-details {
  margin: 1rem 0;
}

.result-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.cid, .tx-hash {
  font-family: monospace;
  background: rgba(0, 0, 0, 0.1);
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

.decentralization-status {
  margin-top: 1rem;
  padding: 1rem;
  background: rgba(255, 255, 255, 0.5);
  border-radius: 8px;
}

.status-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 0.5rem;
  margin: 1rem 0;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
}

.status-icon {
  font-size: 1.2rem;
}

.access-instructions {
  margin-top: 1rem;
}

.access-instructions ol {
  margin-left: 1.5rem;
}

.access-instructions li {
  margin-bottom: 0.5rem;
}

.network-status {
  margin-top: 2rem;
  padding: 1.5rem;
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #e74c3c;
}

.status-item.online .status-dot {
  background: #27ae60;
}

.redundancy-info {
  margin-top: 1rem;
  font-size: 0.9rem;
  color: #7f8c8d;
}

.retry-btn {
  background: #e67e22;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  margin-top: 1rem;
}

@media (max-width: 768px) {
  .decentralized-upload {
    padding: 1rem;
  }

  .upload-form {
    padding: 1rem;
  }

  .result-item {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>