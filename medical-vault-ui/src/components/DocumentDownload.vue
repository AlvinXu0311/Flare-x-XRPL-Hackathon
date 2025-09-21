<template>
  <div class="document-download">
    <h2>Download Medical Document</h2>

    <!-- Your Uploaded Documents -->
    <div class="uploaded-documents">
      <h3>📄 Your Uploaded Documents</h3>
      <p>Documents you've uploaded with your wallet:</p>

      <div v-if="userDocuments.length === 0" class="no-documents">
        <p>No documents found. Upload some documents first!</p>
      </div>

      <div v-else class="documents-list">
        <div
          v-for="doc in userDocuments"
          :key="doc.ipfsHash"
          class="document-card"
        >
          <div class="doc-info">
            <h4>{{ doc.filename }}</h4>
            <p><strong>Type:</strong> {{ getDocTypeName(doc.docType) }}</p>
            <p><strong>Uploaded:</strong> {{ formatDate(doc.uploadDate) }}</p>
            <p><strong>IPFS Hash:</strong> {{ doc.ipfsHash }}</p>
          </div>

          <div class="doc-actions">
            <button
              @click="downloadDocument(doc)"
              :disabled="isDownloading[doc.ipfsHash]"
              class="download-btn"
            >
              {{ isDownloading[doc.ipfsHash] ? 'Downloading...' : '📥 Download & Decrypt' }}
            </button>
            <button @click="viewOnIPFS(doc.ipfsHash)" class="view-btn">
              🌐 View on IPFS
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Manual IPFS Hash Download -->
    <div class="manual-download">
      <h3>🔍 Download by IPFS Hash</h3>
      <p>Enter an IPFS hash if you have a document link:</p>

      <div class="input-group">
        <label for="ipfsHash">IPFS Hash:</label>
        <input
          id="ipfsHash"
          v-model="manualIpfsHash"
          type="text"
          placeholder="Enter IPFS hash (without ipfs:// prefix)"
        />
      </div>

      <div class="wallet-decrypt-info">
        <h4>🔐 Wallet-Based Decryption</h4>
        <p>This will use your wallet signature to decrypt the document. Only the wallet that uploaded it can decrypt.</p>
      </div>

      <button
        @click="downloadManualHash"
        :disabled="!manualIpfsHash || isManualDownloading"
        class="download-btn"
      >
        {{ isManualDownloading ? 'Downloading...' : '📥 Download & Decrypt' }}
      </button>
    </div>

    <!-- Download Status -->
    <div v-if="downloadStatus" class="download-status">
      <p>{{ downloadStatus }}</p>
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
import { decryptFileWithWallet } from '@/utils/encryption'
import { ipfsToGatewayUrl } from '@/utils/ipfs'
import { ipfsToGatewayUrlSimple } from '@/utils/ipfs-simple'

// Props
interface Props {
  account: string
  contract: any
  isConnected: boolean
}

const props = defineProps<Props>()

// Reactive state
const userDocuments = ref<any[]>([])
const manualIpfsHash = ref('')
const isDownloading = ref<Record<string, boolean>>({})
const isManualDownloading = ref(false)
const downloadStatus = ref('')
const error = ref('')

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

// Load user's uploaded documents from localStorage
const loadUserDocuments = () => {
  try {
    const uploads = JSON.parse(localStorage.getItem('medicalVaultUploads') || '[]')

    // Filter documents uploaded by current wallet
    userDocuments.value = uploads.filter((doc: any) =>
      doc.metadata?.walletAddress?.toLowerCase() === props.account.toLowerCase()
    )
  } catch (error) {
    console.error('Error loading user documents:', error)
    userDocuments.value = []
  }
}

