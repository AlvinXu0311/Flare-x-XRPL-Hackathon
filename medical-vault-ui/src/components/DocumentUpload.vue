<template>
  <div class="document-upload">
    <h2>Upload Medical Document</h2>

    <!-- Role Check -->
    <div v-if="!canUpload" class="error">
      <p>❌ You don't have permission to upload documents. Only the pediatric psychologist or contract owner can upload.</p>
      <p>Current account: {{ account }}</p>
    </div>

    <!-- Upload Form -->
    <div v-else class="upload-section">
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
          <div v-if="canUpload" class="permission-granted">
            ✅ <strong>Upload Permission Granted</strong>
            <p>You can upload documents for this patient.</p>
          </div>
          <div v-else class="permission-denied">
            ❌ <strong>Upload Permission Required</strong>
            <p>You need to be set as the pediatric psychologist for this patient.</p>
            <p>Go to <strong>Admin Setup</strong> tab to configure patient roles first.</p>
          </div>
        </div>

        <!-- File Upload -->
        <div v-if="canUpload" class="file-section">
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

          <div class="input-group">
            <label for="encryptionKey">Encryption Password:</label>
            <input
              id="encryptionKey"
              v-model="encryptionKey"
              type="password"
              placeholder="Enter password to encrypt the document"
              required
            />
            <small>This password will be used to encrypt the document for security.</small>
          </div>
        </div>

        <!-- Payment Method -->
        <div v-if="canUpload" class="payment-section">
          <h3>Payment Method</h3>
          <div class="payment-options">
            <label class="radio-option">
              <input
                type="radio"
                value="flr"
                v-model="paymentMethod"
                @change="checkInsurerBalance"
              />
              <span>FLR Deduct (from insurer balance)</span>
            </label>
            <label class="radio-option">
              <input
                type="radio"
                value="xrpl"
                v-model="paymentMethod"
              />
              <span>XRPL Payment (with proof)</span>
            </label>
          </div>

          <!-- FLR Balance Info -->
          <div v-if="paymentMethod === 'flr' && insurerBalance !== null" class="balance-info">
            <p><strong>Insurer Balance:</strong> {{ formatEther(insurerBalance) }} FLR</p>
            <p><strong>Upload Fee:</strong> {{ formatEther(uploadFeeWei) }} FLR</p>
            <p v-if="Number(insurerBalance) < Number(uploadFeeWei)" class="error">
              ⚠️ Insufficient balance! Please deposit more FLR first.
            </p>
          </div>

          <!-- XRPL Payment Fields -->
          <div v-if="paymentMethod === 'xrpl'" class="xrpl-fields">
            <div class="input-group">
              <label for="xrplProof">XRPL Payment Proof:</label>
              <textarea
                id="xrplProof"
                v-model="xrplProofData"
                placeholder="Enter XRPL payment proof data"
                rows="3"
                required
              ></textarea>
            </div>
            <div class="input-group">
              <label for="attestedUSD">Attested USD Amount (cents):</label>
              <input
                id="attestedUSD"
                v-model="attestedUSDc"
                type="number"
                placeholder="500"
                min="1"
                required
              />
              <small>Amount in USD cents (e.g., 500 = $5.00)</small>
            </div>
          </div>
        </div>

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
          <div class="step" :class="{ active: currentStep >= 3, completed: currentStep > 3 }">
            3. Recording on blockchain
          </div>
        </div>
        <div v-if="uploadStatus" class="status-message">{{ uploadStatus }}</div>
      </div>

      <!-- Success/Error Messages -->
      <div v-if="uploadResult" class="upload-result">
        <div v-if="uploadResult.success" class="success">
          <h3>✅ Document Uploaded Successfully!</h3>
          <p><strong>IPFS Hash:</strong> {{ uploadResult.ipfsHash }}</p>
          <p><strong>Transaction Hash:</strong> {{ uploadResult.txHash }}</p>
          <p><strong>Version:</strong> {{ uploadResult.version }}</p>
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
import { ref, computed, onMounted, watch } from 'vue'
import { ethers } from 'ethers'
import { uploadToIPFS, ipfsToGatewayUrl } from '@/utils/ipfs'
import { uploadToIPFSSimple, ipfsToGatewayUrlSimple } from '@/utils/ipfs-simple'
import { encryptFile, generateSalt, hashPatientId } from '@/utils/encryption'
import MedicalVaultABI from '@/assets/MedicalVault.json'

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
const encryptionKey = ref('')
const paymentMethod = ref('flr')
const xrplProofData = ref('')
const attestedUSDc = ref(500) // Default $5.00

const uploading = ref(false)
const currentStep = ref(0)
const uploadStatus = ref('')
const uploadResult = ref<any>(null)

const canUpload = ref(false)
const insurerBalance = ref<string | null>(null)
const uploadFeeWei = ref<string>('0')

// Computed properties
const canProceedWithUpload = computed(() => {
  if (!selectedFile.value || !encryptionKey.value || !mrn.value || !salt.value) {
    return false
  }

  if (paymentMethod.value === 'flr') {
    return insurerBalance.value !== null &&
           Number(insurerBalance.value) >= Number(uploadFeeWei.value)
  }

  if (paymentMethod.value === 'xrpl') {
    return xrplProofData.value.trim() !== '' && attestedUSDc.value >= 500
  }

  return false
})

