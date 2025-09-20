<template>
  <div class="patient-portal">
    <header class="portal-header">
      <router-link to="/" class="back-button">← Back to Home</router-link>
      <h1>Patient Portal</h1>
      <p>Tokenize your autism evaluation on Flare & XRPL blockchains</p>
    </header>

    <div class="portal-content">
      <!-- Address Setup Section -->
      <div class="address-setup" v-if="!addressConfigured && !uploadComplete">
        <div class="address-card">
          <h3>🔗 Blockchain Address Setup</h3>
          <p>Provide your Ethereum-compatible address for Flare tokenization. Your medical records will be tokenized as NFTs for secure ownership.</p>

          <div class="address-input">
            <label>Your Ethereum Address (for Flare Coston2):</label>
            <input
              v-model="patientAddress"
              type="text"
              placeholder="0x..."
              @input="validateAddress"
            >
            <div v-if="addressError" class="error-message">{{ addressError }}</div>
            <div v-if="addressValid" class="success-message">✅ Valid Ethereum address</div>
          </div>

          <div class="deployment-setup" v-if="addressValid && !contractDeployed">
            <h4>🚀 Smart Contract Deployment</h4>
            <p>To enable real NFT minting, we need to deploy the smart contract to Flare Coston2:</p>

            <div class="deployment-fields">
              <div class="field-group">
                <label>Deployment Wallet Private Key (for gas fees):</label>
                <input
                  v-model="deploymentPrivateKey"
                  type="password"
                  placeholder="0x..."
                  @input="validateDeploymentKey"
                >
                <div v-if="deploymentKeyError" class="error-message">{{ deploymentKeyError }}</div>
                <div v-if="deploymentKeyValid" class="success-message">✅ Valid private key format</div>
                <small>⚠️ This wallet needs Coston2 testnet FLR for gas fees. Get free testnet FLR from the <a href="https://coston2-faucet.towolabs.com/" target="_blank">Coston2 faucet</a>.</small>
              </div>

              <div class="deployment-actions">
                <button
                  @click="deployContract"
                  :disabled="!addressValid || !deploymentKeyValid || deploying"
                  class="deploy-button"
                >
                  <span v-if="deploying">🚀 Deploying Contract...</span>
                  <span v-else>🚀 Deploy Smart Contract</span>
                </button>
              </div>

              <div v-if="deploymentStatus" class="deployment-status">
                {{ deploymentStatus }}
              </div>
            </div>
          </div>

          <div class="address-info" v-if="!addressValid || contractDeployed">
            <h4>📋 What happens next:</h4>
            <ul>
              <li>📄 Your medical file is encrypted and stored on AWS S3</li>
              <li>🔗 An NFT is minted on Flare Coston2 with file metadata</li>
              <li>🎯 A companion NFT is created on XRPL for cross-chain compatibility</li>
              <li>💰 Hospitals pay $15 in XRP to access your evaluation</li>
              <li>🔒 You maintain full ownership and access control</li>
            </ul>
          </div>

          <button
            v-if="contractDeployed"
            @click="confirmAddress"
            :disabled="!addressValid"
            class="confirm-address-btn"
          >
            ✅ Confirm Address & Continue
          </button>
        </div>
      </div>

      <div class="upload-section" v-if="addressConfigured && !uploadComplete">
        <div class="address-summary">
          <h3>✅ Address Configured</h3>
          <div class="address-info-display">
            <div><strong>Flare Address:</strong> <code>{{ patientAddress }}</code></div>
            <div><strong>Network:</strong> Flare Coston2 (Testnet)</div>
            <div><strong>Tokenization:</strong> Medical records as NFTs on Flare & XRPL</div>
          </div>
          <button @click="changeAddress" class="change-address-btn">Change Address</button>
        </div>

        <div class="upload-card">
          <h2>Upload Evaluation File</h2>
          <p>Supported formats: ADOS, ADI-R evaluations (PDF, DOC, DOCX)</p>

          <div class="file-upload" @click="triggerFileInput" @drop="handleDrop" @dragover.prevent @dragleave.prevent>
            <input
              ref="fileInput"
              type="file"
              @change="handleFileSelect"
              accept=".pdf,.doc,.docx"
              style="display: none"
            >
            <div class="upload-placeholder" v-if="!selectedFile">
              <div class="upload-icon">📁</div>
              <p>Click to select file or drag and drop</p>
              <small>Maximum file size: 50MB</small>
            </div>
            <div class="file-preview" v-else>
              <div class="file-icon">📄</div>
              <div class="file-info">
                <h4>{{ selectedFile.name }}</h4>
                <p>{{ formatFileSize(selectedFile.size) }}</p>
              </div>
              <button @click.stop="removeFile" class="remove-file">×</button>
            </div>
          </div>

          <div class="patient-info">
            <h3>Patient Information</h3>
            <div class="form-row">
              <input v-model="patientInfo.firstName" placeholder="First Name" required>
              <input v-model="patientInfo.lastName" placeholder="Last Name" required>
            </div>
            <div class="form-row">
              <input v-model="patientInfo.dateOfBirth" type="date" placeholder="Date of Birth" required>
              <select v-model="patientInfo.evaluationType" required>
                <option value="">Select Evaluation Type</option>
                <option value="ADOS">ADOS</option>
                <option value="ADI-R">ADI-R</option>
                <option value="Both">Both ADOS and ADI-R</option>
              </select>
            </div>
            <textarea
              v-model="patientInfo.notes"
              placeholder="Additional notes (optional)"
              rows="3"
            ></textarea>
          </div>

          <button
            class="upload-button"
            @click="uploadFile"
            :disabled="!canUpload || uploading"
          >
            <span v-if="uploading">Tokenizing... {{ uploadProgress }}%</span>
            <span v-else>Upload & Tokenize Medical Record</span>
          </button>

          <div class="progress-bar" v-if="uploading">
            <div class="progress-fill" :style="{ width: uploadProgress + '%' }"></div>
          </div>
        </div>
      </div>

      <div class="success-section" v-else>
        <div class="success-card">
          <div class="success-icon">✅</div>
          <h2>Upload Successful!</h2>
          <p>Your evaluation has been securely uploaded and an NFT has been created.</p>

          <div class="upload-details">
            <div class="detail-item">
              <strong>NFT Token ID:</strong>
              <span class="token-id">{{ nftTokenId }}</span>
              <button @click="copyToClipboard(nftTokenId)" class="copy-button">Copy</button>
            </div>
            <div class="detail-item">
              <strong>File Hash:</strong>
              <span class="file-hash">{{ fileHash }}</span>
              <button @click="copyToClipboard(fileHash)" class="copy-button">Copy</button>
            </div>
            <div class="detail-item">
              <strong>Upload Date:</strong>
              <span>{{ uploadDate }}</span>
            </div>
          </div>

          <!-- Demo Mode Warning -->
          <div v-if="nftTokenId.startsWith('DEMO_FLARE')" class="demo-warning">
            <div class="warning-icon">⚠️</div>
            <h3>Demo Mode Active</h3>
            <p><strong>This NFT is not actually on the blockchain yet.</strong></p>
            <div class="warning-details">
              <p>To enable real NFT minting on Flare Coston2:</p>
              <ol>
                <li>Deploy the MedicalRecordToken smart contract</li>
                <li>Configure the contract address in backend settings</li>
                <li>Set up a Flare wallet with testnet funds</li>
              </ol>
              <p><small>Currently showing demo tokens that simulate the real tokenization process.</small></p>
            </div>
          </div>

          <div class="next-steps">
            <h3>What's Next?</h3>
            <ul>
              <li>Save your NFT Token ID - hospitals will need this to access your file</li>
              <li>Share the Token ID with authorized healthcare providers</li>
              <li>Your file is encrypted and stored securely on AWS S3</li>
              <li>Hospitals pay $15 to access your evaluation</li>
            </ul>
          </div>

          <div class="action-buttons">
            <button @click="uploadAnother" class="secondary-button">Upload Another File</button>
            <router-link to="/" class="primary-button">Return Home</router-link>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { fileService } from '../services/api.js'

