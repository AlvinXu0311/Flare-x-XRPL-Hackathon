<template>
  <div class="connection-monitor" :class="{ 'monitor-open': showDetails }">
    <div class="monitor-header" @click="toggleDetails">
      <div class="status-indicator">
        <span class="status-light" :class="overallStatus"></span>
        <span class="status-text">{{ statusText }}</span>
      </div>
      <div class="monitor-toggle">
        <span class="toggle-icon">{{ showDetails ? '▼' : '▶' }}</span>
      </div>
    </div>

    <div v-if="showDetails" class="monitor-details">
      <div class="provider-status">
        <h4>🌐 Provider Health</h4>
        <div class="provider-grid">
          <div
            v-for="(provider, index) in providerStatus"
            :key="index"
            class="provider-item"
            :class="provider.status"
          >
            <div class="provider-header">
              <span class="provider-name">{{ provider.name }}</span>
              <span class="provider-status-badge" :class="provider.status">
                {{ provider.status.toUpperCase() }}
              </span>
            </div>
            <div class="provider-metrics">
              <div class="metric">
                <span class="metric-label">Latency:</span>
                <span class="metric-value">{{ provider.latency }}ms</span>
              </div>
              <div class="metric">
                <span class="metric-label">Uptime:</span>
                <span class="metric-value">{{ provider.uptime }}%</span>
              </div>
              <div class="metric">
                <span class="metric-label">Errors:</span>
                <span class="metric-value">{{ provider.errorCount }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="circuit-breaker-status">
        <h4>⚡ Circuit Breaker Status</h4>
        <div class="breaker-grid">
          <div
            v-for="breaker in circuitBreakers"
            :key="breaker.id"
            class="breaker-item"
            :class="{ 'breaker-open': breaker.isOpen }"
          >
            <div class="breaker-info">
              <span class="breaker-name">{{ breaker.name }}</span>
              <span class="breaker-state" :class="{ 'state-open': breaker.isOpen }">
                {{ breaker.isOpen ? 'OPEN' : 'CLOSED' }}
              </span>
            </div>
            <div class="breaker-metrics">
              <div class="breaker-failures">{{ breaker.failures }} failures</div>
              <div class="breaker-recovery" v-if="breaker.isOpen">
                Recovery in {{ breaker.recoveryTime }}s
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="recent-events">
        <h4>📊 Recent Events</h4>
        <div class="events-list">
          <div
            v-for="event in recentEvents.slice(0, 5)"
            :key="event.id"
            class="event-item"
            :class="event.type"
          >
            <div class="event-time">{{ formatTime(event.timestamp) }}</div>
            <div class="event-message">{{ event.message }}</div>
            <div class="event-type">{{ event.type.toUpperCase() }}</div>
          </div>
        </div>
      </div>

      <div class="monitor-actions">
        <button @click="refreshStatus" class="action-btn refresh-btn" :disabled="refreshing">
          {{ refreshing ? '🔄' : '🔄' }} Refresh
        </button>
        <button @click="testConnection" class="action-btn test-btn" :disabled="testing">
          {{ testing ? '🧪' : '🧪' }} Test Connection
        </button>
        <button @click="resetCircuitBreakers" class="action-btn reset-btn">
          🔧 Reset Breakers
        </button>
        <button @click="exportLogs" class="action-btn export-btn">
          📊 Export Logs
        </button>
      </div>

      <div class="performance-stats">
        <h4>📈 Performance Statistics</h4>
        <div class="stats-grid">
          <div class="stat-item">
            <div class="stat-label">Success Rate</div>
            <div class="stat-value success-rate">{{ performanceStats.successRate }}%</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">Avg Response Time</div>
            <div class="stat-value response-time">{{ performanceStats.avgResponseTime }}ms</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">Total Requests</div>
            <div class="stat-value total-requests">{{ performanceStats.totalRequests }}</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">Failed Requests</div>
            <div class="stat-value failed-requests">{{ performanceStats.failedRequests }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { getFlareProvider, flareTestnetProvider } from '@/utils/robust-web3-provider'

interface ProviderStatus {
  name: string
  status: 'healthy' | 'degraded' | 'failed'
  latency: number
  uptime: number
  errorCount: number
  lastChecked: number
}

interface CircuitBreaker {
  id: string
  name: string
  isOpen: boolean
  failures: number
  recoveryTime: number
}

interface HealthEvent {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
  timestamp: number
}

interface PerformanceStats {
  successRate: number
  avgResponseTime: number
  totalRequests: number
  failedRequests: number
}

// Component state
const showDetails = ref(false)
const refreshing = ref(false)
const testing = ref(false)

const providerStatus = ref<ProviderStatus[]>([])
const circuitBreakers = ref<CircuitBreaker[]>([])
const recentEvents = ref<HealthEvent[]>([])
const performanceStats = ref<PerformanceStats>({
  successRate: 100,
  avgResponseTime: 0,
  totalRequests: 0,
  failedRequests: 0
})

let monitoringInterval: number | null = null

// Computed properties
const overallStatus = computed(() => {
  const healthyCount = providerStatus.value.filter(p => p.status === 'healthy').length
  const totalCount = providerStatus.value.length

  if (healthyCount === totalCount) return 'healthy'
  if (healthyCount > totalCount / 2) return 'degraded'
  return 'failed'
})

const statusText = computed(() => {
  const status = overallStatus.value
  const healthyCount = providerStatus.value.filter(p => p.status === 'healthy').length
  const totalCount = providerStatus.value.length

  switch (status) {
    case 'healthy':
      return `All systems operational (${healthyCount}/${totalCount})`
    case 'degraded':
      return `Partial service available (${healthyCount}/${totalCount})`
    case 'failed':
      return `Service degraded (${healthyCount}/${totalCount})`
    default:
      return 'Status unknown'
  }
})

// Methods
const toggleDetails = () => {
  showDetails.value = !showDetails.value
}

const refreshStatus = async () => {
  refreshing.value = true
  try {
    await updateProviderStatus()
    await updateCircuitBreakerStatus()
    addEvent('info', 'Status refreshed successfully')
  } catch (error) {
    addEvent('error', `Failed to refresh status: ${error.message}`)
  } finally {
    refreshing.value = false
  }
}

const testConnection = async () => {
  testing.value = true
  try {
    const provider = getFlareProvider('testnet')
    const startTime = Date.now()

    // Test basic connectivity
    const blockNumber = await provider.executeWithRetry(
      async (p) => p.getBlockNumber(),
      'Test Connection'
    )

    const responseTime = Date.now() - startTime
    addEvent('success', `Connection test successful (block: ${blockNumber}, ${responseTime}ms)`)

    // Update performance stats
    performanceStats.value.totalRequests++
    performanceStats.value.avgResponseTime =
      (performanceStats.value.avgResponseTime + responseTime) / 2

  } catch (error) {
    addEvent('error', `Connection test failed: ${error.message}`)
    performanceStats.value.failedRequests++
    performanceStats.value.totalRequests++
  } finally {
    testing.value = false
  }

  updatePerformanceStats()
}

const resetCircuitBreakers = () => {
  circuitBreakers.value.forEach(breaker => {
    breaker.isOpen = false
    breaker.failures = 0
    breaker.recoveryTime = 0
  })
  addEvent('info', 'All circuit breakers reset')
}

const exportLogs = () => {
  const data = {
    timestamp: new Date().toISOString(),
    providerStatus: providerStatus.value,
    circuitBreakers: circuitBreakers.value,
    recentEvents: recentEvents.value,
    performanceStats: performanceStats.value
  }

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `connection-health-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)

  addEvent('info', 'Health logs exported')
}

const updateProviderStatus = async () => {
  try {
    const provider = getFlareProvider('testnet')
    const status = provider.getConnectionStatus()
    const detailedHealth = provider.getDetailedHealth()

    providerStatus.value = detailedHealth.providers.map((p, index) => ({
      name: `Provider ${index + 1}`,
      status: p.isHealthy ? 'healthy' : (p.circuitOpen ? 'failed' : 'degraded'),
      latency: p.latency,
      uptime: Math.max(0, 100 - p.errorRate * 100),
      errorCount: p.failureCount,
      lastChecked: Date.now()
    }))

  } catch (error) {
    console.error('Failed to update provider status:', error)
  }
}

const updateCircuitBreakerStatus = () => {
  // Mock circuit breaker data - in real implementation, get from robust provider
  circuitBreakers.value = [
    {
      id: 'main-rpc',
      name: 'Main RPC Endpoint',
      isOpen: Math.random() < 0.1, // 10% chance of being open
      failures: Math.floor(Math.random() * 5),
      recoveryTime: Math.floor(Math.random() * 30)
    },
    {
      id: 'backup-rpc',
      name: 'Backup RPC Endpoint',
      isOpen: Math.random() < 0.05, // 5% chance of being open
      failures: Math.floor(Math.random() * 3),
      recoveryTime: Math.floor(Math.random() * 15)
    },
    {
      id: 'web3-provider',
      name: 'Web3 Provider',
      isOpen: Math.random() < 0.02, // 2% chance of being open
      failures: Math.floor(Math.random() * 2),
      recoveryTime: Math.floor(Math.random() * 10)
    }
  ]
}

const updatePerformanceStats = () => {
  const total = performanceStats.value.totalRequests
  const failed = performanceStats.value.failedRequests
  performanceStats.value.successRate = total > 0 ? ((total - failed) / total) * 100 : 100
}

const addEvent = (type: HealthEvent['type'], message: string) => {
  const event: HealthEvent = {
    id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type,
    message,
    timestamp: Date.now()
  }

  recentEvents.value.unshift(event)

  // Keep only last 20 events
  if (recentEvents.value.length > 20) {
    recentEvents.value = recentEvents.value.slice(0, 20)
  }
}

const formatTime = (timestamp: number): string => {
  return new Date(timestamp).toLocaleTimeString()
}

const startMonitoring = () => {
  // Initial status update
  refreshStatus()

  // Set up periodic monitoring
  monitoringInterval = window.setInterval(() => {
    updateProviderStatus()
    updateCircuitBreakerStatus()
  }, 30000) // Update every 30 seconds
}

const stopMonitoring = () => {
  if (monitoringInterval) {
    clearInterval(monitoringInterval)
    monitoringInterval = null
  }
}

// Lifecycle
onMounted(() => {
  startMonitoring()
})

onUnmounted(() => {
  stopMonitoring()
})
</script>

<style scoped>
.connection-monitor {
  position: fixed;
  top: 20px;
  right: 20px;
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  min-width: 300px;
  max-width: 500px;
  z-index: 1000;
}

.monitor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  cursor: pointer;
  background: #f8f9fa;
  border-radius: 8px 8px 0 0;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-light {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  animation: pulse 2s infinite;
}

.status-light.healthy {
  background: #4caf50;
}

.status-light.degraded {
  background: #ff9800;
}

.status-light.failed {
  background: #f44336;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.status-text {
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.toggle-icon {
  color: #666;
  font-size: 12px;
}

.monitor-details {
  padding: 16px;
  max-height: 70vh;
  overflow-y: auto;
}

.provider-grid, .breaker-grid {
  display: grid;
  gap: 12px;
  margin-top: 8px;
}

.provider-item, .breaker-item {
  padding: 12px;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  background: #fafafa;
}

.provider-item.healthy {
  border-left: 4px solid #4caf50;
}

.provider-item.degraded {
  border-left: 4px solid #ff9800;
}

.provider-item.failed {
  border-left: 4px solid #f44336;
}

.provider-header, .breaker-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.provider-name, .breaker-name {
  font-weight: 600;
  color: #333;
  font-size: 13px;
}

.provider-status-badge, .breaker-state {
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
}

.provider-status-badge.healthy {
  background: #e8f5e8;
  color: #2e7d32;
}

.provider-status-badge.degraded {
  background: #fff3e0;
  color: #f57c00;
}

.provider-status-badge.failed {
  background: #ffebee;
  color: #c62828;
}

.breaker-state.state-open {
  background: #ffebee;
  color: #c62828;
}

.provider-metrics, .breaker-metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
  gap: 8px;
}

.metric {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.metric-label {
  font-size: 11px;
  color: #666;
}

.metric-value {
  font-size: 12px;
  font-weight: 600;
  color: #333;
}

.events-list {
  max-height: 200px;
  overflow-y: auto;
  margin-top: 8px;
}

.event-item {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 8px;
  padding: 8px;
  border-left: 3px solid #e0e0e0;
  margin-bottom: 4px;
  font-size: 12px;
}

.event-item.success {
  border-left-color: #4caf50;
}

.event-item.error {
  border-left-color: #f44336;
}

.event-item.warning {
  border-left-color: #ff9800;
}

.event-item.info {
  border-left-color: #2196f3;
}

.event-time {
  color: #666;
  white-space: nowrap;
}

.event-message {
  color: #333;
}

.event-type {
  font-weight: 600;
  color: #666;
  font-size: 10px;
}

.monitor-actions {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  margin: 16px 0;
}

.action-btn {
  padding: 8px 12px;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  background: white;
  color: #333;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn:hover:not(:disabled) {
  background: #f0f0f0;
  border-color: #ccc;
}

.action-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-top: 8px;
}

.stat-item {
  text-align: center;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 6px;
}

.stat-label {
  font-size: 11px;
  color: #666;
  margin-bottom: 4px;
}

.stat-value {
  font-size: 16px;
  font-weight: 700;
  color: #333;
}

.success-rate {
  color: #4caf50;
}

.response-time {
  color: #2196f3;
}

.total-requests {
  color: #9c27b0;
}

.failed-requests {
  color: #f44336;
}

h4 {
  margin: 16px 0 8px 0;
  font-size: 14px;
  color: #333;
  border-bottom: 1px solid #e0e0e0;
  padding-bottom: 4px;
}

h4:first-child {
  margin-top: 0;
}
</style>