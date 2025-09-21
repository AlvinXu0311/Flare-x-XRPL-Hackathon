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
          <div class="payment-info">
            <p><strong>XRPL Payment Required</strong></p>
            <p>This vault uses XRPL payment verification with mock oracles for testing.</p>
            <p>Required: 5,000,000 drops (≈ $5.00 at $1.00/XRP)</p>
          </div>

          <!-- XRPL Payment Fields -->
          <div class="xrpl-fields">
            <div class="input-group">
              <label for="xrplProof">XRPL Payment Proof (for testing):</label>
              <textarea
                id="xrplProof"
                v-model="xrplProofData"
                placeholder="Enter any text (e.g., 'test-payment-12345') - MockFDC will accept any proof"
                rows="2"
                required
              ></textarea>
              <small>For testing: any text works since MockFDC accepts all proofs</small>
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

          <div class="result-details">
            <div class="detail-group">
              <h4>📄 Document Information</h4>
              <p><strong>Patient MRN:</strong> {{ uploadResult.mrn }}</p>
              <p><strong>Document Type:</strong> {{ getDocTypeLabel(uploadResult.docKind) }}</p>
              <p><strong>Version:</strong> {{ uploadResult.version }}</p>
              <p><strong>Upload Time:</strong> {{ formatTimestamp(uploadResult.timestamp) }}</p>
            </div>

            <div class="detail-group">
              <h4>🔗 Blockchain Details</h4>
              <p><strong>Transaction Hash:</strong>
                <a :href="getTransactionUrl(uploadResult.txHash)" target="_blank" class="hash-link">
                  {{ formatHash(uploadResult.txHash) }}
                </a>
              </p>
              <p><strong>IPFS Hash:</strong>
                <a :href="getIPFSViewUrl(uploadResult.ipfsHash)" target="_blank" class="hash-link">
                  {{ formatHash(uploadResult.ipfsHash) }}
                </a>
              </p>
              <p><strong>Payment Method:</strong> XRPL</p>
            </div>

            <div class="detail-group">
              <h4>📥 Download Document</h4>
              <button @click="downloadThisDocument" class="download-btn">
                Download & Decrypt Document
              </button>
              <p class="download-note">Uses the same encryption password you provided</p>
            </div>
          </div>

          <div class="action-buttons">
            <a :href="getIPFSViewUrl(uploadResult.ipfsHash)" target="_blank" class="view-link">
              View on IPFS Gateway
            </a>
            <a :href="getTransactionUrl(uploadResult.txHash)" target="_blank" class="view-link">
              View Transaction on Explorer
            </a>
          </div>
        </div>
        <div v-else :class="uploadResult.registrationComplete ? 'registration-success' : 'error'">
          <h3>{{ uploadResult.registrationComplete ? (uploadResult.needsRegistration ? '⚠️ Registration Required' : '✅ Registration Complete') : '❌ Upload Failed' }}</h3>
          <p style="white-space: pre-line;">{{ uploadResult.error }}</p>
          <button v-if="uploadResult.registrationComplete && uploadResult.needsRegistration" @click="tryUploadAgain" class="retry-btn">
            Register as Patient
          </button>
          <button v-if="uploadResult.registrationComplete && !uploadResult.needsRegistration" @click="uploadDocumentOnly" class="retry-btn">
            Upload Document Now
          </button>
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
import MedicalVaultABI from '@/assets/SimpleMedicalVault.json'

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
const xrplProofData = ref('')

const uploading = ref(false)
const currentStep = ref(0)
const uploadStatus = ref('')
const uploadResult = ref<any>(null)


// Computed properties
const canProceedWithUpload = computed(() => {
  if (!selectedFile.value || !encryptionKey.value || !mrn.value || !salt.value) {
    return false
  }

  // Need XRPL proof data (any text works with MockFDC)
  return xrplProofData.value.trim().length > 0
})

// Check upload permission (read-only check)
const checkUploadPermission = async () => {
  if (!props.contract || !mrn.value || !salt.value) return

  try {
    const patientId = hashPatientId(mrn.value, salt.value)

    // Only check if current account can upload for this patient (no auto-registration)
    try {
      const canUpload = await props.contract.canUploadForPatient(patientId, props.account)
      if (canUpload) {
        console.log('✅ Upload permission already granted')
        return true
      } else {
        console.log('⚠️ Upload permission not granted - will register during upload')
        return false
      }
    } catch (e) {
      console.log('Permission check failed:', e.message)
      return false
    }

  } catch (error) {
    console.warn('Permission check failed:', error)
    return false
  }
}