// Address state
const addressConfigured = ref(false)
const patientAddress = ref('')
const addressValid = ref(false)
const addressError = ref('')

// Deployment state
const deploymentPrivateKey = ref('')
const deploymentKeyValid = ref(false)
const deploymentKeyError = ref('')
const contractDeployed = ref(false)
const deploying = ref(false)
const deploymentStatus = ref('')

// File upload state
const fileInput = ref(null)
const selectedFile = ref(null)
const uploading = ref(false)
const uploadProgress = ref(0)
const uploadComplete = ref(false)
const nftTokenId = ref('')
const fileHash = ref('')
const uploadDate = ref('')
const flareTokenId = ref('')
const xrplTokenId = ref('')

const patientInfo = ref({
  firstName: '',
  lastName: '',
  dateOfBirth: '',
  evaluationType: '',
  notes: ''
})

const canUpload = computed(() => {
  return addressConfigured.value &&
         selectedFile.value &&
         patientInfo.value.firstName &&
         patientInfo.value.lastName &&
         patientInfo.value.dateOfBirth &&
         patientInfo.value.evaluationType
})

// Address validation methods
const validateAddress = () => {
  addressError.value = ''
  addressValid.value = false

  if (!patientAddress.value) {
    return
  }

  // Basic Ethereum address validation
  if (!/^0x[a-fA-F0-9]{40}$/.test(patientAddress.value)) {
    addressError.value = 'Invalid Ethereum address format. Must start with 0x and be 42 characters long.'
    return
  }

  addressValid.value = true
}