// Check if current user can upload
const checkUploadPermission = async () => {
  if (!props.contract || !props.account) return

  try {
    console.log('Checking upload permission for account:', props.account)

    // Method 1: Try to get contract owner (with fallback for provider errors)
    let owner
    try {
      owner = await props.contract.owner()
      console.log('Contract owner:', owner)
    } catch (providerError) {
      console.warn('Provider error getting owner, using fallback:', providerError)
      // Fallback: assume user needs specific patient permission
      canUpload.value = false
      return
    }

    // Check if user is contract owner
    if (owner && owner.toLowerCase() === props.account.toLowerCase()) {
      console.log('User is contract owner - upload allowed')
      canUpload.value = true
      return
    }

    // Check if user has patient-specific permissions
    if (mrn.value && salt.value) {
      try {
        const patientId = hashPatientId(mrn.value, salt.value)
        console.log('Checking patient-specific permissions for ID:', patientId)

        const roles = await props.contract.getRoles(patientId)
        const pediatricPsychologist = roles[1] // [guardian, psychologist, insurer]

        console.log('Pediatric psychologist for this patient:', pediatricPsychologist)

        if (pediatricPsychologist && pediatricPsychologist.toLowerCase() === props.account.toLowerCase()) {
          console.log('User is pediatric psychologist for this patient - upload allowed')
          canUpload.value = true
          return
        }
      } catch (roleError) {
        console.warn('Error checking patient roles:', roleError)
      }
    }

    // Default: no permission
    console.log('User does not have upload permission')
    canUpload.value = false

  } catch (error) {
    console.error('Error checking upload permission:', error)
    canUpload.value = false
  }
}

// Check insurer balance for FLR payment
const checkInsurerBalance = async () => {
  if (!props.contract || !mrn.value || !salt.value) return

  try {
    const patientId = hashPatientId(mrn.value, salt.value)
    const insurerAddress = await props.contract.insurerOf(patientId)

    if (insurerAddress !== ethers.constants.AddressZero) {
      const balance = await props.contract.insurerBalances(insurerAddress)
      insurerBalance.value = balance.toString()
    }

    const fee = await props.contract.uploadFeeWei()
    uploadFeeWei.value = fee.toString()
  } catch (error) {
    console.error('Error checking insurer balance:', error)
  }
}

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

// Format ether amount
const formatEther = (wei: string): string => {
  return ethers.utils.formatEther(wei)
}

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
  if (!selectedFile.value || !props.contract) return

  uploading.value = true
  currentStep.value = 0
  uploadResult.value = null

  try {
    // Step 1: Encrypt file
    currentStep.value = 1
    uploadStatus.value = 'Encrypting document...'

    const fileBuffer = await selectedFile.value.arrayBuffer()
    const encryptedContent = encryptFile(fileBuffer, encryptionKey.value, salt.value)

    // Step 2: Upload to IPFS
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
    const ipfsUri = `ipfs://${ipfsHash}`

    // Step 3: Record on blockchain
    currentStep.value = 3
    uploadStatus.value = 'Recording on blockchain...'

    const patientId = hashPatientId(mrn.value, salt.value)
    const docKind = parseInt(docType.value)

    let tx: any

    if (paymentMethod.value === 'flr') {
      // FLR deduct payment
      tx = await props.contract.uploadDocumentDeduct(
        patientId,
        docKind,
        ipfsUri
      )
    } else {
      // XRPL payment (simplified - in real app you'd have proper proof)
      const mockProofId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(xrplProofData.value))
      const mockStatementId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(`${patientId}_${Date.now()}`))
      const mockCurrencyHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('USD|mock'))

      tx = await props.contract.uploadDocumentWithXRPLAnyCurrency(
        patientId,
        docKind,
        ipfsUri,
        ethers.utils.toUtf8Bytes(xrplProofData.value),
        mockStatementId,
        mockProofId,
        attestedUSDc.value,
        mockCurrencyHash
      )
    }

    const receipt = await tx.wait()

    // Find the DocumentUploaded event
    const uploadEvent = receipt.logs.find((log: any) => {
      try {
        const parsed = props.contract!.interface.parseLog(log)
        return parsed?.name === 'DocumentUploaded'
      } catch {
        return false
      }
    })

    let version = 1
    if (uploadEvent) {
      const parsed = props.contract!.interface.parseLog(uploadEvent)
      version = Number(parsed?.args[3] || 1)
    }

    uploadResult.value = {
      success: true,
      ipfsHash,
      txHash: receipt.hash,
      version
    }

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

// Initialize component
onMounted(async () => {
  await checkUploadPermission()
  if (mrn.value && salt.value) {
    await checkInsurerBalance()
  }
})

// Watch for changes in patient details to re-check permissions
watch([mrn, salt], async () => {
  if (mrn.value && salt.value) {
    await checkUploadPermission()
    await checkInsurerBalance()
  } else {
    canUpload.value = false
  }
})

// Watch for account changes to re-check permissions
watch(() => props.account, async () => {
  if (props.account) {
    await checkUploadPermission()
  }
})
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
</style>