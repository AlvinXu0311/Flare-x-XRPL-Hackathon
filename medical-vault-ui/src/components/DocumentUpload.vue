<template>
  <div class="document-upload">
    <h2>Upload Medical Document</h2>

    <!-- Smart Account Toggle -->
    <div class="smart-account-section">
      <div class="account-toggle">
        <label class="toggle-label">
          <input
            type="checkbox"
            v-model="useSmartAccount"
            @change="onSmartAccountToggle"
          />
          <span class="toggle-text">💎 Enable XRP Payments + Medical Memos</span>
        </label>
      </div>

      <!-- XRP Integration Status -->
      <div v-if="useSmartAccount && smartAccountStatus" class="xrp-wallet-info">
        <div class="wallet-header">
          <h4>🏦 XRPL Wallet Integration</h4>
          <div v-if="smartAccountStatus.xrplAddress" class="wallet-address">
            <span class="label">Your XRPL Address:</span>
            <span class="address">{{ smartAccountStatus.xrplAddress }}</span>
            <button @click="copyToClipboard(smartAccountStatus.xrplAddress)" class="copy-btn">📋</button>
            <a v-if="smartAccountStatus.xrplAddress" :href="getXrplAccountUrl(smartAccountStatus.xrplAddress)" target="_blank" class="view-link xrpl-link">
              🔍 View on XRPL Explorer
            </a>
          </div>
        </div>

        <div class="account-status">
          <div class="status-item">
            <span class="status-label">Flare Balance:</span>
            <span class="status-value">{{ smartAccountStatus.flareBalance || '0.0' }} FLR</span>
          </div>
          <div class="status-item">
            <span class="status-label">XRP Balance:</span>
            <span class="status-value">{{ smartAccountStatus.xrpBalance || '0.0' }} XRP</span>
          </div>
          <div class="status-item">
            <span class="status-label">Account Status:</span>
            <span class="status-value" :class="smartAccountStatus.isLinked ? 'linked' : 'unlinked'">
              {{ smartAccountStatus.isLinked ? 'Connected' : 'Not Connected' }}
            </span>
          </div>
        </div>
      </div>
    </div>

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

        <!-- Document Upload Type -->
        <div class="upload-type-section">
          <h3>Document Type</h3>
          <div class="upload-options">
            <label class="radio-option">
              <input type="radio" v-model="uploadType" value="file" />
              📄 Upload File
            </label>
            <label class="radio-option">
              <input type="radio" v-model="uploadType" value="text" />
              📝 Enter Text
            </label>
          </div>
        </div>

        <!-- File Upload -->
        <div v-if="uploadType === 'file'" class="file-section">
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

          <div class="mapping-info">
            <h4>🔗 Blockchain + Local Mapping</h4>
            <p>Hash will be <strong>minted on Flare blockchain</strong>, file stored locally encrypted.</p>
            <p><small>Transaction hash maps to your local encrypted file for download.</small></p>
          </div>
        </div>

        <!-- Text Content -->
        <div v-else-if="uploadType === 'text'" class="content-section">
          <h3>Document Content</h3>
          <div class="input-group">
            <label for="content">Document Text:</label>
            <textarea
              id="content"
              v-model="documentContent"
              placeholder="Enter the document content as plain text"
              rows="10"
              required
            ></textarea>
            <small>Enter the medical document content as plain text. This will be encrypted and its hash stored on blockchain.</small>
          </div>

          <div class="hash-info">
            <h4>🔗 Text Hash Storage</h4>
            <p>Your text will be encrypted locally and its hash stored on the blockchain.</p>
            <div class="storage-benefits">
              <span>✅ Local text encryption</span>
              <span>✅ Hash verification on blockchain</span>
              <span>✅ Tamper-proof content</span>
            </div>
          </div>

          <div class="mapping-info">
            <h4>🔗 Blockchain + Local Mapping</h4>
            <p>Hash will be <strong>minted on Flare blockchain</strong>, file stored locally encrypted.</p>
            <p><small>Transaction hash maps to your local encrypted file for download.</small></p>
          </div>
        </div>

        <!-- Upload Button -->
        <button
          type="submit"
          :disabled="uploading || !canProceedWithUpload"
          class="upload-btn"
        >
          {{ uploading ? 'Processing...' : (uploadType === 'file' ? 'Mint File Hash on Blockchain' : 'Mint Text Hash on Blockchain') }}
        </button>
      </form>

      <!-- Progress -->
      <div v-if="uploading" class="upload-progress">
        <div class="progress-steps">
          <div class="step" :class="{ active: currentStep >= 1, completed: currentStep > 1 }">
            1. Preparing encryption
          </div>
          <div class="step" :class="{ active: currentStep >= 2, completed: currentStep > 2 }">
            2. Generating hash
          </div>
          <div class="step" :class="{ active: currentStep >= 3, completed: currentStep > 3 }">
            3. Creating content URI
          </div>
          <div class="step" :class="{ active: currentStep >= 4, completed: currentStep > 4 }">
            4. Minting on blockchain
          </div>
        </div>
        <div v-if="uploadStatus" class="status-message">{{ uploadStatus }}</div>
      </div>

      <!-- Success/Error Messages -->
      <div v-if="uploadResult" class="upload-result">
        <div v-if="uploadResult.success" class="success">
          <h3>✅ Document Hash Minted on Blockchain!</h3>

          <div class="result-section">
            <h4>⛓️ Blockchain Transaction</h4>
            <div class="info-grid">
              <div class="info-item">
                <span class="label">Transaction Hash:</span>
                <span class="value hash-display">{{ uploadResult.txHash }}</span>
                <button @click="copyToClipboard(uploadResult.txHash)" class="copy-btn">📋</button>
              </div>

              <div class="info-item">
                <span class="label">Block Number:</span>
                <span class="value">{{ uploadResult.blockNumber }}</span>
              </div>

              <div class="info-item">
                <span class="label">Document Version:</span>
                <span class="value">{{ uploadResult.version }}</span>
              </div>

              <div class="info-item">
                <span class="label">Gas Used:</span>
                <span class="value">{{ uploadResult.gasUsed }}</span>
              </div>
            </div>
          </div>

          <div class="result-section">
            <h4>📄 Document Information</h4>
            <div class="info-grid">
              <div class="info-item">
                <span class="label">Content Hash (SHA-256):</span>
                <span class="value hash-value">{{ uploadResult.contentHash }}</span>
                <button @click="copyToClipboard(uploadResult.contentHash)" class="copy-btn">📋</button>
              </div>

              <div class="info-item">
                <span class="label">Patient ID:</span>
                <span class="value">{{ uploadResult.patientId }}</span>
                <button @click="copyToClipboard(uploadResult.patientId)" class="copy-btn">📋</button>
              </div>

              <div class="info-item">
                <span class="label">Document Type:</span>
                <span class="value">{{ getDocTypeName(uploadResult.docType) }}</span>
              </div>

              <div class="info-item">
                <span class="label">Upload Timestamp:</span>
                <span class="value">{{ formatTimestamp(uploadResult.timestamp) }}</span>
              </div>
            </div>
          </div>

          <div class="result-section">
            <h4>🔍 Verification Links</h4>
            <div class="link-buttons">
              <a :href="getBlockchainViewUrl(uploadResult.txHash)" target="_blank" class="view-link">
                🌐 View Transaction on Flare Explorer
              </a>
              <a :href="getContractViewUrl()" target="_blank" class="view-link">
                📄 View Contract on Flare Explorer
              </a>
              <button @click="verifyDocumentHash" class="verify-btn">
                ✅ Verify Document Hash
              </button>
            </div>

            <!-- XRP Transaction Links -->
            <div v-if="useSmartAccount && uploadResult.xrpPayment" class="xrp-links">
              <h5>🔗 XRP Transaction Links</h5>
              <div class="link-buttons">
                <a :href="getXrpExplorerUrl(uploadResult.xrpPayment.transactionHash)" target="_blank" class="view-link xrp-link">
                  💎 View XRP Transaction
                </a>
                <button @click="showXrpMemo" class="memo-btn">
                  📝 View XRP Memo
                </button>
              </div>
            </div>

            <!-- Smart Contract Events Triggered -->
            <div v-if="useSmartAccount && uploadResult.smartContractEvents" class="contract-events">
              <h5>📋 Smart Contract Events Triggered</h5>
              <div class="event-list">
                <div
                  v-for="event in uploadResult.smartContractEvents"
                  :key="event.name"
                  class="event-item"
                >
                  <div class="event-header">
                    <span class="event-name">{{ event.name }}</span>
                    <a :href="getEventExplorerUrl(event.txHash, event.logIndex)" target="_blank" class="event-link">
                      🔍 View Event
                    </a>
                  </div>
                  <div class="event-details">
                    <div class="event-params">
                      <div v-for="(value, key) in event.args" :key="key" class="param-item">
                        <span class="param-key">{{ key }}:</span>
                        <span class="param-value">{{ formatEventValue(value) }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="result-section">
            <h4>📊 Event Details</h4>
            <div class="event-info">
              <p><strong>Event:</strong> DocumentUploaded</p>
              <p><strong>Contract Address:</strong> {{ getContractAddress() }}</p>
              <p><strong>Network:</strong> Flare Coston2 Testnet</p>
              <p><strong>Chain ID:</strong> 114</p>
            </div>
          </div>
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
import { ref, computed, onMounted } from 'vue'
import { encryptTextWithWallet, encryptFileWithWallet, generateSalt, hashPatientId, generateFileHash, generateTextHash, createContentURI } from '@/utils/encryption'
import { storeEncryptedFile } from '@/utils/local-storage'
import { mappingService } from '@/utils/mapping-service'
import { ethers } from 'ethers'
import { getFlareProvider } from '@/utils/robust-web3-provider'
import UploadHelper from '@/utils/upload-helper'
import MedicalVaultABI from '@/assets/MedicalVault.json'
import { flareXrpSmartAccountService } from '@/utils/flare-xrp-smart-account'
import { xrplPaymentService } from '@/utils/xrpl-payment-service'

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
const uploadType = ref('file') // 'file' or 'text'
const documentContent = ref('')
const selectedFile = ref<File | null>(null)

const uploading = ref(false)
const currentStep = ref(0)
const uploadStatus = ref('')

// Smart Account state
const useSmartAccount = ref(false)
const smartAccountStatus = ref<any>(null)
const uploadResult = ref<any>(null)

// Removed blockchain-related state

// Computed properties
const canProceedWithUpload = computed(() => {
  const hasContent = uploadType.value === 'file' ? selectedFile.value : documentContent.value
  return hasContent && mrn.value && salt.value && props.isConnected
})

// Simplified - no permission checking for IPFS-only mode
// Upload is available to anyone with wallet connection


// Generate random salt
const generateNewSalt = () => {
  salt.value = generateSalt()
}

// Smart Account functions
const onSmartAccountToggle = async () => {
  if (useSmartAccount.value) {
    try {
      await updateSmartAccountStatus()
    } catch (error) {
      console.error('Failed to initialize smart account:', error)
      useSmartAccount.value = false
    }
  }
}

const updateSmartAccountStatus = async () => {
  try {
    smartAccountStatus.value = await flareXrpSmartAccountService.getAccountStatus()
  } catch (error) {
    console.error('Failed to get smart account status:', error)
  }
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

// Get blockchain explorer URL
const getBlockchainViewUrl = (txHash: string): string => {
  return `https://coston2-explorer.flare.network/tx/${txHash}`
}

// Get contract explorer URL
const getContractViewUrl = (): string => {
  return `https://coston2-explorer.flare.network/address/${getContractAddress()}`
}

// Get contract address
const getContractAddress = (): string => {
  return props.contract?.address || import.meta.env.VITE_VAULT_ADDRESS || '0x6cd4FEb053E613dF60CF10f0DD1D9597051D241B'
}

// Get XRP explorer URL
const getXrpExplorerUrl = (txHash: string): string => {
  // XRP Ledger Testnet Explorer URLs
  return `https://testnet.xrpl.org/transactions/${txHash}`
}

// Get XRPL account explorer URL
const getXrplAccountUrl = (address: string): string => {
  return `https://testnet.xrpl.org/accounts/${address}`
}

// Get event explorer URL
const getEventExplorerUrl = (txHash: string, logIndex: number): string => {
  return `https://coston2-explorer.flare.network/tx/${txHash}#eventlog-${logIndex}`
}

// Show XRP memo details
const showXrpMemo = () => {
  if (uploadResult.value?.xrpPayment?.memo) {
    const memo = uploadResult.value.xrpPayment.memo
    const memoText = typeof memo === 'string' ? memo : JSON.stringify(memo, null, 2)

    const details = `
XRP Payment Memo:
${memoText}

Transaction Hash: ${uploadResult.value.xrpPayment.transactionHash}
Amount: ${uploadResult.value.xrpPayment.amount} XRP
Destination: ${uploadResult.value.xrpPayment.destinationAddress}
    `.trim()

    alert(details)
  }
}




// Format event values for display
const formatEventValue = (value: any): string => {
  if (typeof value === 'string' && value.startsWith('0x')) {
    return value.length > 18 ? `${value.substring(0, 8)}...${value.substring(value.length - 6)}` : value
  }
  if (value && value._isBigNumber) {
    return value.toString()
  }
  return String(value)
}

// Copy to clipboard function
const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text)
    alert('Copied to clipboard!')
  } catch (err) {
    console.error('Failed to copy:', err)
    // Fallback for older browsers
    const textArea = document.createElement('textarea')
    textArea.value = text
    document.body.appendChild(textArea)
    textArea.select()
    document.execCommand('copy')
    document.body.removeChild(textArea)
    alert('Copied to clipboard!')
  }
}