const confirmAddress = () => {
  if (!addressValid.value) return

  addressConfigured.value = true

  // Save to localStorage for persistence
  localStorage.setItem('patientAddress', patientAddress.value)
}

const changeAddress = () => {
  addressConfigured.value = false
  localStorage.removeItem('patientAddress')
}

// Deployment validation methods
const validateDeploymentKey = () => {
  deploymentKeyError.value = ''
  deploymentKeyValid.value = false

  if (!deploymentPrivateKey.value) {
    return
  }

  // Basic private key validation (64 hex chars with or without 0x prefix)
  const cleanKey = deploymentPrivateKey.value.replace(/^0x/, '')
  if (!/^[a-fA-F0-9]{64}$/.test(cleanKey)) {
    deploymentKeyError.value = 'Invalid private key format. Must be 64 hexadecimal characters.'
    return
  }

  deploymentKeyValid.value = true
}

const deployContract = async () => {
  if (!addressValid.value || !deploymentKeyValid.value) return

  deploying.value = true
  deploymentStatus.value = 'Initializing contract deployment...'

  try {
    // Call backend to deploy the smart contract
    const response = await fetch('http://localhost:3000/api/blockchain/deploy-contract', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        deploymentPrivateKey: deploymentPrivateKey.value,
        patientAddress: patientAddress.value
      })
    })

    const result = await response.json()

    if (result.success) {
      deploymentStatus.value = `✅ Contract deployed successfully! Address: ${result.contractAddress}`
      contractDeployed.value = true

      // Clear the private key for security
      deploymentPrivateKey.value = ''

      // Save deployment info
      localStorage.setItem('contractDeployed', 'true')
      localStorage.setItem('contractAddress', result.contractAddress)
    } else {
      throw new Error(result.error || 'Deployment failed')
    }

  } catch (error) {
    console.error('Contract deployment failed:', error)
    deploymentStatus.value = `❌ Deployment failed: ${error.message}`
  } finally {
    deploying.value = false
  }
}

// Load address and deployment status from localStorage on component mount
const loadSavedAddress = () => {
  const saved = localStorage.getItem('patientAddress')
  if (saved) {
    patientAddress.value = saved
    validateAddress()
    if (addressValid.value) {
      addressConfigured.value = true
    }
  }

  // Load contract deployment status
  const deployed = localStorage.getItem('contractDeployed')
  if (deployed === 'true') {
    contractDeployed.value = true
    const contractAddress = localStorage.getItem('contractAddress')
    if (contractAddress) {
      deploymentStatus.value = `✅ Contract already deployed! Address: ${contractAddress}`
    }
  }
}

// Load saved address on mount
loadSavedAddress()

const triggerFileInput = () => {
  fileInput.value.click()
}

const handleFileSelect = (event) => {
  const file = event.target.files[0]
  if (file) {
    selectedFile.value = file
  }
}

const handleDrop = (event) => {
  event.preventDefault()
  const file = event.dataTransfer.files[0]
  if (file) {
    selectedFile.value = file
  }
}

const removeFile = () => {
  selectedFile.value = null
  fileInput.value.value = ''
}

