<template>
  <div class="smart-account-wallet">
    <div class="wallet-header">
      <h3>🔗 Flare Smart Account</h3>
      <div class="account-toggle">
        <label class="toggle-switch">
          <input type="checkbox" v-model="useSmartAccount" @change="handleToggle">
          <span class="slider"></span>
        </label>
        <span class="toggle-label">{{ useSmartAccount ? 'Smart Account' : 'Traditional XRP' }}</span>
      </div>
    </div>

    <!-- Smart Account Active -->
    <div v-if="useSmartAccount && smartAccount" class="smart-account-info">
      <div class="account-details">
        <div class="detail-row">
          <span class="label">Flare Address:</span>
          <span class="value hash-display">{{ smartAccount.flareAddress }}</span>
          <button @click="copyToClipboard(smartAccount.flareAddress)" class="copy-btn">Copy</button>
        </div>

        <div class="detail-row">
          <span class="label">Linked XRP Address:</span>
          <span class="value hash-display">{{ smartAccount.xrplAddress }}</span>
          <button @click="copyToClipboard(smartAccount.xrplAddress)" class="copy-btn">Copy</button>
        </div>

        <div class="balance-section">
          <h4>💰 Cross-Chain Balances</h4>
          <div class="balance-grid">
            <div class="balance-item">
              <span class="currency">FLR</span>
              <span class="amount">{{ smartAccount.balance.flare }}</span>
              <button @click="refreshBalances" class="refresh-btn" :disabled="balanceLoading">🔄</button>
            </div>
            <div class="balance-item">
              <span class="currency">XRP</span>
              <span class="amount">{{ smartAccount.balance.xrp }}</span>
            </div>
          </div>
        </div>

        <div class="capabilities-section">
          <h4>⚡ Smart Account Capabilities</h4>
          <div class="capability-tags">
            <span v-for="capability in smartAccount.capabilities" :key="capability" class="capability-tag">
              {{ formatCapability(capability) }}
            </span>
          </div>
        </div>
      </div>

      <!-- Quick Actions -->
      <div class="quick-actions">
        <h4>🚀 Quick Actions</h4>
        <div class="action-buttons">
          <button @click="testXrpPayment" class="action-btn">
            💸 Test XRP Payment
          </button>
          <button @click="syncBalances" class="action-btn">
            🔄 Sync Balances
          </button>
          <button @click="viewTransactionHistory" class="action-btn">
            📊 View History
          </button>
          <button @click="configureAccount" class="action-btn">
            ⚙️ Configure
          </button>
        </div>
      </div>

      <!-- Cross-Chain Transactions -->
      <div v-if="crossChainTransactions.length > 0" class="transaction-history">
        <h4>🌉 Recent Cross-Chain Transactions</h4>
        <div class="transaction-list">
          <div v-for="tx in crossChainTransactions.slice(0, 5)" :key="tx.id" class="transaction-item" :class="tx.status">
            <div class="tx-header">
              <span class="tx-type">{{ formatTransactionType(tx.type) }}</span>
              <span class="tx-status" :class="tx.status">{{ tx.status.toUpperCase() }}</span>
            </div>
            <div class="tx-details">
              <p><strong>Amount:</strong> {{ tx.amount }} {{ tx.currency }}</p>
              <p><strong>Time:</strong> {{ formatTime(tx.timestamp) }}</p>
              <p v-if="tx.flareTransaction">
                <strong>Flare Tx:</strong> {{ tx.flareTransaction.substring(0, 16) }}...
                <a :href="getFlareExplorerUrl(tx.flareTransaction)" target="_blank" class="tx-link">🔍</a>
              </p>
              <p v-if="tx.xrplTransaction">
                <strong>XRPL Tx:</strong> {{ tx.xrplTransaction.substring(0, 16) }}...
                <a :href="getXrpExplorerUrl(tx.xrplTransaction)" target="_blank" class="tx-link">💎</a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Smart Account Loading -->
    <div v-else-if="useSmartAccount && smartAccountLoading" class="smart-account-loading">
      <div class="loading-spinner"></div>
      <p>Initializing smart account...</p>
      <small>Creating Flare-XRP bridge connection</small>
    </div>

    <!-- Smart Account Creation -->
    <div v-else-if="useSmartAccount && !smartAccount && !smartAccountLoading" class="smart-account-create">
      <div class="create-prompt">
        <h4>🆕 Create Smart Account</h4>
        <p>Create a Flare smart account to manage XRP payments with enhanced features:</p>
        <ul class="feature-list">
          <li>✅ Cross-chain XRP payments via Flare</li>
          <li>✅ FDC-verified transactions</li>
          <li>✅ Automated payment processing</li>
          <li>✅ Real-time balance synchronization</li>
          <li>✅ Gas-efficient operations</li>
        </ul>
        <button @click="createSmartAccount" class="create-btn" :disabled="smartAccountLoading">
          🚀 Create Smart Account
        </button>
      </div>
    </div>

    <!-- Traditional XRP Mode -->
    <div v-else class="traditional-xrp">
      <div class="traditional-info">
        <h4>💰 Traditional XRP Wallet</h4>
        <p>Using direct XRPL integration</p>
        <div class="upgrade-prompt">
          <p>💡 <strong>Upgrade to Smart Account for:</strong></p>
          <ul>
            <li>Enhanced security with Flare verification</li>
            <li>Cross-chain transaction coordination</li>
            <li>Automated compliance checking</li>
            <li>Lower operational complexity</li>
          </ul>
          <button @click="enableSmartAccount" class="upgrade-btn">
            ⬆️ Upgrade to Smart Account
          </button>
        </div>
      </div>
    </div>

    <!-- Payment Integration Interface -->
    <div v-if="smartAccount" class="payment-integration">
      <h4>💳 Payment Integration</h4>
      <div class="integration-options">
        <div class="option-card" :class="{ active: paymentMode === 'smart_account' }">
          <input type="radio" id="smart_payment" name="paymentMode" value="smart_account" v-model="paymentMode">
          <label for="smart_payment">
            <strong>🧠 Smart Account Payments</strong>
            <small>Flare-coordinated XRP payments with automatic verification</small>
          </label>
        </div>
        <div class="option-card" :class="{ active: paymentMode === 'direct_xrpl' }">
          <input type="radio" id="direct_payment" name="paymentMode" value="direct_xrpl" v-model="paymentMode">
          <label for="direct_payment">
            <strong>⚡ Direct XRPL</strong>
            <small>Traditional XRPL payments with manual verification</small>
          </label>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { flareXrpSmartAccountService, type FlareXrpSmartAccount, type CrossChainTransaction } from '@/utils/flare-xrp-smart-account'

