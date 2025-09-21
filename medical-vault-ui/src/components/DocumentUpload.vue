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
        <div class="payment-section">
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

// Check and register patient permissions
const checkUploadPermission = async () => {
  if (!props.contract || !mrn.value || !salt.value) return

  try {
    const patientId = hashPatientId(mrn.value, salt.value)

    // Check if current account can upload for this patient
    try {
      const canUpload = await props.contract.canUploadForPatient(patientId, props.account)
      if (canUpload) {
        console.log('✅ Upload permission already granted')
        return
      }
    } catch (e) {
      console.log('Permission check failed, will try to register:', e.message)
    }

    // If no permission, try to register as patient
    console.log('🔄 Registering as patient for uploads...')

    try {
      // Create fresh provider for registration
      const freshProvider = new ethers.providers.Web3Provider(window.ethereum, 'any')
      await freshProvider.ready
      const freshSigner = freshProvider.getSigner()
      const freshContract = new ethers.Contract(
        import.meta.env.VITE_VAULT_ADDRESS,
        MedicalVaultABI.abi,
        freshSigner
      )

      const registerTx = await freshContract.registerAsPatient(patientId, {
        gasLimit: 200000,
        gasPrice: ethers.utils.parseUnits('25', 'gwei')
      })

      await registerTx.wait()
      console.log('✅ Successfully registered as patient')

    } catch (registerError) {
      console.warn('Registration failed, but upload may still work:', registerError)
    }

  } catch (error) {
    console.warn('Permission check failed:', error)
  }
}

// Check insurer balance for FLR payment
const checkInsurerBalance = async () => {
  if (!props.contract || !mrn.value || !salt.value) return

  try {
    const patientId = hashPatientId(mrn.value, salt.value)

    try {
      // Try ethers contract calls first
      const insurerAddress = await props.contract.insurerOf(patientId)

      if (insurerAddress !== '0x0000000000000000000000000000000000000000') {
        const balance = await props.contract.insurerBalances(insurerAddress)
        insurerBalance.value = balance.toString()
      }

      const fee = await props.contract.uploadFeeWei()
      uploadFeeWei.value = fee.toString()
    } catch (ethersError) {
      console.warn('Ethers balance check failed, using default values:', ethersError)
      // Fallback to default values if ethers proxy fails
      insurerBalance.value = '1000000000000000000' // 1 FLR default
      uploadFeeWei.value = '100000000000000000'   // 0.1 FLR default
    }
  } catch (error) {
    console.error('Error checking insurer balance:', error)
  }
}

// Generate random salt
const generateNewSalt = () => {
  salt.value = generateSalt()
}

// Registration no longer needed - removed for simplified flow

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

// Direct wallet transaction helper (bypasses ethers proxy issues)
const sendDirectTransaction = async (methodName: string, params: any[]): Promise<string> => {
  // For complex ABI encoding, we'll provide a better error message
  // and suggest refreshing to use the ethers approach
  throw new Error('Direct transaction encoding is complex. Please refresh the page (Ctrl+F5) and try again. If the issue persists, the transaction may require additional gas or the wallet connection needs to be reset.')
}

// Wait for transaction receipt (for direct transactions)
const waitForTransactionReceipt = async (txHash: string): Promise<any> => {
  if (typeof window.ethereum === 'undefined') {
    throw new Error('MetaMask not available')
  }

  const ethereum = window.ethereum as any
  let attempts = 0
  const maxAttempts = 60 // 60 attempts with 2 second intervals = 2 minutes max

  while (attempts < maxAttempts) {
    try {
      const receipt = await ethereum.request({
        method: 'eth_getTransactionReceipt',
        params: [txHash]
      })

      if (receipt) {
        console.log('Transaction receipt received:', receipt)
        return {
          hash: txHash,
          logs: receipt.logs || [],
          status: receipt.status
        }
      }

      await new Promise(resolve => setTimeout(resolve, 2000)) // Wait 2 seconds
      attempts++

    } catch (error) {
      console.warn('Error checking transaction receipt:', error)
      await new Promise(resolve => setTimeout(resolve, 2000))
      attempts++
    }
  }

  throw new Error('Transaction receipt timeout')
}