const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const uploadFile = async () => {
  if (!canUpload.value) return

  uploading.value = true
  uploadProgress.value = 0

  try {
    uploadProgress.value = 20

    const formData = new FormData()
    formData.append('file', selectedFile.value)

    // Include patient info with address data
    const uploadData = {
      ...patientInfo.value,
      patientAddress: patientAddress.value
    }

    formData.append('patientInfo', JSON.stringify(uploadData))

    uploadProgress.value = 40

    // Upload file and tokenize in one call
    const response = await fileService.uploadFile(formData, (progressEvent) => {
      const fileProgress = Math.round((progressEvent.loaded * 60) / progressEvent.total)
      uploadProgress.value = 40 + fileProgress
    })

    uploadProgress.value = 90

    // Store the tokenization results from the file upload response
    if (response.data.success) {
      nftTokenId.value = response.data.nftTokenId
      fileHash.value = response.data.fileHash
      uploadDate.value = new Date().toLocaleDateString()

      // Extract Flare and XRPL token IDs if available
      if (response.data.blockchain?.flare?.tokenId) {
        flareTokenId.value = response.data.blockchain.flare.tokenId
      }
      if (response.data.blockchain?.xrpl?.nftTokenId) {
        xrplTokenId.value = response.data.blockchain.xrpl.nftTokenId
      }
    } else {
      throw new Error('Upload and tokenization failed')
    }

    uploadProgress.value = 100
    uploadComplete.value = true

  } catch (error) {
    console.error('Upload failed:', error)
    alert(`Upload failed: ${error.response?.data?.error || error.message}`)
  } finally {
    uploading.value = false
  }
}

const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text)
    alert('Copied to clipboard!')
  } catch (err) {
    console.error('Failed to copy:', err)
  }
}

const uploadAnother = () => {
  uploadComplete.value = false
  selectedFile.value = null
  fileInput.value.value = ''
  uploadProgress.value = 0
  nftTokenId.value = ''
  fileHash.value = ''
  patientInfo.value = {
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    evaluationType: '',
    notes: ''
  }
  // Keep wallet configuration when uploading another file
}
</script>

<style scoped>
.patient-portal {
  min-height: 100vh;
  background: linear-gradient(135deg, #74b9ff 0%, #0984e3 100%);
}

.portal-header {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  padding: 2rem;
  text-align: center;
  color: white;
}

.back-button {
  position: absolute;
  left: 2rem;
  top: 2rem;
  color: white;
  text-decoration: none;
  font-weight: 500;
}

.back-button:hover {
  text-decoration: underline;
}

.portal-header h1 {
  margin: 0 0 0.5rem 0;
  font-size: 2.5rem;
  font-weight: 700;
}

.portal-header p {
  margin: 0;
  opacity: 0.9;
}

.portal-content {
  padding: 2rem;
  max-width: 800px;
  margin: 0 auto;
}

.address-card {
  background: white;
  border-radius: 1rem;
  padding: 2rem;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
  margin-bottom: 2rem;
}

.address-card h3 {
  margin: 0 0 1rem 0;
  color: #2d3436;
  text-align: center;
}

.address-input {
  margin: 2rem 0;
}

.address-input label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 600;
  color: #2d3436;
}

.address-input input {
  width: 100%;
  padding: 1rem;
  border: 2px solid #ddd;
  border-radius: 0.5rem;
  font-size: 1rem;
  font-family: monospace;
  box-sizing: border-box;
}

.address-input input:focus {
  outline: none;
  border-color: #74b9ff;
}

.error-message {
  background: #ff7675;
  color: white;
  padding: 0.8rem;
  border-radius: 0.5rem;
  margin-top: 0.5rem;
  font-size: 0.9rem;
}

.success-message {
  background: #00b894;
  color: white;
  padding: 0.8rem;
  border-radius: 0.5rem;
  margin-top: 0.5rem;
  font-size: 0.9rem;
}

.address-info {
  background: #f8f9fa;
  padding: 1.5rem;
  border-radius: 0.5rem;
  margin: 1.5rem 0;
}

.address-info h4 {
  margin: 0 0 1rem 0;
  color: #2d3436;
}

.address-info ul {
  margin: 0;
  padding-left: 1.5rem;
  color: #636e72;
  line-height: 1.6;
}