// Props
interface Props {
  hospitalId?: string
  hospitalName?: string
}

const props = withDefaults(defineProps<Props>(), {
  hospitalId: '',
  hospitalName: ''
})

// Emits
const emit = defineEmits<{
  smartAccountCreated: [account: FlareXrpSmartAccount]
  paymentModeChanged: [mode: string]
  balanceUpdated: [balances: { flare: string, xrp: string }]
}>()

// State
const useSmartAccount = ref(true)
const smartAccount = ref<FlareXrpSmartAccount | null>(null)
const smartAccountLoading = ref(false)
const balanceLoading = ref(false)
const crossChainTransactions = ref<CrossChainTransaction[]>([])
const paymentMode = ref('smart_account')

// Handle toggle between smart account and traditional XRP
const handleToggle = async () => {
  if (useSmartAccount.value && !smartAccount.value) {
    await initializeSmartAccount()
  }
  emit('paymentModeChanged', useSmartAccount.value ? 'smart_account' : 'traditional')
}

// Initialize smart account
const initializeSmartAccount = async () => {
  if (!props.hospitalId) {
    console.warn('No hospital ID provided for smart account creation')
    return
  }

  smartAccountLoading.value = true

  try {
    console.log('🔄 Initializing smart account for hospital:', props.hospitalId)

    const { smartAccount: newAccount, config } = await flareXrpSmartAccountService.createHospitalUnifiedAccount(
      props.hospitalId,
      props.hospitalName
    )

    smartAccount.value = newAccount
    emit('smartAccountCreated', newAccount)

    // Initial balance sync
    await refreshBalances()

    console.log('✅ Smart account initialized:', newAccount)

  } catch (error) {
    console.error('❌ Failed to initialize smart account:', error)
    useSmartAccount.value = false
    alert(`Smart account creation failed: ${error.message}`)
  } finally {
    smartAccountLoading.value = false
  }
}