// Document type names
const getDocTypeName = (type: string | number): string => {
  const types: Record<string, string> = {
    '0': '🩺 Diagnosis Letter',
    '1': '📋 Referral',
    '2': '📝 Intake Form'
  }
  return types[type.toString()] || 'Unknown'
}

// Format timestamp
const formatTimestamp = (timestamp: number): string => {
  return new Date(timestamp * 1000).toLocaleString()
}


// Verify document hash
const verifyDocumentHash = async () => {
  if (!uploadResult.value) return

  try {
    uploadStatus.value = 'Verifying document hash on blockchain...'

    const patientId = uploadResult.value.patientId
    const docCount = await props.contract.getDocumentCount(patientId)

    // Find the latest document for this patient
    for (let i = docCount.toNumber() - 1; i >= 0; i--) {
      const doc = await props.contract.getDocument(patientId, i)
      if (doc.version.eq(uploadResult.value.version)) {
        const onChainURI = doc.ipfsHash
        const onChainHash = onChainURI.split('#')[0] // Extract hash from URI

        if (onChainHash === uploadResult.value.contentHash) {
          uploadStatus.value = '✅ Document hash verified successfully on blockchain!'
        } else {
          uploadStatus.value = '❌ Document hash mismatch - verification failed!'
        }

        setTimeout(() => {
          uploadStatus.value = ''
        }, 5000)
        return
      }
    }

    uploadStatus.value = '❌ Document not found on blockchain'
    setTimeout(() => {
      uploadStatus.value = ''
    }, 5000)

  } catch (error) {
    console.error('Verification failed:', error)
    uploadStatus.value = '❌ Verification failed - unable to connect to blockchain'
    setTimeout(() => {
      uploadStatus.value = ''
    }, 5000)
  }
}

