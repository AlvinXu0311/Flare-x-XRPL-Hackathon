<template>
  <div class="hospital-portal">
    <header class="portal-header">
      <router-link to="/" class="back-button">← Back to Home</router-link>
      <h1>Hospital Portal</h1>
      <p>Access tokenized medical records with XRPL payments</p>
    </header>

    <div class="portal-content">
      <div class="search-section">
        <div class="search-card">
          <h2>Medical Record Access</h2>

          <!-- Step 1: Enter Token ID First -->
          <div class="token-input-section">
            <h3>🔍 Enter Medical Record Token</h3>
            <p>Enter the patient's medical record token ID to check access requirements</p>

            <div class="token-input-group">
              <input
                v-model="tokenLookup"
                placeholder="Enter Token ID (e.g., DEMO_FLARE_1758343389044_9rexynadw)"
                class="token-input"
                @keyup.enter="lookupToken"
              >
              <button
                @click="lookupToken"
                :disabled="!tokenLookup.trim() || looking"
                class="lookup-button"
              >
                <span v-if="looking">Looking up...</span>
                <span v-else>Lookup Token</span>
              </button>
            </div>

            <div v-if="lookupError" class="error-message">
              {{ lookupError }}
            </div>
          </div>

          <!-- Step 2: Show token details and payment requirements -->
          <div v-if="medicalRecord && !showPaymentModal" class="token-details">
            <h3>📋 Medical Record Found</h3>
            <div class="record-info">
              <p><strong>Token ID:</strong> {{ medicalRecord.tokenId }}</p>
              <p><strong>Patient:</strong> {{ medicalRecord.patientName }}</p>
              <p><strong>Evaluation Type:</strong> {{ medicalRecord.evaluationType }}</p>
              <p><strong>Access Cost:</strong> ${{ medicalRecord.accessCost }}</p>
            </div>

            <div class="payment-requirement">
              <h4>Payment Required</h4>
              <p>This medical record requires XRPL payment. You'll need an XRPL wallet to proceed.</p>
              <button @click="proceedToPayment" class="proceed-button">
                💳 Proceed to Payment
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Token lookup takes user directly to payment modal -->
      <!-- No search results section needed anymore -->
    </div>

    <!-- Payment Modal -->
    <div v-if="showPaymentModal" class="modal-overlay" @click="closePaymentModal">
      <div class="payment-modal" @click.stop>
        <div class="modal-header">
          <h3>Payment Required</h3>
          <button @click="closePaymentModal" class="close-button">×</button>
        </div>

        <div class="modal-content">
          <div class="payment-summary">
            <h4>Access Fee: $15.00</h4>
            <p>Patient: {{ selectedEvaluation?.patientName }}</p>
            <p>Evaluation Type: {{ selectedEvaluation?.type }}</p>
          </div>

          <div class="payment-methods">
            <h4>Payment Method</h4>
            <div class="payment-option selected">
              <div class="option-icon">💎</div>
              <div class="option-details">
                <h5>XRPL Payment</h5>
                <p>Pay with XRP cryptocurrency</p>
              </div>
              <div class="option-price">$15.00</div>
            </div>
          </div>

          <div class="wallet-section">
            <h4>XRPL Wallet</h4>
            <div class="wallet-input">
              <input
                v-model="walletAddress"
                placeholder="Your XRPL wallet address"
                class="wallet-address-input"
              >
              <button @click="connectWallet" class="connect-wallet-button">
                Connect Wallet
              </button>
            </div>
            <small>We'll create a payment intent and redirect you to complete the transaction</small>
          </div>

          <div class="modal-actions">
            <button @click="closePaymentModal" class="cancel-button">Cancel</button>
            <button
              @click="processPayment"
              class="pay-button"
              :disabled="!walletAddress || processing"
            >
              <span v-if="processing">Processing...</span>
              <span v-else>Pay $15 & Access File</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Access History -->
    <div class="access-history" v-if="accessHistory.length > 0">
      <h2>Your Access History</h2>
      <div class="history-list">
        <div
          v-for="access in accessHistory"
          :key="access.id"
          class="history-item"
        >
          <div class="history-details">
            <h4>{{ access.patientName }}</h4>
            <p>{{ access.evaluationType }} - Accessed {{ access.accessDate }}</p>
            <small>Expires: {{ access.expiryDate }}</small>
          </div>
          <button @click="downloadFile(access)" class="redownload-button">
            Re-download
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { reportService, accessService, blockchainService, mockData } from '../services/api.js'
import { convertUSDToXRP } from '../utils/xrpl.js'

