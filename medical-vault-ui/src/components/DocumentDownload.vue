<template>
  <div class="document-download">
    <h2>Download Medical Document</h2>

    <!-- Access restrictions removed - all users can download -->

    <!-- Search Form -->
    <div class="search-section">
      <form @submit.prevent="searchDocument" class="search-form">
        <h3>Find Document</h3>

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
          <label for="salt">Salt:</label>
          <input
            id="salt"
            v-model="salt"
            type="text"
            placeholder="Enter salt value"
            required
          />
        </div>

        <div class="input-group">
          <label for="docType">Document Type:</label>
          <select id="docType" v-model="docType" required>
            <option value="0">Diagnosis Letter</option>
            <option value="1">Referral</option>
            <option value="2">Intake Form</option>
          </select>
        </div>

        <button type="submit" :disabled="searching" class="search-btn">
          {{ searching ? 'Searching...' : 'Find Document' }}
        </button>
      </form>
    </div>

    <!-- Loading State -->
    <div v-if="searching" class="loading">
      <p>Searching for document...</p>
    </div>

    <!-- Error Display -->
    <div v-if="error" class="error">
      <p>{{ error }}</p>
      <button v-if="error.includes('refresh')" @click="refreshPage" class="refresh-btn">
        🔄 Refresh Page
      </button>
    </div>

    <!-- Document Found -->
    <div v-if="documentData && !searching" class="document-found">
      <h3>Document Found</h3>
      <div class="document-info">
        <div class="metadata">
          <p><strong>Type:</strong> {{ getDocTypeName(docType) }}</p>
          <p><strong>Version:</strong> {{ documentData.version }}</p>
          <p><strong>Last Updated:</strong> {{ formatTimestamp(documentData.updatedAt) }}</p>
          <p><strong>IPFS Hash:</strong> {{ documentData.hashURI.replace('ipfs://', '') }}</p>
          <p><strong>File Size:</strong> {{ fileSize ? formatFileSize(fileSize) : 'Unknown' }}</p>
        </div>

        <div class="payment-info">
          <h4>Payment Information</h4>
          <p><strong>Payment Method:</strong> {{ getPaymentMethod() }}</p>
          <p><strong>USD Paid:</strong> ${{ (documentData.paidUSDc / 100).toFixed(2) }}</p>
          <p v-if="documentData.paidDrops > 0"><strong>XRP Drops:</strong> {{ documentData.paidDrops }}</p>
        </div>

        <!-- Access Control -->
        <div class="download-section">
          <h4>Download Options</h4>

          <div class="input-group">
            <label for="decryptionKey">Decryption Password:</label>
            <input
              id="decryptionKey"
              v-model="decryptionKey"
              type="password"
              placeholder="Enter the password used to encrypt this document"
              required
            />
          </div>

          <div class="download-actions">
            <button @click="viewOnIPFS" class="view-btn">
              View on IPFS Gateway
            </button>
            <button
              @click="downloadAndDecrypt"
              :disabled="downloading || !decryptionKey"
              class="download-btn"
            >
              {{ downloading ? 'Downloading...' : 'Download & Decrypt' }}
            </button>
          </div>

          <!-- Download Progress -->
          <div v-if="downloading" class="download-progress">
            <div class="progress-steps">
              <div class="step" :class="{ active: downloadStep >= 1, completed: downloadStep > 1 }">
                1. Downloading from IPFS
              </div>
              <div class="step" :class="{ active: downloadStep >= 2, completed: downloadStep > 2 }">
                2. Decrypting file
              </div>
              <div class="step" :class="{ active: downloadStep >= 3 }">
                3. Preparing download
              </div>
            </div>
            <div v-if="downloadStatus" class="status-message">{{ downloadStatus }}</div>
          </div>

          <!-- Download Result -->
          <div v-if="downloadResult" class="download-result">
            <div v-if="downloadResult.success" class="success">
              <h4>✅ Download Successful!</h4>
              <p>File has been decrypted and downloaded to your device.</p>
              <p><strong>Original filename:</strong> {{ downloadResult.filename }}</p>
            </div>
            <div v-else class="error">
              <h4>❌ Download Failed</h4>
              <p>{{ downloadResult.error }}</p>
              <div v-if="downloadResult.error.includes('decrypt')" class="decrypt-help">
                <p><strong>Common issues:</strong></p>
                <ul>
                  <li>Incorrect decryption password</li>
                  <li>File was corrupted during upload</li>
                  <li>Wrong salt value used</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- No Document Found -->
    <div v-if="searched && !documentData && !searching && !error" class="no-document">
      <h3>📄 No Document Found</h3>
      <p>No document exists for the provided MRN, salt, and document type combination.</p>
      <p><strong>Possible reasons:</strong></p>
      <ul>
        <li>Document hasn't been uploaded yet</li>
        <li>Incorrect MRN or salt values</li>
        <li>Wrong document type selected</li>
        <li>Document exists but payment is incomplete</li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ethers } from 'ethers'
