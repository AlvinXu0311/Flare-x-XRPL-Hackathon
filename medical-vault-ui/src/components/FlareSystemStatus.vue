<template>
  <div class="flare-system-status">
    <h3>🔥 Flare Network Integration Status</h3>

    <div class="status-grid">
      <!-- Contract Registry Status -->
      <div class="status-card">
        <div class="status-header">
          <span class="status-icon">📋</span>
          <h4>Contract Registry</h4>
          <span class="status-indicator" :class="{ active: systemStatus.registryConnected }">
            {{ systemStatus.registryConnected ? '✅' : '❌' }}
          </span>
        </div>
        <div class="status-details">
          <p>Address: <code>0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019</code></p>
          <p>Status: {{ systemStatus.registryConnected ? 'Connected' : 'Disconnected' }}</p>
        </div>
      </div>

      <!-- FDC Hub Status -->
      <div class="status-card">
        <div class="status-header">
          <span class="status-icon">🔗</span>
          <h4>FDC Hub</h4>
          <span class="status-indicator" :class="{ active: systemStatus.fdcHubAvailable }">
            {{ systemStatus.fdcHubAvailable ? '✅' : '❌' }}
          </span>
        </div>
        <div class="status-details">
          <p>Service: First-party Data Connector</p>
          <p>Status: {{ systemStatus.fdcHubAvailable ? 'Available' : 'Not Available' }}</p>
        </div>
      </div>

      <!-- FDC Verification Status -->
      <div class="status-card">
        <div class="status-header">
          <span class="status-icon">✅</span>
          <h4>FDC Verification</h4>
          <span class="status-indicator" :class="{ active: systemStatus.fdcVerificationAvailable }">
            {{ systemStatus.fdcVerificationAvailable ? '✅' : '❌' }}
          </span>
        </div>
        <div class="status-details">
          <p>Service: Proof Verification</p>
          <p>Status: {{ systemStatus.fdcVerificationAvailable ? 'Available' : 'Not Available' }}</p>
        </div>
      </div>

      <!-- FTSO v2 Status -->
      <div class="status-card">
        <div class="status-header">
          <span class="status-icon">📊</span>
          <h4>FTSO v2</h4>
          <span class="status-indicator" :class="{ active: systemStatus.ftsoV2Available }">
            {{ systemStatus.ftsoV2Available ? '✅' : '❌' }}
          </span>
        </div>
        <div class="status-details">
          <p>Service: Price Feeds</p>
          <p>Status: {{ systemStatus.ftsoV2Available ? 'Available' : 'Not Available' }}</p>
          <p v-if="xrpPrice">Current XRP Price: ${{ xrpPrice.price.toFixed(4) }}</p>
        </div>
      </div>
    </div>

    <!-- Overall Status -->
    <div class="overall-status">
      <div class="status-summary" :class="overallStatusClass">
        <span class="status-icon">{{ overallStatusIcon }}</span>
        <div class="summary-text">
          <h4>{{ overallStatusText }}</h4>
          <p>{{ overallStatusDescription }}</p>
        </div>
      </div>
    </div>

    <!-- Available Contracts -->
    <div v-if="systemStatus.contracts.names.length > 0" class="available-contracts">
      <h4>📋 Available Flare Contracts</h4>
      <div class="contracts-list">
        <div
          v-for="(name, index) in systemStatus.contracts.names"
          :key="name"
          class="contract-item"
        >
          <span class="contract-name">{{ name }}</span>
          <code class="contract-address">{{ systemStatus.contracts.addresses[index] }}</code>
        </div>
      </div>
    </div>

    <!-- Refresh Button -->
    <div class="actions">
      <button @click="refreshStatus" :disabled="loading" class="refresh-btn">
        {{ loading ? '🔄 Checking...' : '🔄 Refresh Status' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { realFdcService } from '@/utils/real-fdc-service'

// Reactive state
const loading = ref(false)
const systemStatus = ref({
  registryConnected: false,
  fdcHubAvailable: false,
  fdcVerificationAvailable: false,
  ftsoV2Available: false,
  contracts: { names: [] as string[], addresses: [] as string[] }
})

const xrpPrice = ref<{ price: number; timestamp: number; decimals: number } | null>(null)

// Computed properties
const overallStatusClass = computed(() => {
  const { registryConnected, fdcHubAvailable, fdcVerificationAvailable, ftsoV2Available } = systemStatus.value

  if (registryConnected && fdcHubAvailable && fdcVerificationAvailable && ftsoV2Available) {
    return 'status-excellent'
  } else if (registryConnected && (fdcHubAvailable || ftsoV2Available)) {
    return 'status-good'
  } else if (registryConnected) {
    return 'status-limited'
  } else {
    return 'status-poor'
  }
})

const overallStatusIcon = computed(() => {
  const className = overallStatusClass.value
  switch (className) {
    case 'status-excellent': return '🟢'
    case 'status-good': return '🟡'
    case 'status-limited': return '🟠'
    case 'status-poor': return '🔴'
    default: return '⚫'
  }
})

const overallStatusText = computed(() => {
  const className = overallStatusClass.value
  switch (className) {
    case 'status-excellent': return 'Excellent - Full Flare Integration'
    case 'status-good': return 'Good - Partial Flare Integration'
    case 'status-limited': return 'Limited - Basic Flare Connection'
    case 'status-poor': return 'Poor - No Flare Connection'
    default: return 'Unknown Status'
  }
})

const overallStatusDescription = computed(() => {
  const className = overallStatusClass.value
  switch (className) {
    case 'status-excellent':
      return 'All Flare services are available. Real FDC attestations and FTSO price feeds are working.'
    case 'status-good':
      return 'Some Flare services are available. Limited real FDC functionality.'
    case 'status-limited':
      return 'Basic Flare connection established. FDC services may not be available.'
    case 'status-poor':
      return 'Cannot connect to Flare network. Using fallback functionality.'
    default:
      return 'Status unknown. Check network connection.'
  }
})

// Methods
const refreshStatus = async () => {
  loading.value = true

  try {
    console.log('🔄 Refreshing Flare system status...')

    // Get system status
    const status = await realFdcService.getSystemStatus()
    systemStatus.value = status

    console.log('✅ System status updated:', status)

    // Try to get XRP price if FTSO is available
    if (status.ftsoV2Available) {
      try {
        const priceData = await realFdcService.getCurrentXrpPrice()
        xrpPrice.value = {
          price: parseFloat(priceData.price) / Math.pow(10, priceData.decimals),
          timestamp: priceData.timestamp,
          decimals: priceData.decimals
        }
        console.log('✅ XRP price loaded:', xrpPrice.value)
      } catch (error) {
        console.warn('⚠️ Could not load XRP price:', error)
        xrpPrice.value = null
      }
    }

  } catch (error) {
    console.error('❌ Failed to refresh system status:', error)
  } finally {
    loading.value = false
  }
}

// Initialize on mount
onMounted(() => {
  refreshStatus()
})
</script>

<style scoped>
.flare-system-status {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 4px 20px rgba(0,0,0,0.1);
  margin: 2rem 0;
}

.flare-system-status h3 {
  color: #2c3e50;
  margin-bottom: 2rem;
  text-align: center;
  border-bottom: 2px solid #f39c12;
  padding-bottom: 1rem;
}

.status-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.status-card {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 1.5rem;
  transition: all 0.3s ease;
}

.status-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.status-header {
  display: flex;
  align-items: center;
  margin-bottom: 1rem;
  gap: 0.5rem;
}

.status-header h4 {
  flex: 1;
  margin: 0;
  color: #2c3e50;
  font-size: 1.1rem;
}

.status-icon {
  font-size: 1.5rem;
}

.status-indicator {
  font-size: 1.2rem;
  transition: all 0.3s ease;
}

.status-indicator.active {
  transform: scale(1.2);
}

.status-details {
  font-size: 0.9rem;
  color: #6c757d;
}

.status-details p {
  margin: 0.5rem 0;
}

.status-details code {
  background: #e9ecef;
  padding: 0.2rem 0.4rem;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
  font-size: 0.8rem;
  word-break: break-all;
}

.overall-status {
  margin: 2rem 0;
}

.status-summary {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.5rem;
  border-radius: 8px;
  transition: all 0.3s ease;
}

.status-excellent {
  background: linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%);
  border: 1px solid #28a745;
}

.status-good {
  background: linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%);
  border: 1px solid #ffc107;
}

