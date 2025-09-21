<template>
  <div class="document-upload">
    <h2>Upload Medical Document</h2>

    <!-- Upload Form -->
    <div class="upload-section">
      <form @submit.prevent="uploadDocument" class="upload-form">
        <!-- Patient Information -->
        <div class="patient-section">
          <h3>Patient Information</h3>
          <div class="input-group">
            <label for="mrn">Medical Record Number (MRN):</label>
            <input
              id="mrn"
              v-model="mrn"
              type="text"
              placeholder="Enter MRN"
              required
            />
          </div>

          <div class="input-group">
            <label for="salt">Salt (for privacy):</label>
            <input
              id="salt"
              v-model="salt"
              type="text"
              placeholder="Enter salt value"
              required
            />
            <button type="button" @click="generateNewSalt" class="generate-salt-btn">
              Generate Random Salt
            </button>
          </div>

          <div class="input-group">
            <label for="docType">Document Type:</label>
            <select id="docType" v-model="docType" required>
              <option value="0">Diagnosis Letter</option>
              <option value="1">Referral</option>
              <option value="2">Intake Form</option>
            </select>
          </div>
        </div>

        <!-- Permission Status -->
        <div v-if="mrn && salt" class="permission-status">
          <!-- Permission checking removed for IPFS-only mode -->
        </div>

        <!-- File Upload -->
        <div class="file-section">
          <h3>Document File</h3>
          <div class="input-group">
            <label for="file">Select File:</label>
            <input
              id="file"
              type="file"
              @change="handleFileSelect"
              accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
              required
            />
            <div v-if="selectedFile" class="file-info">
              <p><strong>Selected:</strong> {{ selectedFile.name }}</p>
              <p><strong>Size:</strong> {{ formatFileSize(selectedFile.size) }}</p>
              <p><strong>Type:</strong> {{ selectedFile.type }}</p>
            </div>
          </div>

          <div class="wallet-encryption-info">
            <h4>🔐 Wallet-Based Encryption</h4>
            <p>Your document will be encrypted using your wallet signature. Only you will be able to decrypt it later.</p>
            <div class="encryption-benefits">
              <span>✅ No passwords to remember</span>
              <span>✅ Secure wallet-based verification</span>
              <span>✅ Only your wallet can decrypt</span>
            </div>
          </div>
        </div>

        <!-- Payment Method section removed for IPFS-only mode -->

        <!-- Upload Button -->
        <button
          type="submit"
          :disabled="uploading || !canProceedWithUpload"
          class="upload-btn"
        >
          {{ uploading ? 'Uploading...' : 'Upload Document' }}
        </button>
      </form>

      <!-- Progress -->
      <div v-if="uploading" class="upload-progress">
        <div class="progress-steps">
          <div class="step" :class="{ active: currentStep >= 1, completed: currentStep > 1 }">
            1. Encrypting file
          </div>
          <div class="step" :class="{ active: currentStep >= 2, completed: currentStep > 2 }">
            2. Uploading to IPFS
          </div>
          <!-- <div class="step" :class="{ active: currentStep >= 3, completed: currentStep > 3 }">
            3. Recording on blockchain
          </div> -->
        </div>
        <div v-if="uploadStatus" class="status-message">{{ uploadStatus }}</div>
      </div>

      <!-- Success/Error Messages -->
      <div v-if="uploadResult" class="upload-result">
        <div v-if="uploadResult.success" class="success">
          <h3>✅ Document Uploaded Successfully!</h3>
          <p><strong>IPFS Hash:</strong> {{ uploadResult.ipfsHash }}</p>
          <!-- <p><strong>Transaction Hash:</strong> {{ uploadResult.txHash }}</p>
          <p><strong>Version:</strong> {{ uploadResult.version }}</p> -->
          <a :href="getIPFSViewUrl(uploadResult.ipfsHash)" target="_blank" class="view-link">
            View on IPFS Gateway
          </a>
        </div>
        <div v-else class="error">
          <h3>❌ Upload Failed</h3>
          <p>{{ uploadResult.error }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { uploadToIPFS, ipfsToGatewayUrl } from '@/utils/ipfs'
import { uploadToIPFSSimple, ipfsToGatewayUrlSimple } from '@/utils/ipfs-simple'
import { encryptFileWithWallet, generateSalt, hashPatientId } from '@/utils/encryption'
import { ethers } from 'ethers'
// import MedicalVaultABI from '@/assets/MedicalVault.json' // Not needed for IPFS-only mode

// Props
interface Props {
  account: string
  contract: any
  isConnected: boolean
}

const props = defineProps<Props>()

// Reactive state
const mrn = ref('')
const salt = ref('')
const docType = ref('0')
const selectedFile = ref<File | null>(null)
// encryptionKey removed - using wallet-based encryption
const paymentMethod = ref('flr')
const xrplProofData = ref('')
const attestedUSDc = ref(500) // Default $5.00

const uploading = ref(false)
const currentStep = ref(0)
const uploadStatus = ref('')
const uploadResult = ref<any>(null)

// Removed blockchain-related state

// Computed properties
const canProceedWithUpload = computed(() => {
  return selectedFile.value && mrn.value && salt.value && props.isConnected
})

// Simplified - no permission checking for IPFS-only mode
// Upload is available to anyone with wallet connection


// Generate random salt
const generateNewSalt = () => {
  salt.value = generateSalt()
}

// Handle file selection
const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    selectedFile.value = target.files[0]
  }
}