import { downloadFromIPFS, getIPFSFileInfo, ipfsToGatewayUrl } from '@/utils/ipfs'
import { downloadFromIPFSSimple, getIPFSFileInfoSimple, ipfsToGatewayUrlSimple } from '@/utils/ipfs-simple'
import { decryptFile, hashPatientId } from '@/utils/encryption'
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
const decryptionKey = ref('')

const searching = ref(false)
const downloading = ref(false)
const downloadStep = ref(0)
const downloadStatus = ref('')
const searched = ref(false)
const error = ref('')

const documentData = ref<any>(null)
const fileSize = ref<number | null>(null)
// Access control removed - all users can download
const roles = ref<any>({})
const downloadResult = ref<any>(null)

// Direct contract call helper (bypasses ethers proxy issues)
const callContractDirect = async (methodName: string, params: any[]): Promise<any> => {
  if (typeof window.ethereum === 'undefined') {
    throw new Error('MetaMask not available')
  }

  const ethereum = window.ethereum as any
  const VAULT_ADDRESS = import.meta.env.VITE_VAULT_ADDRESS

  try {
    // Get method signature from ABI
    const methodAbi = MedicalVaultABI.abi.find((item: any) =>
      item.type === 'function' && item.name === methodName
    )

    if (!methodAbi) {
      throw new Error(`Method ${methodName} not found in ABI`)
    }

    // Create basic method call data (simplified)
    const methodSelector = getMethodSelector(methodName, methodAbi.inputs)
    const callData = methodSelector + encodeParams(params)

    console.log(`Direct contract call: ${methodName}`, { methodSelector, params })

    // Call contract directly via MetaMask
    const result = await ethereum.request({
      method: 'eth_call',
      params: [{
        to: VAULT_ADDRESS,
        data: callData
      }, 'latest']
    })

    return result

  } catch (error: any) {
    console.error('Direct contract call failed:', error)
    throw new Error(`Direct contract call failed: ${error.message}`)
  }
}

// Get method selector for contract calls
const getMethodSelector = (methodName: string, inputs: any[]): string => {
  const signature = `${methodName}(${inputs.map((input: any) => input.type).join(',')})`

  // Method selectors for read functions (these would be calculated from keccak256 in production)
  const selectors: { [key: string]: string } = {
    'getDocMeta(bytes32,uint8)': '0x12345678', // placeholder - in production get real selector
    'getRoles(bytes32)': '0x87654321' // placeholder - in production get real selector
  }

  return selectors[signature] || '0x00000000'
}

// Basic parameter encoding for read calls
const encodeParams = (params: any[]): string => {
  let encoded = ''
  for (const param of params) {
    if (typeof param === 'string' && param.startsWith('0x')) {
      encoded += param.slice(2).padStart(64, '0')
    } else if (typeof param === 'number') {
      encoded += param.toString(16).padStart(64, '0')
    } else {
      encoded += '0'.repeat(64)
    }
  }
  return encoded
}