// Download and decrypt document
const downloadDocument = async (doc: any) => {
  if (!props.isConnected || !window.ethereum) {
    error.value = 'Wallet not connected'
    return
  }

  isDownloading.value[doc.ipfsHash] = true
  error.value = ''
  downloadStatus.value = 'Downloading from IPFS...'

  try {
    // Get wallet signer
    const provider = new ethers.providers.Web3Provider(window.ethereum)
    const signer = provider.getSigner()

    // Download from IPFS
    const response = await fetch(getIPFSUrl(doc.ipfsHash))
    if (!response.ok) {
      throw new Error('Failed to download from IPFS')
    }

    const encryptedContent = await response.text()
    downloadStatus.value = 'Decrypting with wallet signature...'

    // Decrypt using wallet
    const decryptedBuffer = await decryptFileWithWallet(
      encryptedContent,
      signer,
      doc.metadata
    )

    downloadStatus.value = 'Download complete!'

    // Create download link
    const blob = new Blob([decryptedBuffer])
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = doc.filename || 'medical-document.pdf'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    setTimeout(() => {
      downloadStatus.value = ''
    }, 3000)

  } catch (err: any) {
    console.error('Download failed:', err)
    error.value = `Download failed: ${err.message}`
  } finally {
    isDownloading.value[doc.ipfsHash] = false
  }
}

// Download by manual IPFS hash
const downloadManualHash = async () => {
  if (!props.isConnected || !window.ethereum) {
    error.value = 'Wallet not connected'
    return
  }

  isManualDownloading.value = true
  error.value = ''
  downloadStatus.value = 'Downloading from IPFS...'

  try {
    // Get wallet signer
    const provider = new ethers.providers.Web3Provider(window.ethereum)
    const signer = provider.getSigner()

    // Download from IPFS
    const response = await fetch(getIPFSUrl(manualIpfsHash.value))
    if (!response.ok) {
      throw new Error('Failed to download from IPFS')
    }

    const encryptedContent = await response.text()
    downloadStatus.value = 'Attempting wallet decryption...'

    // Try to decrypt - this might fail if user doesn't own the document
    // For manual downloads, we need to guess the metadata structure
    const metadata = {
      walletAddress: props.account,
      patientId: 'unknown', // We don't know this
      salt: 'unknown' // We don't know this either
    }

    try {
      const decryptedBuffer = await decryptFileWithWallet(
        encryptedContent,
        signer,
        metadata
      )

      downloadStatus.value = 'Download complete!'

      // Create download link
      const blob = new Blob([decryptedBuffer])
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'medical-document.pdf'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

    } catch (decryptError) {
      throw new Error('Decryption failed - you may not be authorized to access this document')
    }

    setTimeout(() => {
      downloadStatus.value = ''
    }, 3000)

  } catch (err: any) {
    console.error('Manual download failed:', err)
    error.value = `Download failed: ${err.message}`
  } finally {
    isManualDownloading.value = false
  }
}

// View document on IPFS gateway
const viewOnIPFS = (hash: string) => {
  const url = getIPFSUrl(hash)
  window.open(url, '_blank')
}

// Get IPFS URL
const getIPFSUrl = (hash: string): string => {
  try {
    return ipfsToGatewayUrl(hash)
  } catch {
    return ipfsToGatewayUrlSimple(hash)
  }
}

// Load documents when component mounts
onMounted(() => {
  loadUserDocuments()
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

.uploaded-documents, .manual-download {
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

.download-btn, .view-btn {
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

.download-btn {
  background: #27ae60;
  color: white;
}

.download-btn:hover:not(:disabled) {
  background: #219a52;
  transform: translateY(-2px);
}

.download-btn:disabled {
  background: #bdc3c7;
  cursor: not-allowed;
  transform: none;
}

.view-btn {
  background: #3498db;
  color: white;
}

.view-btn:hover {
  background: #2980b9;
  transform: translateY(-2px);
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

.wallet-decrypt-info {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 1rem;
  border-radius: 8px;
  margin: 1rem 0;
}

.wallet-decrypt-info h4 {
  margin: 0 0 0.5rem 0;
}

.wallet-decrypt-info p {
  margin: 0;
  opacity: 0.9;
}

.download-status {
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

  .download-btn, .view-btn {
    min-width: 140px;
  }
}
</style>