// Hospital setup
const hospitalAddressConfigured = ref(false)
const hospitalAddress = ref('')
const hospitalAddressValid = ref(false)
const hospitalAddressError = ref('')

// Token lookup state
const tokenLookup = ref('')
const looking = ref(false)
const lookupError = ref('')
const medicalRecord = ref(null)

const searchQuery = ref({
  tokenId: '',
  patientAddress: '',
  evaluationType: '',
  dateRange: ''
})

const evaluations = ref([])
const accessHistory = ref([])
const searching = ref(false)
const searchPerformed = ref(false)
const processing = ref(false)
const downloading = ref(false)

const showPaymentModal = ref(false)
const selectedEvaluation = ref(null)
const walletAddress = ref('')

onMounted(() => {
  loadSavedHospitalAddress()
  loadAccessHistory()
})

// Hospital address management
const validateHospitalAddress = () => {
  hospitalAddressError.value = ''
  hospitalAddressValid.value = false

  if (!hospitalAddress.value) {
    return
  }

  // Basic Ethereum address validation
  if (!/^0x[a-fA-F0-9]{40}$/.test(hospitalAddress.value)) {
    hospitalAddressError.value = 'Invalid Ethereum address format. Must start with 0x and be 42 characters long.'
    return
  }

  hospitalAddressValid.value = true
}

const confirmHospitalAddress = () => {
  if (!hospitalAddressValid.value) return

  hospitalAddressConfigured.value = true
  localStorage.setItem('hospitalAddress', hospitalAddress.value)
}

const changeHospitalAddress = () => {
  hospitalAddressConfigured.value = false
  localStorage.removeItem('hospitalAddress')
}

const loadSavedHospitalAddress = () => {
  const saved = localStorage.getItem('hospitalAddress')
  if (saved) {
    hospitalAddress.value = saved
    validateHospitalAddress()
    if (hospitalAddressValid.value) {
      hospitalAddressConfigured.value = true
    }
  }
}

const lookupToken = async () => {
  if (!tokenLookup.value.trim()) return

  looking.value = true
  lookupError.value = ''
  medicalRecord.value = null

  try {
    // Try to get medical record details from blockchain
    // In real implementation, this would query the smart contract
    // For now, we'll simulate based on token format

    const token = tokenLookup.value.trim()

    // Create a medical record based on the token
    medicalRecord.value = {
      tokenId: token,
      patientName: "Medical Record Patient", // In real app, this would be anonymized
      evaluationType: token.includes('ADOS') ? 'ADOS' : 'ADOS', // Default to ADOS
      uploadDate: new Date().toLocaleDateString(),
      fileSize: "2.1 MB",
      hasAccess: false,
      network: token.startsWith('DEMO_FLARE') ? 'Flare Coston2' : 'XRPL',
      accessCost: 15
    }

    // Don't show payment modal yet - let user see the details first

  } catch (error) {
    console.error('Token lookup failed:', error)
    lookupError.value = `Invalid token ID or token not found: ${error.message}`
  } finally {
    looking.value = false
  }
}

const proceedToPayment = () => {
  if (medicalRecord.value) {
    selectedEvaluation.value = medicalRecord.value
    showPaymentModal.value = true
  }
}

const loadAccessHistory = async () => {
  try {
    accessHistory.value = mockData.accessHistory
  } catch (error) {
    console.error('Failed to load access history:', error)
    accessHistory.value = []
  }
}

const requestAccess = (evaluation) => {
  selectedEvaluation.value = evaluation
  showPaymentModal.value = true
}

const closePaymentModal = () => {
  showPaymentModal.value = false
  selectedEvaluation.value = null
  walletAddress.value = ''
}