.confirm-address-btn {
  background: #74b9ff;
  color: white;
  border: none;
  padding: 1rem 2rem;
  border-radius: 0.5rem;
  font-size: 1.1rem;
  font-weight: 600;
  cursor: pointer;
  width: 100%;
  transition: all 0.3s ease;
}

.confirm-address-btn:hover:not(:disabled) {
  background: #0984e3;
}

.confirm-address-btn:disabled {
  background: #ddd;
  cursor: not-allowed;
}

.address-summary {
  background: linear-gradient(135deg, #00b894 0%, #00a085 100%);
  color: white;
  border-radius: 1rem;
  padding: 1.5rem;
  margin-bottom: 2rem;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
}

.address-summary h3 {
  margin: 0 0 1rem 0;
  font-size: 1.2rem;
}

.address-info-display {
  background: rgba(255, 255, 255, 0.1);
  padding: 1rem;
  border-radius: 0.5rem;
  margin-bottom: 1rem;
}

.address-info-display div {
  margin: 0.5rem 0;
  font-size: 0.9rem;
}

.address-info-display code {
  background: rgba(255, 255, 255, 0.2);
  padding: 0.2rem 0.4rem;
  border-radius: 0.3rem;
  font-family: monospace;
  word-break: break-all;
}

.change-address-btn {
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.3);
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.3s ease;
}

.change-address-btn:hover {
  background: rgba(255, 255, 255, 0.3);
}

.upload-card, .success-card {
  background: white;
  border-radius: 1rem;
  padding: 2rem;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
}

.upload-card h2 {
  margin: 0 0 1rem 0;
  color: #2d3436;
}

.file-upload {
  border: 2px dashed #74b9ff;
  border-radius: 1rem;
  padding: 2rem;
  margin: 1rem 0;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
}

.file-upload:hover {
  border-color: #0984e3;
  background: rgba(116, 185, 255, 0.05);
}

.upload-placeholder {
  text-align: center;
  color: #636e72;
}