// Format file size
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// Format ether amount - removed for IPFS-only mode
// const formatEther = (wei: string): string => {
//   return ethers.utils.formatEther(wei)
// }

// Get IPFS view URL
const getIPFSViewUrl = (hash: string): string => {
  try {
    return ipfsToGatewayUrl(hash)
  } catch {
    return ipfsToGatewayUrlSimple(hash)
  }
}

// Main upload function
const uploadDocument = async () => {
  if (!selectedFile.value) return

  uploading.value = true
  currentStep.value = 0
  uploadResult.value = null

  try {
    // Step 1: Get wallet signer
    currentStep.value = 1
    uploadStatus.value = 'Preparing wallet encryption...'

    if (!props.contract || !window.ethereum) {
      throw new Error('Wallet not connected properly')
    }

    const provider = new ethers.providers.Web3Provider(window.ethereum)
    const signer = provider.getSigner()
    const patientId = hashPatientId(mrn.value, salt.value)

    // Step 2: Encrypt file with wallet
    uploadStatus.value = 'Encrypting document with wallet signature...'

    const fileBuffer = await selectedFile.value.arrayBuffer()
    const { encryptedContent, metadata } = await encryptFileWithWallet(
      fileBuffer,
      signer,
      patientId,
      salt.value
    )

    // Step 3: Upload to IPFS
    currentStep.value = 2
    uploadStatus.value = 'Uploading to IPFS...'

    // Create encrypted file blob
    const encryptedBlob = new Blob([encryptedContent], { type: 'application/octet-stream' })
    const encryptedFile = new File([encryptedBlob], `encrypted_${selectedFile.value.name}`, {
      type: 'application/octet-stream'
    })

    let ipfsHash: string
    try {
      ipfsHash = await uploadToIPFS(encryptedFile)
    } catch (ipfsError) {
      console.warn('IPFS upload failed, using simple fallback:', ipfsError)
      ipfsHash = await uploadToIPFSSimple(encryptedFile)
    }

    // Success - IPFS only
    uploadResult.value = {
      success: true,
      ipfsHash,
      message: 'Document successfully uploaded to IPFS!'
    }

    uploadStatus.value = 'Upload complete!'

    // Store upload info locally for future reference
    const uploadInfo = {
      filename: selectedFile.value.name,
      ipfsHash,
      patientId,
      docType: docType.value,
      uploadDate: new Date().toISOString(),
      metadata, // Store wallet-based encryption metadata
      encryptionMethod: 'wallet-signature'
    }

    // Save to localStorage for simple tracking
    const existingUploads = JSON.parse(localStorage.getItem('medicalVaultUploads') || '[]')
    existingUploads.push(uploadInfo)
    localStorage.setItem('medicalVaultUploads', JSON.stringify(existingUploads))

    console.log('✅ Document uploaded to IPFS successfully!', uploadInfo)

    uploadStatus.value = 'Upload completed successfully!'

  } catch (error: any) {
    console.error('Upload error:', error)
    uploadResult.value = {
      success: false,
      error: error.message || 'Upload failed'
    }
    uploadStatus.value = 'Upload failed'
  } finally {
    uploading.value = false
  }
}