const connectWallet = async () => {
  try {
    if (window.ethereum) {
      alert('XRPL wallet connection would be implemented here')
    } else {
      alert('Please install an XRPL-compatible wallet')
    }
  } catch (error) {
    console.error('Wallet connection failed:', error)
  }
}

const processPayment = async () => {
  if (!walletAddress.value || !selectedEvaluation.value || !hospitalAddressConfigured.value) return

  processing.value = true

  try {
    // Step 1: Simulate XRPL payment (in real app, this would be actual payment)
    const xrplTransactionHash = await simulateXRPLPayment({
      amount: 15,
      destination: 'rPlatformWalletAddress123456789',
      source: walletAddress.value
    })

    // Step 2: Grant access on Flare smart contract
    const accessResponse = await blockchainService.grantHospitalAccess({
      tokenId: selectedEvaluation.value.tokenId,
      hospitalAddress: hospitalAddress.value,
      xrplTransactionHash: xrplTransactionHash,
      accessDurationHours: 720 // 30 days
    })

    if (accessResponse.data.success) {
      const newAccess = {
        id: `access_${Date.now()}`,
        patientName: selectedEvaluation.value.patientName,
        evaluationType: selectedEvaluation.value.type,
        accessDate: new Date().toLocaleDateString(),
        expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString(),
        tokenId: selectedEvaluation.value.tokenId,
        xrplTxHash: xrplTransactionHash,
        flareAccessTx: accessResponse.data.flareTransaction
      }

      accessHistory.value.push(newAccess)
      selectedEvaluation.value.hasAccess = true
      closePaymentModal()
      alert(`Payment successful! Access granted until ${accessResponse.data.accessValidUntil}`)
    } else {
      throw new Error('Failed to grant access on blockchain')
    }

  } catch (error) {
    console.error('Payment failed:', error)
    alert(`Payment failed: ${error.response?.data?.error || error.message}`)
  } finally {
    processing.value = false
  }
}

const simulateXRPLPayment = async (paymentIntent) => {
  await new Promise(resolve => setTimeout(resolve, 2000))
  return 'mock_transaction_hash_' + Date.now()
}