.status-limited {
  background: linear-gradient(135deg, #fdeaa7 0%, #fdcb6e 100%);
  border: 1px solid #fd7e14;
}

.status-poor {
  background: linear-gradient(135deg, #f8d7da 0%, #f5c6cb 100%);
  border: 1px solid #dc3545;
}

.summary-text h4 {
  margin: 0 0 0.5rem 0;
  color: #2c3e50;
}

.summary-text p {
  margin: 0;
  color: #6c757d;
  font-size: 0.9rem;
}

.available-contracts {
  margin: 2rem 0;
  padding: 1.5rem;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.available-contracts h4 {
  margin: 0 0 1rem 0;
  color: #2c3e50;
}

.contracts-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  max-height: 200px;
  overflow-y: auto;
}

.contract-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  background: white;
  border: 1px solid #e9ecef;
  border-radius: 6px;
  transition: background 0.3s ease;
}

.contract-item:hover {
  background: #e9ecef;
}

.contract-name {
  font-weight: 600;
  color: #495057;
  flex: 1;
}

.contract-address {
  font-family: 'Courier New', monospace;
  font-size: 0.8rem;
  background: #e9ecef;
  padding: 0.3rem 0.6rem;
  border-radius: 4px;
  color: #6c757d;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.actions {
  text-align: center;
  margin-top: 2rem;
}

.refresh-btn {
  background: #007bff;
  color: white;
  border: none;
  padding: 0.75rem 2rem;
  border-radius: 25px;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 500;
  transition: all 0.3s ease;
}

.refresh-btn:hover:not(:disabled) {
  background: #0056b3;
  transform: translateY(-2px);
}

.refresh-btn:disabled {
  background: #6c757d;
  cursor: not-allowed;
  transform: none;
}

@media (max-width: 768px) {
  .status-grid {
    grid-template-columns: 1fr;
  }

  .contract-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }

  .contract-address {
    max-width: 100%;
  }

  .status-summary {
    flex-direction: column;
    text-align: center;
  }
}
</style>