// Create smart account
const createSmartAccount = async () => {
  await initializeSmartAccount()
}

// Enable smart account
const enableSmartAccount = () => {
  useSmartAccount.value = true
}

// Refresh balances
const refreshBalances = async () => {
  if (!smartAccount.value) return

  balanceLoading.value = true

  try {
    await flareXrpSmartAccountService.syncCrossChainBalances(smartAccount.value)
    emit('balanceUpdated', smartAccount.value.balance)
  } catch (error) {
    console.error('Failed to refresh balances:', error)
  } finally {
    balanceLoading.value = false
  }
}

// Sync balances
const syncBalances = refreshBalances

// Test XRP payment
const testXrpPayment = async () => {
  if (!smartAccount.value) return

  try {
    console.log('🧪 Testing XRP payment via smart account...')

    // Use real XRPL payment service for actual payment
    const { xrplPaymentService } = await import('@/utils/xrpl-payment-service')

    const paymentRequest = await xrplPaymentService.createPaymentRequest(
      1.00, // $1 test payment
      {
        type: 'smart_account_test',
        description: 'Smart account test payment',
        timestamp: Date.now(),
        hospitalId: props.hospitalId
      }
    )

    const testTransaction = await flareXrpSmartAccountService.initiateXrpPayment(
      smartAccount.value,
      paymentRequest.destinationAddress,
      1.00,
      paymentRequest.memo
    )

    crossChainTransactions.value.unshift(testTransaction)
    console.log('✅ Test payment initiated:', testTransaction)

  } catch (error) {
    console.error('❌ Test payment failed:', error)
    alert(`Test payment failed: ${error.message}`)
  }
}

// View transaction history
const viewTransactionHistory = () => {
  console.log('📊 Viewing transaction history:', crossChainTransactions.value)
  // Could open a modal or navigate to a detailed view
}

// Configure account
const configureAccount = () => {
  console.log('⚙️ Opening account configuration')
  // Could open configuration modal
}

// Utility functions
const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text)
    console.log('📋 Copied to clipboard:', text.substring(0, 10) + '...')
  } catch (error) {
    console.error('Failed to copy to clipboard:', error)
  }
}