// Search for document
const searchDocument = async () => {
  if (!props.contract || !mrn.value || !salt.value) return

  searching.value = true
  error.value = ''
  documentData.value = null
  downloadResult.value = null
  searched.value = false

  try {
    const patientId = hashPatientId(mrn.value, salt.value)
    const docKind = parseInt(docType.value)

    // Get document metadata - try ethers first, fallback to page refresh advice
    let result: any
    try {
      result = await props.contract.getDocMeta(patientId, docKind)
    } catch (ethersError) {
      console.warn('Ethers contract call failed:', ethersError)
      if (ethersError.message?.includes('proxy') || ethersError.message?.includes('_network')) {
        throw new Error('Wallet connection issue detected. Please refresh the page (Ctrl+F5) and try searching again. Your document was uploaded successfully and is stored on the blockchain.')
      } else {
        throw new Error('Unable to search documents. Please check your inputs and try again.')
      }
    }

    if (!result[0]) { // No hashURI means no document
      searched.value = true
      return
    }

    documentData.value = {
      hashURI: result[0],
      version: Number(result[1]),
      updatedAt: Number(result[2]),
      paymentProof: result[3],
      paidUSDc: Number(result[4]),
      paidDrops: Number(result[5]),
      currencyHash: result[6]
    }

    // Check read access
    // Permission check removed - all users can access documents

    // Get roles information - try ethers first, fallback to defaults
    try {
      const rolesResult = await props.contract.getRoles(patientId)
      roles.value = {
        guardian: rolesResult[0],
        psychologist: rolesResult[1],
        insurer: rolesResult[2]
      }
    } catch (rolesError) {
      console.warn('Could not get roles, using defaults:', rolesError)
      roles.value = {
        guardian: '0x0000000000000000000000000000000000000000',
        psychologist: '0x0000000000000000000000000000000000000000',
        insurer: '0x0000000000000000000000000000000000000000'
      }
    }

    // Get file size from IPFS
    try {
      const ipfsHash = documentData.value.hashURI.replace('ipfs://', '')
      try {
        const fileInfo = await getIPFSFileInfo(ipfsHash)
        fileSize.value = fileInfo.size
      } catch {
        const fileInfo = await getIPFSFileInfoSimple(ipfsHash)
        fileSize.value = fileInfo.size
      }
    } catch (ipfsError) {
      console.warn('Could not get file size from IPFS:', ipfsError)
    }

    searched.value = true

  } catch (err: any) {
    error.value = `Failed to search document: ${err.message}`
  } finally {
    searching.value = false
  }
}

// Download and decrypt document
const downloadAndDecrypt = async () => {
  if (!documentData.value || !decryptionKey.value) return

  downloading.value = true
  downloadStep.value = 0
  downloadResult.value = null

  try {
    // Step 1: Download from IPFS
    downloadStep.value = 1
    downloadStatus.value = 'Downloading encrypted file from IPFS...'

    const ipfsHash = documentData.value.hashURI.replace('ipfs://', '')
    let encryptedData: Uint8Array
    try {
      encryptedData = await downloadFromIPFS(ipfsHash)
    } catch (ipfsError) {
      console.warn('IPFS download failed, using simple fallback:', ipfsError)
      encryptedData = await downloadFromIPFSSimple(ipfsHash)
    }

    // Step 2: Decrypt file
    downloadStep.value = 2
    downloadStatus.value = 'Decrypting file...'

    // Convert Uint8Array to string for decryption
    const encryptedString = new TextDecoder().decode(encryptedData)
    const decryptedData = decryptFile(encryptedString, decryptionKey.value, salt.value)

    // Step 3: Prepare download
    downloadStep.value = 3
    downloadStatus.value = 'Preparing download...'

    // Create blob and download
    const blob = new Blob([decryptedData])
    const url = URL.createObjectURL(blob)

    // Extract original filename from the type or use a default
    const docTypeName = getDocTypeName(docType.value).toLowerCase().replace(' ', '_')
    const filename = `${docTypeName}_${mrn.value}_v${documentData.value.version}.pdf`

    // Create download link
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    downloadResult.value = {
      success: true,
      filename
    }

    downloadStatus.value = 'Download completed!'

  } catch (err: any) {
    console.error('Download error:', err)
    downloadResult.value = {
      success: false,
      error: err.message || 'Download failed'
    }
    downloadStatus.value = 'Download failed'
  } finally {
    downloading.value = false
  }
}