// Format ether amount - removed for IPFS-only mode
// const formatEther = (wei: string): string => {
//   return ethers.utils.formatEther(wei)
// }


// Main upload function
const uploadDocument = async () => {
  if (!canProceedWithUpload.value) return

  uploading.value = true
  currentStep.value = 0
  uploadResult.value = null

  console.log('🚀 Starting document upload process')
  console.log('Upload type:', uploadType.value)
  console.log('Props contract:', props.contract)
  console.log('Window ethereum:', !!window.ethereum)
  console.log('Account:', props.account)
  console.log('Is connected:', props.isConnected)

  try {
    // Step 1: Initialize ethers properly
    currentStep.value = 1
    uploadStatus.value = 'Preparing wallet encryption...'
    console.log('📝 Step 1: Initializing ethers and wallet connection')

    if (!window.ethereum) {
      throw new Error('MetaMask not detected')
    }

    if (!props.isConnected || !props.account) {
      throw new Error('Wallet not connected')
    }

    // Initialize robust provider with circuit breaker and retry logic
    console.log('🔗 Initializing robust Web3Provider with circuit breaker...')
    const { provider, signer, robustProvider } = await UploadHelper.initializeRobustProvider('testnet')

    console.log('Provider network:', await provider.getNetwork())

    console.log('🖊️ Getting signer address...')
    const signerAddress = await signer.getAddress()
    console.log('Signer address:', signerAddress)
    console.log('Expected account:', props.account)

    if (signerAddress.toLowerCase() !== props.account.toLowerCase()) {
      throw new Error(`Signer address mismatch: ${signerAddress} vs ${props.account}`)
    }

    // Handle XRP payment and memo if using smart account
    if (useSmartAccount.value) {
      currentStep.value = 1.5
      uploadStatus.value = '💎 Processing XRP payment ($0.10) with medical memo...'

      try {
        const memoData = {
          patientId: patientId,
          docType: parseInt(docType.value),
          timestamp: Date.now(),
          uploadType: uploadType.value
        }

        // Create a simple XRP payment for medical record upload
        const chargeId = `upload_${Date.now()}_${Math.random().toString(36).substring(7)}`
        const paymentRequest = await xrplPaymentService.createPaymentRequest(
          chargeId,
          props.account, // from wallet
          props.account, // to wallet (self for record keeping)
          0.1, // $0.10 USD for medical record upload
          {
            serviceType: 'medical_record_upload',
            patientId: memoData.patientId,
            description: `Upload ${getDocTypeName(docType.value)} document`
          }
        )

        const xrpPayment = await xrplPaymentService.submitPaymentToXrpl(paymentRequest)

        console.log('XRP payment initiated:', xrpPayment)

        // Store XRP payment info for later display
        uploadResult.value = uploadResult.value || {}
        uploadResult.value.xrpPayment = {
          transactionHash: xrpPayment.transactionHash,
          success: xrpPayment.success,
          memo: JSON.stringify(memoData)
        }

        // Update smart account status after payment
        await updateSmartAccountStatus()

      } catch (xrpError) {
        console.warn('XRP payment failed, continuing with Flare-only upload:', xrpError)
      }
    }

    // Initialize contract with proper ABI and address
    console.log('📋 Initializing contract with ABI...')
    const contractAddress = getContractAddress()
    console.log('Contract address:', contractAddress)
    console.log('Contract ABI:', MedicalVaultABI.abi ? 'Available' : 'Missing')

    const contract = new ethers.Contract(
      contractAddress,
      MedicalVaultABI.abi || MedicalVaultABI,
      signer
    )

    console.log('Contract instance created:', contract)
    console.log('Contract functions available:', Object.keys(contract.functions || {}))

    // Step 2: Generate patient ID and process content
    console.log('👤 Step 2: Processing patient data and content')
    // const patientId = hashPatientId(mrn.value, salt.value)
    const patientId = "0xd976ece7f97402cc704731e8d64e747d1126161565a1208473a9bf64bffc8570"
    console.log('MRN:', mrn.value)
    console.log('Salt:', salt.value)

    let encryptedContent: string
    let contentHash: string
    let filename: string = 'document'
    let metadata: any

    currentStep.value = 2

    if (uploadType.value === 'file' && selectedFile.value) {
      console.log('📁 Processing file upload...')
      uploadStatus.value = 'Processing file and generating hash...'

      filename = selectedFile.value.name
      console.log('File name:', filename)
      console.log('File size:', selectedFile.value.size)
      console.log('File type:', selectedFile.value.type)

      const fileBuffer = await selectedFile.value.arrayBuffer()
      console.log('File buffer length:', fileBuffer.byteLength)

      // Generate file hash
      console.log('🔍 Generating file hash...')
      contentHash = await generateFileHash(fileBuffer)
      console.log('Content hash generated:', contentHash)

      // Encrypt file with wallet
      console.log('🔐 Encrypting file with wallet...')
      const fileEncryption = await encryptFileWithWallet(
        fileBuffer,
        signer,
        patientId,
        salt.value
      )
      console.log('File encryption completed')

      encryptedContent = fileEncryption.encryptedContent
      metadata = { ...fileEncryption.metadata, filename, contentType: 'file', hash: contentHash }
      console.log('File metadata:', metadata)

    } else if (uploadType.value === 'text' && documentContent.value) {
      console.log('📝 Processing text upload...')
      uploadStatus.value = 'Processing text and generating hash...'

      filename = 'text_document.txt'
      console.log('Text content length:', documentContent.value.length)

      // Generate text hash
      console.log('🔍 Generating text hash...')
      contentHash = await generateTextHash(documentContent.value)
      console.log('Content hash generated:', contentHash)

      // Encrypt text with wallet
      console.log('🔐 Encrypting text with wallet...')
      const textEncryption = await encryptTextWithWallet(
        documentContent.value,
        signer,
        patientId,
        salt.value
      )
      console.log('Text encryption completed')

      encryptedContent = textEncryption.encryptedContent
      metadata = { ...textEncryption.metadata, filename, contentType: 'text', hash: contentHash }
      console.log('Text metadata:', metadata)
    } else {
      throw new Error('No content selected for upload')
    }

    // Step 3: Create content URI for blockchain
    currentStep.value = 3
    uploadStatus.value = 'Creating content URI...'
    console.log('🔗 Step 3: Creating content URI')

    const contentURI = createContentURI(contentHash, uploadType.value as 'file' | 'text', filename)
    console.log('Content URI created:', contentURI)

    // Step 4: Mint on Flare blockchain (no fee required)
    currentStep.value = 4
    console.log('⛓️ Step 4: Minting on Flare blockchain')
    uploadStatus.value = 'Minting document hash on blockchain...'

    const docKind = parseInt(docType.value)
    console.log('Document type (docKind):', docKind)
    console.log('Patient ID for contract:', patientId)
    console.log('Content URI for contract:', contentURI)

    // Check if uploadDocumentDeduct function exists
    const contractFunctions = Object.keys(contract.functions || {})
    console.log('Available contract functions:', contractFunctions)

    if (!contract.uploadDocumentDeduct) {
      console.error('uploadDocumentDeduct function not found!')
      throw new Error('uploadDocumentDeduct function not available in contract')
    }

    // Estimate gas for upload
    let gasEstimate
    try {
      gasEstimate = await contract.estimateGas.uploadDocumentDeduct(
        patientId,
        docKind,
        contentURI
      )
      console.log('Gas estimate:', gasEstimate.toString())
    } catch (gasError) {
      console.error('Gas estimation failed:', gasError)
      gasEstimate = ethers.BigNumber.from('500000') // fallback
    }

    // Execute blockchain transaction (try without fee first)
    console.log('📝 Executing blockchain mint transaction...')
    console.log('Transaction params:', {
      patientId,
      docKind,
      contentURI,
      gasLimit: gasEstimate.mul(120).div(100) // 20% buffer
    })

    const tx = await contract.uploadDocumentDeduct(
      patientId,
      docKind,
      contentURI,
      {
        gasLimit: gasEstimate.mul(120).div(100) // 20% buffer
      }
    )

    console.log('Transaction sent:', tx.hash)
    console.log('Transaction object:', tx)

    uploadStatus.value = 'Waiting for blockchain confirmation...'
    console.log('⏳ Waiting for transaction confirmation...')

    const receipt = await tx.wait()
    console.log('✅ Transaction confirmed!', receipt)
    console.log('Block number:', receipt.blockNumber)
    console.log('Gas used:', receipt.gasUsed.toString())
    console.log('Transaction logs:', receipt.logs)

    // Capture smart contract events for smart account integration
    if (useSmartAccount.value) {
      uploadResult.value = uploadResult.value || {}
      uploadResult.value.smartContractEvents = []

      // Parse all events from the transaction
      receipt.logs.forEach((log: any, index: number) => {
        try {
          const parsed = contract.interface.parseLog(log)
          if (parsed) {
            uploadResult.value.smartContractEvents.push({
              name: parsed.name,
              args: parsed.args,
              txHash: receipt.transactionHash,
              logIndex: index,
              blockNumber: receipt.blockNumber
            })
            console.log(`📋 Captured event: ${parsed.name}`, parsed.args)
          }
        } catch (error) {
          console.log('Could not parse log:', log, error)
        }
      })
    }

    // Find the DocumentUploaded event
    console.log('🔍 Parsing transaction logs for DocumentUploaded event...')

    const uploadEvent = receipt.logs.find((log: any) => {
      try {
        console.log('Parsing log:', log)
        const parsed = contract.interface.parseLog(log)
        console.log('Parsed log:', parsed)
        return parsed?.name === 'DocumentUploaded'
      } catch (parseError) {
        console.log('Failed to parse log:', parseError)
        return false
      }
    })

    let version = 1
    if (uploadEvent) {
      console.log('📄 DocumentUploaded event found:', uploadEvent)
      const parsed = contract.interface.parseLog(uploadEvent)
      console.log('Event args:', parsed?.args)
      version = Number(parsed?.args[3] || 1)
      console.log('Document version:', version)
    } else {
      console.warn('⚠️ DocumentUploaded event not found in transaction logs')
    }

    // Get current timestamp
    const currentTimestamp = Math.floor(Date.now() / 1000)

    // Create success result with real blockchain transaction
    uploadResult.value = {
      success: true,
      txHash: receipt.transactionHash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
      version,
      contentHash,
      contentURI,
      patientId,
      docType: docType.value,
      timestamp: currentTimestamp,
      message: 'Document hash minted on blockchain and file stored locally!'
    }

    uploadStatus.value = 'Upload completed successfully!'

    // Store encrypted file locally using IndexedDB for later download
    try {
      uploadStatus.value = 'Storing file locally for future access...'

      const fileId = await storeEncryptedFile(
        filename,
        uploadType.value === 'file' ? selectedFile.value!.type : 'text/plain',
        encryptedContent,
        metadata,
        contentHash,
        uploadResult.value.txHash
      )

      // Store upload info in localStorage for quick reference
      const uploadInfo = {
        fileId, // Reference to IndexedDB stored file
        filename,
        contentType: uploadType.value,
        contentHash,
        contentURI,
        patientId,
        docType: docType.value,
        uploadDate: new Date().toISOString(),
        encryptionMethod: 'wallet-signature',
        txHash: uploadResult.value.txHash,
        version: uploadResult.value.version,
        blockNumber: uploadResult.value.blockNumber
      }

      // Save to localStorage for simple tracking (without encrypted content)
      const existingUploads = JSON.parse(localStorage.getItem('medicalVaultUploads') || '[]')
      existingUploads.push(uploadInfo)
      localStorage.setItem('medicalVaultUploads', JSON.stringify(existingUploads))

      // Clear any cached data to ensure fresh downloads
      console.log('🧹 Clearing caches after upload...')

      // Clear browser caches
      if ('caches' in window) {
        const cacheNames = await caches.keys()
        await Promise.all(cacheNames.map(name => caches.delete(name)))
        console.log('✅ Browser caches cleared')
      }

      // Clear any component/service caches
      if (window.mappingServiceCache) {
        window.mappingServiceCache.clear()
        console.log('✅ Mapping service cache cleared')
      }

      uploadStatus.value = 'Transaction hash mapped to local file!'

      console.log('✅ Document hash minted on blockchain and mapped to local file!', uploadInfo)

      // Store mapping in database for cross-device sync
      try {
        uploadStatus.value = 'Storing mapping in database...'

        await mappingService.storeMapping({
          txHash: uploadResult.value.txHash,
          walletAddress: props.account.toLowerCase(),
          contentHash,
          fileName: filename,
          fileSize: uploadType.value === 'file' ? selectedFile.value!.size : documentContent.value.length,
          contentType: uploadType.value === 'file' ? selectedFile.value!.type : 'text/plain',
          patientId,
          docType: parseInt(docType.value),
          blockNumber: uploadResult.value.blockNumber,
          gasUsed: uploadResult.value.gasUsed,
          version: uploadResult.value.version,
          localFileId: fileId,
          contentURI,
          deviceInfo: mappingService.createDeviceInfo()
        })

        console.log('✅ Mapping stored in database successfully!')
        uploadStatus.value = 'Upload completed - stored locally and in database!'

      } catch (mappingError) {
        console.warn('⚠️ Failed to store mapping in database (continuing anyway):', mappingError)
        uploadStatus.value = 'Upload completed - stored locally (database storage failed)'
      }

    } catch (storageError) {
      console.error('Local storage failed:', storageError)
      uploadStatus.value = 'Warning: File not stored locally, but hash recorded on blockchain'
    }

  } catch (error: any) {
    console.error('❌ Upload error occurred:')
    console.error('Error type:', typeof error)
    console.error('Error message:', error.message)
    console.error('Error stack:', error.stack)
    console.error('Full error object:', error)

    // Log additional context for debugging
    console.error('Upload context:', {
      uploadType: uploadType.value,
      hasFile: !!selectedFile.value,
      hasText: !!documentContent.value,
      mrn: mrn.value,
      salt: salt.value,
      docType: docType.value,
      account: props.account,
      isConnected: props.isConnected,
      contractAddress: getContractAddress()
    })

    // Enhanced error handling with user-friendly messages
    const friendlyErrorMessage = UploadHelper.getErrorMessage(error)
    console.error('❌ Friendly error message:', friendlyErrorMessage)

    uploadResult.value = {
      success: false,
      error: friendlyErrorMessage
    }
    uploadStatus.value = `❌ ${friendlyErrorMessage}`

    // Show retry option for circuit breaker errors
    if (error.code === -32603 && error.message?.includes('circuit breaker')) {
      setTimeout(() => {
        uploadStatus.value = '🔄 Network overloaded. Try again in a moment...'
      }, 2000)
    }
  } finally {
    uploading.value = false
    console.log('🏁 Upload process completed')
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

.account-status {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-top: 1rem;
  padding: 1rem;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  backdrop-filter: blur(10px);
}

.status-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.status-label {
  font-weight: 500;
  opacity: 0.9;
}

.status-value {
  font-weight: bold;
  font-family: monospace;
}

.status-value.linked {
  color: #2ecc71;
}

.status-value.unlinked {
  color: #e74c3c;
}

.xrp-wallet-info {
  margin-top: 1rem;
  padding: 1.5rem;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  backdrop-filter: blur(10px);
}

.wallet-header {
  margin-bottom: 1.5rem;
}

.wallet-header h4 {
  color: white;
  margin-bottom: 0.5rem;
}

.wallet-address {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: rgba(255, 255, 255, 0.1);
  padding: 0.75rem;
  border-radius: 8px;
  margin-top: 0.5rem;
}

.wallet-address .label {
  font-weight: 500;
  opacity: 0.9;
}

.wallet-address .address {
  font-family: monospace;
  font-weight: bold;
  color: #f39c12;
  flex: 1;
}

.copy-btn {
  background: #3498db;
  color: white;
  border: none;
  padding: 0.5rem;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.3s;
}

.copy-btn:hover {
  background: #2980b9;
  transform: scale(1.1);
}

.xrp-features {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.feature-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  background: rgba(255, 255, 255, 0.1);
  padding: 1rem;
  border-radius: 8px;
}

.feature-icon {
  font-size: 1.5rem;
  width: 2rem;
  text-align: center;
}

.feature-text {
  flex: 1;
}

.feature-text strong {
  color: #f39c12;
}

.memo-preview {
  margin-top: 0.5rem;
  background: rgba(0, 0, 0, 0.3);
  padding: 0.75rem;
  border-radius: 6px;
  border-left: 3px solid #f39c12;
}

.memo-preview code {
  color: #ecf0f1;
  font-size: 0.85rem;
  line-height: 1.4;
  white-space: pre-wrap;
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
.upload-type-section,
.content-section,
.file-section {
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

.upload-options {
  display: flex;
  gap: 2rem;
  margin-bottom: 1rem;
}

.radio-option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  padding: 0.75rem 1rem;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  transition: all 0.3s;
}

.radio-option:hover {
  border-color: #3498db;
}

.radio-option input[type="radio"] {
  width: auto;
  margin: 0;
}

.radio-option input[type="radio"]:checked + span,
.radio-option:has(input[type="radio"]:checked) {
  border-color: #3498db;
  background: #f0f8ff;
}

.file-info {
  background: #f8f9fa;
  padding: 1rem;
  border-radius: 4px;
  margin-top: 0.5rem;
}

/* Hash storage info styles */
.hash-info {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 1.5rem;
  border-radius: 8px;
  margin: 1rem 0;
}

/* Blockchain + local mapping info styles */
.mapping-info {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 1rem;
  border-radius: 8px;
  margin: 1rem 0;
  border: 2px solid rgba(255, 255, 255, 0.2);
}

.mapping-info h4 {
  margin: 0 0 0.5rem 0;
  font-size: 1rem;
}

.mapping-info p {
  margin: 0;
  font-size: 0.9rem;
  opacity: 0.95;
}

.hash-info h4 {
  margin: 0 0 0.5rem 0;
  font-size: 1.1rem;
}

.hash-info p {
  margin: 0 0 1rem 0;
  opacity: 0.9;
}

.storage-benefits {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.storage-benefits span {
  background: rgba(255, 255, 255, 0.2);
  padding: 0.5rem;
  border-radius: 4px;
  font-size: 0.9rem;
}

textarea {
  resize: vertical;
  min-height: 150px;
}

/* Success result styling */
.result-section {
  margin: 1.5rem 0;
  border: 1px solid #d4edda;
  border-radius: 8px;
  padding: 1rem;
  background: #f8fff9;
}

.result-section h4 {
  margin: 0 0 1rem 0;
  color: #155724;
  border-bottom: 2px solid #27ae60;
  padding-bottom: 0.5rem;
}

.info-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.75rem;
}

.info-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem;
  background: white;
  border-radius: 4px;
  border: 1px solid #e9ecef;
}

.info-item .label {
  font-weight: 600;
  color: #495057;
  min-width: 140px;
}

.info-item .value {
  flex: 1;
  margin: 0 0.5rem;
  font-family: 'Courier New', monospace;
  font-size: 0.9rem;
  word-break: break-all;
}

.info-item .value.hash-value {
  font-size: 0.8rem;
  color: #6610f2;
}

.copy-btn {
  background: #6c757d;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 0.25rem 0.5rem;
  cursor: pointer;
  font-size: 0.8rem;
  transition: background 0.3s;
}

.copy-btn:hover {
  background: #5a6268;
}

.link-buttons {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.view-link, .verify-btn {
  display: inline-block;
  padding: 0.75rem 1rem;
  border-radius: 4px;
  text-decoration: none;
  text-align: center;
  font-weight: 500;
  transition: all 0.3s;
}

.view-link {
  background: #007bff;
  color: white;
}

.view-link:hover {
  background: #0056b3;
  color: white;
  text-decoration: none;
}

.view-link.xrp-link {
  background: #346aa9;
}

.view-link.xrp-link:hover {
  background: #2c5a94;
}

.xrp-links {
  margin-top: 1.5rem;
  padding: 1.5rem;
  background: linear-gradient(135deg, #346aa9 0%, #2c5a94 100%);
  border-radius: 12px;
  color: white;
}

.xrp-links h5 {
  margin: 0 0 1rem 0;
  color: white;
}

.memo-btn {
  background: #e67e22;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 25px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s;
}

.memo-btn:hover {
  background: #d35400;
  transform: translateY(-2px);
}

.contract-events {
  margin-top: 1.5rem;
  padding: 1.5rem;
  background: linear-gradient(135deg, #27ae60 0%, #229954 100%);
  border-radius: 12px;
  color: white;
}

.contract-events h5 {
  margin: 0 0 1rem 0;
  color: white;
}

.event-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.event-item {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  padding: 1rem;
  backdrop-filter: blur(10px);
}

.event-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.event-name {
  font-weight: bold;
  font-size: 1.1rem;
}

.event-link {
  background: #f39c12;
  color: white;
  text-decoration: none;
  padding: 0.5rem 1rem;
  border-radius: 20px;
  font-size: 0.9rem;
  transition: all 0.3s;
}

.event-link:hover {
  background: #e67e22;
  transform: translateY(-1px);
}

.event-params {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 0.5rem;
}

.param-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(255, 255, 255, 0.1);
  padding: 0.5rem;
  border-radius: 4px;
}

.param-key {
  font-weight: 500;
  opacity: 0.9;
}

.param-value {
  font-family: monospace;
  font-size: 0.9rem;
  word-break: break-all;
}

.verify-btn {
  background: #28a745;
  color: white;
  border: none;
  cursor: pointer;
}

.verify-btn:hover {
  background: #1e7e34;
}

.event-info {
  background: #f8f9fa;
  padding: 1rem;
  border-radius: 4px;
  border-left: 4px solid #007bff;
}

.event-info p {
  margin: 0.25rem 0;
  font-size: 0.9rem;
}

.hash-display {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.85rem;
  background: #e3f2fd;
  color: #1976d2;
  padding: 6px 10px;
  border: 1px solid #bbdefb;
  border-radius: 6px;
  word-break: break-all;
  display: inline-block;
  max-width: 400px;
  font-weight: 500;
}

@media (max-width: 768px) {
  .info-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }

  .info-item .label {
    min-width: auto;
  }

  .link-buttons {
    flex-direction: column;
  }
}
</style>