.upload-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.file-preview {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.file-icon {
  font-size: 2rem;
}

.file-info h4 {
  margin: 0;
  color: #2d3436;
}

.file-info p {
  margin: 0;
  color: #636e72;
  font-size: 0.9rem;
}

.remove-file {
  background: #ff7675;
  color: white;
  border: none;
  border-radius: 50%;
  width: 30px;
  height: 30px;
  cursor: pointer;
  margin-left: auto;
}

.patient-info {
  margin: 2rem 0;
}

.patient-info h3 {
  margin: 0 0 1rem 0;
  color: #2d3436;
}

.form-row {
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
}

.form-row input, .form-row select {
  flex: 1;
}

input, select, textarea {
  padding: 0.8rem;
  border: 1px solid #ddd;
  border-radius: 0.5rem;
  font-size: 1rem;
  width: 100%;
  box-sizing: border-box;
}

input:focus, select:focus, textarea:focus {
  outline: none;
  border-color: #74b9ff;
}

.upload-button {
  background: #74b9ff;
  color: white;
  border: none;
  padding: 1rem 2rem;
  border-radius: 0.5rem;
  font-size: 1.1rem;
  font-weight: 600;
  cursor: pointer;
  width: 100%;
  transition: all 0.3s ease;
}

.upload-button:hover:not(:disabled) {
  background: #0984e3;
}

.upload-button:disabled {
  background: #ddd;
  cursor: not-allowed;
}

.progress-bar {
  width: 100%;
  height: 4px;
  background: #eee;
  border-radius: 2px;
  margin-top: 1rem;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #74b9ff;
  transition: width 0.3s ease;
}

.success-card {
  text-align: center;
}

.success-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.success-card h2 {
  color: #00b894;
  margin-bottom: 1rem;
}

.upload-details {
  background: #f8f9fa;
  padding: 1.5rem;
  border-radius: 0.5rem;
  margin: 2rem 0;
  text-align: left;
}

.detail-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.detail-item:last-child {
  margin-bottom: 0;
}

.token-id, .file-hash {
  font-family: monospace;
  background: white;
  padding: 0.3rem 0.5rem;
  border-radius: 0.3rem;
  font-size: 0.9rem;
  word-break: break-all;
  flex: 1;
}

.copy-button {
  background: #74b9ff;
  color: white;
  border: none;
  padding: 0.3rem 0.8rem;
  border-radius: 0.3rem;
  cursor: pointer;
  font-size: 0.8rem;
}

.next-steps {
  text-align: left;
  margin: 2rem 0;
}

.next-steps h3 {
  color: #2d3436;
  margin-bottom: 1rem;
}

.next-steps ul {
  color: #636e72;
  line-height: 1.6;
}

.action-buttons {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
}

.primary-button, .secondary-button {
  padding: 0.8rem 1.5rem;
  border-radius: 0.5rem;
  text-decoration: none;
  font-weight: 600;
  cursor: pointer;
  border: none;
  font-size: 1rem;
}

.primary-button {
  background: #74b9ff;
  color: white;
}

.secondary-button {
  background: #ddd;
  color: #2d3436;
}

.deployment-setup {
  background: linear-gradient(135deg, #e3f2fd, #bbdefb);
  border: 2px solid #2196f3;
  border-radius: 1rem;
  padding: 1.5rem;
  margin: 1.5rem 0;
}

.deployment-setup h4 {
  margin: 0 0 1rem 0;
  color: #1976d2;
  font-size: 1.2rem;
}

.deployment-setup p {
  margin: 0 0 1.5rem 0;
  color: #424242;
}


.field-group {
  margin-bottom: 1.5rem;
}

.field-group label {
  display: block;
  margin-bottom: 0.5rem;
  color: #424242;
  font-weight: 600;
}

.field-group input {
  width: 100%;
  padding: 0.9rem;
  border: 1px solid #ddd;
  border-radius: 0.5rem;
  font-size: 1rem;
  font-family: monospace;
  background: white;
  transition: border-color 0.3s ease;
}

.field-group input:focus {
  outline: none;
  border-color: #2196f3;
  box-shadow: 0 0 0 3px rgba(33, 150, 243, 0.1);
}

.field-group small {
  display: block;
  margin-top: 0.5rem;
  color: #666;
  font-size: 0.85rem;
}

.field-group small a {
  color: #2196f3;
  text-decoration: none;
}

.field-group small a:hover {
  text-decoration: underline;
}

.deploy-button {
  background: #2196f3;
  color: white;
  border: none;
  padding: 1rem 2rem;
  border-radius: 0.5rem;
  font-size: 1.1rem;
  font-weight: 600;
  cursor: pointer;
  width: 100%;
  transition: all 0.3s ease;
}

.deploy-button:hover:not(:disabled) {
  background: #1976d2;
  transform: translateY(-1px);
}

.deploy-button:disabled {
  background: #ddd;
  cursor: not-allowed;
  transform: none;
}

.deployment-status {
  background: rgba(33, 150, 243, 0.1);
  border: 1px solid rgba(33, 150, 243, 0.3);
  border-radius: 0.5rem;
  padding: 1rem;
  margin-top: 1rem;
  font-family: monospace;
  font-size: 0.9rem;
  color: #1976d2;
}

@media (max-width: 768px) {
  .portal-header {
    padding: 1rem;
  }

  .back-button {
    position: static;
    display: block;
    margin-bottom: 1rem;
  }

  .form-row {
    flex-direction: column;
  }

  .detail-item {
    flex-direction: column;
    align-items: flex-start;
  }

  .action-buttons {
    flex-direction: column;
  }
}

.demo-warning {
  background: linear-gradient(135deg, #fff4e6, #ffeaa7);
  border: 2px solid #fdcb6e;
  border-radius: 1rem;
  padding: 1.5rem;
  margin: 2rem 0;
  text-align: center;
}

.warning-icon {
  font-size: 2rem;
  margin-bottom: 0.5rem;
}

.demo-warning h3 {
  margin: 0 0 1rem 0;
  color: #e17055;
  font-size: 1.3rem;
}

.demo-warning p {
  margin: 0.5rem 0;
  color: #2d3436;
}

.warning-details {
  background: rgba(253, 203, 110, 0.2);
  border-radius: 0.5rem;
  padding: 1rem;
  margin-top: 1rem;
  text-align: left;
}

.warning-details ol {
  margin: 0.5rem 0;
  padding-left: 1.5rem;
}

.warning-details li {
  margin: 0.3rem 0;
  color: #636e72;
}

.warning-details small {
  color: #636e72;
  font-style: italic;
}
</style>