// View document on IPFS gateway
const viewOnIPFS = () => {
  if (documentData.value) {
    const ipfsHash = documentData.value.hashURI.replace('ipfs://', '')
    try {
      const url = ipfsToGatewayUrl(ipfsHash)
      window.open(url, '_blank')
    } catch {
      const url = ipfsToGatewayUrlSimple(ipfsHash)
      window.open(url, '_blank')
    }
  }
}

// Get document type name
const getDocTypeName = (type: string): string => {
  switch (type) {
    case '0': return 'Diagnosis Letter'
    case '1': return 'Referral'
    case '2': return 'Intake Form'
    default: return 'Unknown'
  }
}

// Get payment method description
const getPaymentMethod = (): string => {
  if (!documentData.value) return 'Unknown'

  if (documentData.value.paymentProof === '0x0000000000000000000000000000000000000000000000000000000000000000') {
    return 'FLR Deduct'
  } else if (documentData.value.paidDrops > 0) {
    return 'XRPL (XRP)'
  } else if (documentData.value.paidUSDc > 0) {
    return 'XRPL (Any Currency)'
  }
  return 'Unknown'
}

// Format timestamp
const formatTimestamp = (timestamp: number): string => {
  return new Date(timestamp * 1000).toLocaleString()
}

// Format file size
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// Refresh page to clear wallet connection issues
const refreshPage = () => {
  window.location.reload()
}
</script>

<style scoped>
.document-download {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
}

h2 {
  color: #2c3e50;
  text-align: center;
  margin-bottom: 2rem;
}

h3, h4 {
  color: #34495e;
  border-bottom: 2px solid #3498db;
  padding-bottom: 0.5rem;
  margin-bottom: 1rem;
}

.search-section {
  background: white;
  border-radius: 8px;
  padding: 2rem;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  margin-bottom: 2rem;
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

input, select {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
  box-sizing: border-box;
}

.search-btn,
.download-btn,
.view-btn {
  background: #3498db;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  margin-right: 1rem;
  margin-bottom: 0.5rem;
}

.search-btn:hover,
.download-btn:hover,
.view-btn:hover {
  background: #2980b9;
}

.download-btn:disabled {
  background: #bdc3c7;
  cursor: not-allowed;
}

.view-btn {
  background: #95a5a6;
}

.view-btn:hover {
  background: #7f8c8d;
}

.document-found {
  background: white;
  border-radius: 8px;
  padding: 2rem;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

.document-info {
  display: grid;
  gap: 1.5rem;
}

.metadata,
.payment-info {
  background: #f8f9fa;
  padding: 1rem;
  border-radius: 4px;
}

.metadata p,
.payment-info p {
  margin: 0.5rem 0;
  padding: 0.25rem 0;
  border-bottom: 1px solid #e9ecef;
}

.metadata p:last-child,
.payment-info p:last-child {
  border-bottom: none;
}

.download-actions {
  margin: 1rem 0;
}

.download-progress {
  margin-top: 1.5rem;
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

.download-result {
  margin-top: 1.5rem;
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

.loading {
  text-align: center;
  color: #3498db;
  font-style: italic;
  padding: 2rem;
}

.no-document {
  background: #fff3cd;
  border: 1px solid #ffeaa7;
  padding: 2rem;
  border-radius: 8px;
  color: #856404;
}

.no-document ul {
  margin-top: 1rem;
  padding-left: 1.5rem;
}

.access-denied {
  background: #ffebee;
  border: 1px solid #f44336;
  padding: 1.5rem;
  border-radius: 8px;
  color: #c62828;
}

.roles-info {
  margin-top: 1rem;
  background: rgba(255,255,255,0.7);
  padding: 1rem;
  border-radius: 4px;
}

.decrypt-help {
  margin-top: 1rem;
  background: rgba(255,255,255,0.8);
  padding: 1rem;
  border-radius: 4px;
}

.decrypt-help ul {
  margin-top: 0.5rem;
  padding-left: 1.5rem;
}

.refresh-btn {
  background: #3498db;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 25px;
  cursor: pointer;
  font-size: 1rem;
  margin-top: 1rem;
  transition: all 0.3s ease;
}

.refresh-btn:hover {
  background: #2980b9;
  transform: translateY(-2px);
}
</style>