const downloadFile = async (evaluation) => {
  downloading.value = true
  selectedEvaluation.value = evaluation

  try {
    await new Promise(resolve => setTimeout(resolve, 1500))

    const dummyContent = `AUTISM EVALUATION REPORT

Patient: ${evaluation.patientName}
Evaluation Type: ${evaluation.type}
Date: ${evaluation.uploadDate}
Token ID: ${evaluation.tokenId}

This is a sample evaluation file downloaded from the XRPL Medical Records Platform.
In a real implementation, this would contain the actual encrypted evaluation data.

--- DEMO DATA ---`

    const blob = new Blob([dummyContent], { type: 'text/plain' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `evaluation_${evaluation.patientName.replace(/\s+/g, '_')}_${evaluation.id}.txt`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)

    alert('File downloaded successfully!')

  } catch (error) {
    console.error('Download failed:', error)
    alert('Download failed. Please try again.')
  } finally {
    downloading.value = false
    selectedEvaluation.value = null
  }
}
</script>

<style scoped>
.hospital-portal {
  min-height: 100vh;
  background: linear-gradient(135deg, #fd79a8 0%, #e84393 100%);
}

.portal-header {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  padding: 2rem;
  text-align: center;
  color: white;
  position: relative;
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
  max-width: 1200px;
  margin: 0 auto;
}

.search-card {
  background: white;
  border-radius: 1rem;
  padding: 2rem;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
  margin-bottom: 2rem;
}

.search-card h2 {
  margin: 0 0 1.5rem 0;
  color: #2d3436;
}

.hospital-setup {
  margin: 1rem 0;
}

.hospital-setup h3 {
  margin: 0 0 1rem 0;
  color: #2d3436;
  text-align: center;
}

.hospital-setup p {
  color: #636e72;
  margin-bottom: 2rem;
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
  border-color: #fd79a8;
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

.confirm-address-btn {
  background: #fd79a8;
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
  background: #e84393;
}

.confirm-address-btn:disabled {
  background: #ddd;
  cursor: not-allowed;
}

.hospital-info {
  background: #f8f9fa;
  padding: 1rem;
  border-radius: 0.5rem;
  margin-bottom: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
}

.hospital-info code {
  background: white;
  padding: 0.3rem 0.5rem;
  border-radius: 0.3rem;
  font-family: monospace;
  word-break: break-all;
}

.change-btn {
  background: #fd79a8;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 0.3rem;
  cursor: pointer;
  font-size: 0.9rem;
}

.search-row {
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
}

.search-input {
  flex: 1;
  padding: 0.8rem;
  border: 1px solid #ddd;
  border-radius: 0.5rem;
  font-size: 1rem;
}

.search-input:focus {
  outline: none;
  border-color: #fd79a8;
}

.search-button {
  background: #fd79a8;
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

.search-button:hover:not(:disabled) {
  background: #e84393;
}

.search-button:disabled {
  background: #ddd;
  cursor: not-allowed;
}

.results-section h2 {
  color: white;
  margin-bottom: 1.5rem;
  font-size: 1.8rem;
}

.evaluations-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  gap: 1.5rem;
}

.evaluation-card {
  background: white;
  border-radius: 1rem;
  padding: 1.5rem;
  box-shadow: 0 5px 20px rgba(0, 0, 0, 0.1);
}

.evaluation-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.evaluation-header h3 {
  margin: 0;
  color: #2d3436;
}

.evaluation-type {
  background: #fd79a8;
  color: white;
  padding: 0.3rem 0.8rem;
  border-radius: 1rem;
  font-size: 0.8rem;
  font-weight: 600;
}

.evaluation-details {
  margin-bottom: 1.5rem;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.label {
  font-weight: 600;
  color: #636e72;
}

.value {
  color: #2d3436;
}

.status-granted {
  color: #00b894;
  font-weight: 600;
}

.status-pending {
  color: #e17055;
  font-weight: 600;
}

.evaluation-actions {
  text-align: center;
}

.access-button, .download-button {
  background: #fd79a8;
  color: white;
  border: none;
  padding: 0.8rem 1.5rem;
  border-radius: 0.5rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.access-button:hover, .download-button:hover {
  background: #e84393;
}

.access-button:disabled, .download-button:disabled {
  background: #ddd;
  cursor: not-allowed;
}

.empty-state {
  text-align: center;
  color: white;
  padding: 4rem 2rem;
}

.empty-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.empty-state h3 {
  margin-bottom: 0.5rem;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.payment-modal {
  background: white;
  border-radius: 1rem;
  max-width: 500px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #eee;
}

.modal-header h3 {
  margin: 0;
  color: #2d3436;
}

.close-button {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #636e72;
}

.modal-content {
  padding: 1.5rem;
}

.payment-summary {
  background: #f8f9fa;
  padding: 1rem;
  border-radius: 0.5rem;
  margin-bottom: 1.5rem;
}

.payment-summary h4 {
  margin: 0 0 0.5rem 0;
  color: #2d3436;
}

.payment-option {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  border: 2px solid #eee;
  border-radius: 0.5rem;
  cursor: pointer;
  margin-bottom: 1rem;
}

.payment-option.selected {
  border-color: #fd79a8;
  background: rgba(253, 121, 168, 0.05);
}

.option-icon {
  font-size: 1.5rem;
}

.option-details h5 {
  margin: 0;
  color: #2d3436;
}

.option-details p {
  margin: 0;
  color: #636e72;
  font-size: 0.9rem;
}

.option-price {
  margin-left: auto;
  font-weight: 600;
  color: #2d3436;
}

.wallet-section h4 {
  margin: 1.5rem 0 1rem 0;
  color: #2d3436;
}

.wallet-input {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.wallet-address-input {
  flex: 1;
  padding: 0.8rem;
  border: 1px solid #ddd;
  border-radius: 0.5rem;
  font-size: 0.9rem;
}

.connect-wallet-button {
  background: #74b9ff;
  color: white;
  border: none;
  padding: 0.8rem 1rem;
  border-radius: 0.5rem;
  cursor: pointer;
  white-space: nowrap;
}

.modal-actions {
  display: flex;
  gap: 1rem;
  margin-top: 2rem;
}

.cancel-button, .pay-button {
  flex: 1;
  padding: 0.8rem;
  border-radius: 0.5rem;
  font-weight: 600;
  cursor: pointer;
  border: none;
}

.cancel-button {
  background: #ddd;
  color: #2d3436;
}

.pay-button {
  background: #fd79a8;
  color: white;
}

.pay-button:disabled {
  background: #ddd;
  cursor: not-allowed;
}

.access-history {
  margin-top: 3rem;
}

.access-history h2 {
  color: white;
  margin-bottom: 1.5rem;
}

.history-list {
  background: white;
  border-radius: 1rem;
  overflow: hidden;
  box-shadow: 0 5px 20px rgba(0, 0, 0, 0.1);
}

.history-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #eee;
}

.history-item:last-child {
  border-bottom: none;
}

.history-details h4 {
  margin: 0 0 0.5rem 0;
  color: #2d3436;
}

.history-details p {
  margin: 0 0 0.3rem 0;
  color: #636e72;
}

.history-details small {
  color: #999;
}

.redownload-button {
  background: #74b9ff;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  cursor: pointer;
  font-size: 0.9rem;
}

.token-input-section {
  background: #f8f9fa;
  padding: 1.5rem;
  border-radius: 0.5rem;
  margin-top: 1.5rem;
}

.token-input-section h3 {
  margin: 0 0 0.5rem 0;
  color: #2d3436;
  font-size: 1.2rem;
}

.token-input-section p {
  margin: 0 0 1.5rem 0;
  color: #636e72;
  font-size: 0.95rem;
}

.token-input-group {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.token-input {
  flex: 1;
  padding: 0.9rem;
  border: 1px solid #ddd;
  border-radius: 0.5rem;
  font-size: 1rem;
  font-family: monospace;
  background: white;
  transition: border-color 0.3s ease;
}

.token-input:focus {
  outline: none;
  border-color: #fd79a8;
  box-shadow: 0 0 0 3px rgba(253, 121, 168, 0.1);
}

.lookup-button {
  background: #fd79a8;
  color: white;
  border: none;
  padding: 0.9rem 1.5rem;
  border-radius: 0.5rem;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.3s ease;
}

.lookup-button:hover:not(:disabled) {
  background: #e84393;
  transform: translateY(-1px);
}

.lookup-button:disabled {
  background: #ddd;
  cursor: not-allowed;
  transform: none;
}

.token-details {
  background: #f8f9fa;
  border: 2px solid #e9ecef;
  border-radius: 0.5rem;
  padding: 1.5rem;
  margin-top: 1.5rem;
}

.token-details h3 {
  margin: 0 0 1rem 0;
  color: #2d3436;
  font-size: 1.2rem;
}

.record-info {
  background: white;
  padding: 1rem;
  border-radius: 0.5rem;
  margin-bottom: 1.5rem;
}

.record-info p {
  margin: 0.5rem 0;
  color: #2d3436;
}

.record-info strong {
  color: #636e72;
  font-weight: 600;
}

.payment-requirement {
  background: rgba(253, 121, 168, 0.1);
  border: 1px solid rgba(253, 121, 168, 0.3);
  border-radius: 0.5rem;
  padding: 1rem;
}

.payment-requirement h4 {
  margin: 0 0 0.5rem 0;
  color: #2d3436;
  font-size: 1.1rem;
}

.payment-requirement p {
  margin: 0 0 1rem 0;
  color: #636e72;
}

.proceed-button {
  background: #fd79a8;
  color: white;
  border: none;
  padding: 0.9rem 1.5rem;
  border-radius: 0.5rem;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.proceed-button:hover {
  background: #e84393;
  transform: translateY(-1px);
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

  .search-row {
    flex-direction: column;
  }

  .evaluations-grid {
    grid-template-columns: 1fr;
  }

  .wallet-input {
    flex-direction: column;
  }

  .modal-actions {
    flex-direction: column;
  }

  .history-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }

  .redownload-button {
    align-self: flex-end;
  }

  .token-input-group {
    flex-direction: column;
    gap: 1rem;
  }

  .lookup-button {
    width: 100%;
  }
}
</style>