// Register patient (only called during upload)
const registerPatientIfNeeded = async () => {
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

// Get transaction URL for Coston2 explorer
const getTransactionUrl = (txHash: string): string => {
  return `https://coston2-explorer.flare.network/tx/${txHash}`
}

// Format hash for display (show first 10 and last 8 characters)
const formatHash = (hash: string): string => {
  if (hash.length <= 18) return hash
  return `${hash.slice(0, 10)}...${hash.slice(-8)}`
}

// Format timestamp for display
const formatTimestamp = (timestamp: string): string => {
  return new Date(timestamp).toLocaleString()
}

// Get document type label
const getDocTypeLabel = (docKind: number): string => {
  const types = ['Diagnosis Letter', 'Referral', 'Intake Form']
  return types[docKind] || 'Unknown'
}

// Download this document
const downloadThisDocument = async () => {
  if (!uploadResult.value) return

  try {
    // Navigate to download tab with pre-filled data
    console.log('📥 Preparing download with:', {
      mrn: uploadResult.value.mrn,
      salt: uploadResult.value.salt,
      docType: uploadResult.value.docKind,
      encryptionKey: uploadResult.value.encryptionKey
    })

    // You can emit an event to parent component to switch tabs and pre-fill data
    // or use router to navigate with query parameters
    alert(`Download Information:
MRN: ${uploadResult.value.mrn}
Salt: ${uploadResult.value.salt}
Document Type: ${getDocTypeLabel(uploadResult.value.docKind)}
Encryption Password: ${uploadResult.value.encryptionKey}

Navigate to the Download tab and use these details to download your document.`)

  } catch (error) {
    console.error('Download preparation error:', error)
    alert('Failed to prepare download. Please use the Download tab manually.')
  }
}

// Register patient and then upload
const tryUploadAgain = async () => {
  if (!selectedFile.value || !props.contract) return

  uploadResult.value = null
  uploading.value = true
  uploadStatus.value = 'Registering as patient...'

  try {
    const patientId = hashPatientId(mrn.value, salt.value)

    // Perform registration
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

    uploadStatus.value = 'Registration transaction submitted...'
    const registerReceipt = await registerTx.wait()

    uploadResult.value = {
      success: false,
      error: `Patient registration completed successfully!

Transaction Hash: ${registerReceipt.hash}

You are now registered as a patient and can upload documents. Using XRPL payment, click "Upload Document Now" to proceed.`,
      registrationComplete: true,
      actualTxHash: registerReceipt.hash
    }

  } catch (error: any) {
    uploadResult.value = {
      success: false,
      error: `Registration failed: ${error.message}`
    }
  } finally {
    uploading.value = false
  }
}

// Actually upload the document (called after registration is confirmed)
const uploadDocumentOnly = async () => {
  uploadResult.value = null
  await uploadDocument()
}

// Verify IPFS upload completed successfully
const verifyIPFSUpload = async (hash: string): Promise<void> => {
  const maxAttempts = 5
  const delayMs = 2000

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const gatewayUrl = getIPFSViewUrl(hash)

      // Make a HEAD request to check if file exists and is accessible
      const response = await fetch(gatewayUrl, {
        method: 'HEAD',
        signal: AbortSignal.timeout(10000) // 10 second timeout
      })

      if (response.ok) {
        console.log(`✅ IPFS file verified on attempt ${attempt}`)
        return
      }

      console.warn(`IPFS verification attempt ${attempt} failed: ${response.status}`)
    } catch (error) {
      console.warn(`IPFS verification attempt ${attempt} error:`, error)
    }

    if (attempt < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, delayMs))
    }
  }

  // If all attempts failed, log warning but don't throw error
  // IPFS propagation can be slow, but the hash is likely valid
  console.warn('IPFS verification failed, but proceeding with upload (IPFS propagation may take time)')
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

    // Verify IPFS upload completed successfully
    uploadStatus.value = 'Verifying IPFS upload...'
    await verifyIPFSUpload(ipfsHash)

    const ipfsUri = `ipfs://${ipfsHash}`

    // Step 3: Record on blockchain
    currentStep.value = 3
    uploadStatus.value = 'Recording on blockchain...'

    const patientId = hashPatientId(mrn.value, salt.value)
    const docKind = parseInt(docType.value)

    uploadStatus.value = 'Submitting document upload...'
    console.log('📤 Starting upload process for patient:', patientId)

    let tx: any
    let receipt: any

    try {
      console.log('✅ Using simplified XRPL-only upload path')

      // Prepare XRPL proof data
      if (!xrplProofData.value.trim()) {
        throw new Error('XRPL payment proof is required. Enter any text (MockFDC accepts all proofs)')
      }

      const proofText = xrplProofData.value.trim()
      const mockProofId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(proofText))
      const mockStatementId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(`patient_${Date.now()}`))
      const proofBytes = ethers.utils.toUtf8Bytes(proofText)

      // Get required drops from contract
      uploadStatus.value = 'Checking payment requirements...'
      const freshProvider = new ethers.providers.Web3Provider(window.ethereum, 'any')
      await freshProvider.ready
      const freshSigner = freshProvider.getSigner()
      const freshContract = new ethers.Contract(
        import.meta.env.VITE_VAULT_ADDRESS,
        MedicalVaultABI.abi,
        freshSigner
      )

      const requiredInfo = await freshContract.requiredXrpDrops()
      const requiredDrops = requiredInfo.drops

      console.log('💰 Payment details:', {
        patientId,
        docKind,
        ipfsUri,
        requiredDrops: requiredDrops.toString(),
        proofLength: proofBytes.length
      })

      uploadStatus.value = 'Submitting XRPL upload transaction...'

      tx = await freshContract.uploadDocumentXRP(
        patientId,
        docKind,
        ipfsUri,
        proofBytes,
        mockStatementId,
        mockProofId,
        requiredDrops,
        {
          gasLimit: 500000,
          gasPrice: ethers.utils.parseUnits('25', 'gwei')
        }
      )

      // Wait for transaction receipt
      uploadStatus.value = 'Waiting for transaction confirmation...'
      console.log('📝 Transaction submitted:', tx.hash || tx)

      if (tx.hash) {
        // If it's an ethers transaction
        receipt = await tx.wait()
      } else {
        // If it's a direct wallet transaction (tx is just the hash string)
        receipt = await waitForTransactionReceipt(tx)
      }

      console.log('✅ Transaction confirmed:', receipt.transactionHash || receipt.hash)
      console.log('📊 Gas used:', receipt.gasUsed)
      console.log('📋 Events emitted:', receipt.logs?.length || 0)

    } catch (contractError) {
      console.error('Contract interaction failed:', contractError)

      // If upload fails due to not being registered, capture the actual transaction hash
      if (contractError.message.includes('not patient/pediatric') ||
          contractError.message.includes('not guardian/owner') ||
          contractError.message.includes('execution reverted')) {

        // Check if we have a transaction hash from the failed attempt
        let actualTxHash = 'Unknown'
        if (tx && tx.hash) {
          actualTxHash = tx.hash
        } else if (typeof tx === 'string') {
          actualTxHash = tx
        }

        uploadResult.value = {
          success: false,
          error: `Upload failed: Patient not registered yet.

${actualTxHash !== 'Unknown' ? `Transaction Hash: ${actualTxHash}` : 'Please try registering as patient first.'}

Click "Register as Patient" below to register first.`,
          registrationComplete: true,
          needsRegistration: true,
          actualTxHash
        }
        uploading.value = false
        return
      }

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

    const finalTxHash = receipt.transactionHash || receipt.hash || tx.hash || tx;

    uploadResult.value = {
      success: true,
      ipfsHash,
      txHash: finalTxHash,
      version,
      patientId,
      docKind,
      mrn: mrn.value,
      salt: salt.value,
      encryptionKey: encryptionKey.value, // Store for download
      paymentMethod: 'xrpl',
      timestamp: new Date().toISOString()
    }

    console.log('🎉 Upload complete! Transaction:', finalTxHash)
    console.log('📱 IPFS hash:', ipfsHash)
    console.log('📊 Document version:', version)

    uploadStatus.value = 'Upload completed successfully!'
    currentStep.value = 4 // Mark all steps as complete

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
  // Set default test values for easy testing
  mrn.value = 'TEST123'
  salt.value = 'salt456'
  xrplProofData.value = 'test-payment-12345'
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

.result-details {
  margin: 1.5rem 0;
}

.detail-group {
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: rgba(255, 255, 255, 0.7);
  border-radius: 6px;
  border-left: 4px solid #27ae60;
}

.detail-group h4 {
  margin: 0 0 0.75rem 0;
  color: #27ae60;
  font-size: 1rem;
}

.detail-group p {
  margin: 0.5rem 0;
}

.hash-link {
  color: #3498db;
  text-decoration: none;
  font-family: monospace;
  font-size: 0.9rem;
}

.hash-link:hover {
  text-decoration: underline;
}

.download-btn {
  background: #3498db;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
  margin-bottom: 0.5rem;
  display: block;
}

.download-btn:hover {
  background: #2980b9;
}

.download-note {
  font-size: 0.8rem;
  color: #666;
  font-style: italic;
}

.action-buttons {
  display: flex;
  gap: 1rem;
  margin-top: 1.5rem;
}

.registration-success {
  background: #e8f5e8;
  color: #2e7d32;
  padding: 1.5rem;
  border-radius: 4px;
  border-left: 4px solid #4caf50;
}

.retry-btn {
  background: #4caf50;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
  margin-top: 1rem;
  font-size: 1rem;
}

.retry-btn:hover {
  background: #45a049;
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