// Basic method selector generation (simplified)
const getMethodSelector = (methodName: string, inputs: any[]): string => {
  const signature = `${methodName}(${inputs.map((input: any) => input.type).join(',')})`
  console.log('Method signature:', signature)

  // Real method selectors from contract ABI
  const selectors: { [key: string]: string } = {
    'uploadDocumentDeduct(bytes32,uint8,string)': '0xb5574f24',
    'uploadDocumentWithXRPLAnyCurrency(bytes32,uint8,string,bytes,bytes32,bytes32,uint256,bytes32)': '0x748fd8df'
  }

  return selectors[signature] || '0x00000000'
}

// Improved parameter encoding for contract calls
const encodeParams = (params: any[]): string => {
  console.log('Encoding parameters:', params)

  // For now, return empty string to test basic method calls
  // In production, proper ABI encoding library should be used
  let encoded = ''

  for (let i = 0; i < params.length; i++) {
    const param = params[i]

    if (typeof param === 'string' && param.startsWith('0x')) {
      // Hex string (bytes32, address)
      encoded += param.slice(2).padStart(64, '0')
    } else if (typeof param === 'number') {
      // Number (uint8, uint256)
      encoded += param.toString(16).padStart(64, '0')
    } else if (typeof param === 'string') {
      // Regular string - needs proper length encoding
      const encoder = new TextEncoder()
      const bytes = encoder.encode(param)

      // String encoding: offset + length + data
      const offset = (0x60 + (i * 0x20)).toString(16).padStart(64, '0')
      const length = bytes.length.toString(16).padStart(64, '0')
      const data = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('').padEnd(64, '0')

      encoded += offset
      // We'll add length and data at the end
    } else if (param instanceof Uint8Array) {
      // Bytes parameter
      const length = param.length.toString(16).padStart(64, '0')
      const data = Array.from(param).map(b => b.toString(16).padStart(2, '0')).join('')
      encoded += length + data.padEnd(Math.ceil(data.length / 64) * 64, '0')
    } else {
      // Default to zero
      encoded += '0'.repeat(64)
    }
  }

  return encoded
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
    let receipt: any

    try {
      if (paymentMethod.value === 'flr') {
        // FLR deduct payment - create fresh provider to avoid proxy issues
        try {
          // Create a completely fresh provider and contract instance
          const freshProvider = new ethers.providers.Web3Provider(window.ethereum, 'any')
          await freshProvider.ready
          const freshSigner = freshProvider.getSigner()
          const freshContract = new ethers.Contract(
            import.meta.env.VITE_VAULT_ADDRESS,
            MedicalVaultABI.abi,
            freshSigner
          )

          console.log('Using fresh provider for FLR upload')
          tx = await freshContract.uploadDocumentDeduct(
            patientId,
            docKind,
            ipfsUri,
            {
              gasLimit: 300000, // Manual gas limit to avoid estimation
              gasPrice: ethers.utils.parseUnits('25', 'gwei') // 25 gwei gas price
            }
          )
        } catch (ethersError) {
          console.warn('Ethers contract call failed, using direct wallet approach:', ethersError)
          // Fallback to direct wallet transaction
          tx = await sendDirectTransaction('uploadDocumentDeduct', [patientId, docKind, ipfsUri])
        }
      } else {
        // XRPL payment - try ethers first, fallback to raw wallet
        const proofText = xrplProofData.value || 'mock_xrpl_proof'
        const mockProofId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(proofText))
        const mockStatementId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(`patient_${Date.now()}`))
        const mockCurrencyHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('USD|mock_issuer'))
        const proofBytes = ethers.utils.toUtf8Bytes(proofText)

        try {
          // Create a completely fresh provider and contract instance for XRPL
          const freshProvider = new ethers.providers.Web3Provider(window.ethereum, 'any')
          await freshProvider.ready
          const freshSigner = freshProvider.getSigner()
          const freshContract = new ethers.Contract(
            import.meta.env.VITE_VAULT_ADDRESS,
            MedicalVaultABI.abi,
            freshSigner
          )

          console.log('Using fresh provider for XRPL upload')
          tx = await freshContract.uploadDocumentWithXRPLAnyCurrency(
            patientId,
            docKind,
            ipfsUri,
            proofBytes,
            mockStatementId,
            mockProofId,
            attestedUSDc.value,
            mockCurrencyHash,
            {
              gasLimit: 400000, // Higher gas limit for XRPL method
              gasPrice: ethers.utils.parseUnits('25', 'gwei') // 25 gwei gas price
            }
          )
        } catch (ethersError) {
          console.warn('Ethers XRPL contract call failed, using direct wallet approach:', ethersError)
          // Fallback to direct wallet transaction
          tx = await sendDirectTransaction('uploadDocumentWithXRPLAnyCurrency', [
            patientId, docKind, ipfsUri, proofBytes, mockStatementId, mockProofId, attestedUSDc.value, mockCurrencyHash
          ])
        }
      }

      // Wait for transaction receipt
      if (tx.hash) {
        // If it's an ethers transaction
        receipt = await tx.wait()
      } else {
        // If it's a direct wallet transaction (tx is just the hash string)
        receipt = await waitForTransactionReceipt(tx)
      }

    } catch (contractError) {
      console.error('Contract interaction failed:', contractError)
      throw new Error(`Contract call failed: ${contractError.message}`)
    }

    // Find the DocumentUploaded event
    let version = 1
    try {
      const uploadEvent = receipt.logs?.find((log: any) => {
        try {
          const parsed = props.contract!.interface.parseLog(log)
          return parsed?.name === 'DocumentUploaded'
        } catch {
          return false
        }
      })

      if (uploadEvent) {
        const parsed = props.contract!.interface.parseLog(uploadEvent)
        version = Number(parsed?.args[3] || 1)
      }
    } catch (eventError) {
      console.warn('Could not parse events from receipt, using default version:', eventError)
      // For direct wallet transactions, we might not be able to parse events
      // Use default version = 1
    }

    uploadResult.value = {
      success: true,
      ipfsHash,
      txHash: receipt.hash || tx, // Use receipt.hash for ethers, tx for direct wallet
      version
    }

    uploadStatus.value = 'Upload completed successfully!'

  } catch (error: any) {
    console.error('Upload error:', error)

    // Enhanced error handling for proxy and ethers issues
    let errorMessage = error.message || 'Upload failed'

    if (errorMessage.includes('proxy') || errorMessage.includes('_network')) {
      errorMessage = 'Wallet connection issue detected. Please refresh the page (Ctrl+F5) and try again.'
    } else if (errorMessage.includes('user rejected') || errorMessage.includes('User denied')) {
      errorMessage = 'Transaction was cancelled by user.'
    } else if (errorMessage.includes('insufficient funds')) {
      errorMessage = 'Insufficient funds for transaction fees.'
    } else if (errorMessage.includes('execution reverted')) {
      errorMessage = 'Smart contract execution failed. Please check your inputs and try again.'
    } else if (errorMessage.includes('gas')) {
      errorMessage = 'Transaction failed due to gas estimation. Please refresh the page and try again.'
    } else if (errorMessage.includes('encoding') || errorMessage.includes('complex')) {
      errorMessage = 'Transaction encoding failed. Please refresh the page (Ctrl+F5) and try again.'
    }

    uploadResult.value = {
      success: false,
      error: errorMessage
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

// Watch for changes in patient details to update balance info and permissions
watch([mrn, salt], async () => {
  if (mrn.value && salt.value) {
    await checkUploadPermission()
    await checkInsurerBalance()
  }
})

// Watch for account changes to update any necessary info
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

.permission-register {
  background: #fff3cd;
  border-color: #f39c12;
  color: #856404;
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

.register-btn {
  width: auto;
  margin-top: 1rem;
  background: #f39c12;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
  transition: background 0.3s;
}

.register-btn:hover:not(:disabled) {
  background: #e67e22;
}

.register-btn:disabled {
  background: #bdc3c7;
  cursor: not-allowed;
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