// Simplified - no permission checking needed for IPFS-only mode
</script>

<style scoped>
.document-upload {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
}

h2 {
  color: #2c3e50;
  text-align: center;
  margin-bottom: 2rem;
}

h3 {
  color: #34495e;
  border-bottom: 2px solid #3498db;
  padding-bottom: 0.5rem;
  margin-bottom: 1rem;
}

.permission-status {
  margin: 1.5rem 0;
  padding: 1rem;
  border-radius: 8px;
  border: 2px solid;
}

.permission-granted {
  background: #d4edda;
  border-color: #27ae60;
  color: #155724;
}

.permission-denied {
  background: #f8d7da;
  border-color: #e74c3c;
  color: #721c24;
}

.permission-status strong {
  display: block;
  font-size: 1.1rem;
  margin-bottom: 0.5rem;
}

.permission-status p {
  margin: 0.25rem 0;
  font-size: 0.9rem;
}

.upload-section {
  background: white;
  border-radius: 8px;
  padding: 2rem;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

.patient-section,
.file-section,
.payment-section {
  margin-bottom: 2rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid #eee;
}

.input-group {
  margin-bottom: 1rem;
}

label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: bold;
  color: #2c3e50;
}

input, select, textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
  box-sizing: border-box;
}

.generate-salt-btn {
  width: auto;
  margin-top: 0.5rem;
  background: #95a5a6;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
}

.generate-salt-btn:hover {
  background: #7f8c8d;
}

.file-info {
  background: #f8f9fa;
  padding: 1rem;
  border-radius: 4px;
  margin-top: 0.5rem;
}

.payment-options {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.radio-option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
}

.radio-option input[type="radio"] {
  width: auto;
}

.balance-info,
.xrpl-fields {
  background: #f8f9fa;
  padding: 1rem;
  border-radius: 4px;
  margin-top: 1rem;
}

.upload-btn {
  width: 100%;
  background: #27ae60;
  color: white;
  border: none;
  padding: 1rem;
  border-radius: 4px;
  font-size: 1.1rem;
  cursor: pointer;
  transition: background 0.3s;
}

.upload-btn:hover:not(:disabled) {
  background: #219a52;
}

.upload-btn:disabled {
  background: #bdc3c7;
  cursor: not-allowed;
}

.upload-progress {
  margin-top: 2rem;
  padding: 1.5rem;
  background: #f8f9fa;
  border-radius: 8px;
}

.progress-steps {
  display: flex;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.step {
  padding: 0.5rem 1rem;
  border-radius: 4px;
  background: #ecf0f1;
  color: #7f8c8d;
  flex: 1;
  text-align: center;
  margin: 0 0.25rem;
}

.step.active {
  background: #3498db;
  color: white;
}

.step.completed {
  background: #27ae60;
  color: white;
}

.status-message {
  text-align: center;
  font-style: italic;
  color: #3498db;
}

.upload-result {
  margin-top: 2rem;
  padding: 1.5rem;
  border-radius: 8px;
}

.success {
  background: #d5f4e6;
  border: 1px solid #27ae60;
  color: #155724;
}

.error {
  background: #ffebee;
  color: #c62828;
  padding: 1rem;
  border-radius: 4px;
  border-left: 4px solid #f44336;
}

.view-link {
  display: inline-block;
  background: #3498db;
  color: white;
  padding: 0.5rem 1rem;
  text-decoration: none;
  border-radius: 4px;
  margin-top: 1rem;
}

.view-link:hover {
  background: #2980b9;
}

small {
  color: #666;
  font-size: 0.9rem;
}

/* Wallet-based encryption info styles */
.wallet-encryption-info {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 1.5rem;
  border-radius: 8px;
  margin: 1rem 0;
}

.wallet-encryption-info h4 {
  margin: 0 0 0.5rem 0;
  font-size: 1.1rem;
}

.wallet-encryption-info p {
  margin: 0 0 1rem 0;
  opacity: 0.9;
}

.encryption-benefits {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.encryption-benefits span {
  background: rgba(255, 255, 255, 0.2);
  padding: 0.5rem;
  border-radius: 4px;
  font-size: 0.9rem;
}
</style>