const formatCapability = (capability: string): string => {
  return capability.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

const formatTransactionType = (type: string): string => {
  const types = {
    'xrp_payment': '💸 XRP Payment',
    'xrp_receive': '💰 XRP Receive',
    'flare_verify': '🔍 Flare Verify'
  }
  return types[type] || type
}

const formatTime = (timestamp: number): string => {
  return new Date(timestamp).toLocaleTimeString()
}

// Get Flare explorer URL
const getFlareExplorerUrl = (txHash: string): string => {
  return `https://coston2-explorer.flare.network/tx/${txHash}`
}

// Get XRP explorer URL
const getXrpExplorerUrl = (txHash: string): string => {
  return `https://testnet.xrpl.org/transactions/${txHash}`
}

// Watch for payment mode changes
watch(paymentMode, (newMode) => {
  emit('paymentModeChanged', newMode)
})

// Initialize on mount
onMounted(async () => {
  if (useSmartAccount.value && props.hospitalId) {
    // Try to load existing smart account
    try {
      // Implementation for loading existing account
    } catch (error) {
      console.log('No existing smart account found')
    }
  }
})
</script>

<style scoped>
.smart-account-wallet {
  border: 1px solid #e0e0e0;
  border-radius: 12px;
  padding: 20px;
  margin: 20px 0;
  background: linear-gradient(135deg, #f8f9ff 0%, #ffffff 100%);
}

.wallet-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.account-toggle {
  display: flex;
  align-items: center;
  gap: 10px;
}

.toggle-switch {
  position: relative;
  display: inline-block;
  width: 60px;
  height: 34px;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #ccc;
  transition: .4s;
  border-radius: 34px;
}

.slider:before {
  position: absolute;
  content: "";
  height: 26px;
  width: 26px;
  left: 4px;
  bottom: 4px;
  background-color: white;
  transition: .4s;
  border-radius: 50%;
}

input:checked + .slider {
  background-color: #4CAF50;
}

input:checked + .slider:before {
  transform: translateX(26px);
}

.account-details {
  background: white;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 20px;
  border: 1px solid #f0f0f0;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding: 8px 0;
  border-bottom: 1px solid #f5f5f5;
}

.detail-row:last-child {
  border-bottom: none;
}

.label {
  font-weight: 600;
  color: #666;
}

.value {
  font-family: monospace;
  color: #333;
}

.hash-display {
  font-size: 12px;
  background: #f8f9fa;
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid #e9ecef;
}

.copy-btn {
  background: #007bff;
  color: white;
  border: none;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.copy-btn:hover {
  background: #0056b3;
}

.balance-section {
  margin: 20px 0;
}

.balance-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
  margin-top: 10px;
}

.balance-item {
  background: #f8f9ff;
  padding: 15px;
  border-radius: 8px;
  text-align: center;
  border: 1px solid #e0e5ff;
}

.currency {
  display: block;
  font-weight: 600;
  color: #666;
  margin-bottom: 5px;
}

.amount {
  display: block;
  font-size: 18px;
  font-weight: 700;
  color: #333;
}

.refresh-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 14px;
  margin-left: 10px;
}

.capabilities-section {
  margin: 20px 0;
}

.capability-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.capability-tag {
  background: #e3f2fd;
  color: #1976d2;
  padding: 4px 12px;
  border-radius: 16px;
  font-size: 12px;
  font-weight: 500;
}

.quick-actions {
  background: white;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.action-buttons {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 10px;
  margin-top: 15px;
}

.action-btn {
  background: #f8f9ff;
  border: 1px solid #e0e5ff;
  padding: 12px 16px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
}

.action-btn:hover {
  background: #e3f2fd;
  border-color: #bbdefb;
}

.transaction-history {
  background: white;
  padding: 20px;
  border-radius: 8px;
}

.transaction-list {
  margin-top: 15px;
}

.transaction-item {
  padding: 12px;
  border: 1px solid #f0f0f0;
  border-radius: 8px;
  margin-bottom: 10px;
}

.transaction-item.completed {
  border-left: 4px solid #4caf50;
}

.transaction-item.pending {
  border-left: 4px solid #ff9800;
}

.transaction-item.failed {
  border-left: 4px solid #f44336;
}

.tx-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.tx-type {
  font-weight: 600;
  color: #333;
}

.tx-status {
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
}

.tx-status.completed {
  background: #e8f5e8;
  color: #2e7d32;
}

.tx-status.pending {
  background: #fff3e0;
  color: #f57c00;
}

.tx-status.failed {
  background: #ffebee;
  color: #c62828;
}

.tx-details {
  font-size: 13px;
  color: #666;
}

.tx-details p {
  margin: 4px 0;
}

.smart-account-loading {
  text-align: center;
  padding: 40px;
  color: #666;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 20px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.smart-account-create {
  text-align: center;
  padding: 30px;
}

.feature-list {
  text-align: left;
  max-width: 400px;
  margin: 20px auto;
}

.feature-list li {
  margin: 8px 0;
  color: #666;
}

.create-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 15px 30px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  margin-top: 20px;
}

.create-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.traditional-xrp {
  padding: 30px;
  text-align: center;
}

.upgrade-prompt {
  background: #f8f9ff;
  padding: 20px;
  border-radius: 8px;
  margin-top: 20px;
  border: 1px solid #e0e5ff;
}

.upgrade-prompt ul {
  text-align: left;
  max-width: 300px;
  margin: 15px auto;
}

.upgrade-btn {
  background: #4caf50;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  margin-top: 15px;
}

.upgrade-btn:hover {
  background: #45a049;
}

.payment-integration {
  background: white;
  padding: 20px;
  border-radius: 8px;
  margin-top: 20px;
  border: 1px solid #f0f0f0;
}

.integration-options {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
  margin-top: 15px;
}

.option-card {
  padding: 15px;
  border: 2px solid #f0f0f0;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.option-card.active {
  border-color: #4caf50;
  background: #f8fff8;
}

.option-card label {
  cursor: pointer;
  display: block;
}

.option-card input[type="radio"] {
  margin-right: 10px;
}

.option-card strong {
  display: block;
  margin-bottom: 5px;
}

.option-card small {
  color: #666;
  font-size: 12px;
}

.tx-link {
  color: #007bff;
  text-decoration: none;
  margin-left: 8px;
  font-size: 14px;
}

.tx-link:hover {
  text-decoration: underline;
}
</style>