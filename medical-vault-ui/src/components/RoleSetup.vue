<template>
  <div class="role-setup">
    <div class="setup-card">
      <h2>🔧 Contract Role Setup</h2>
      <p class="warning">⚠️ Only contract owner can perform these actions</p>

      <div class="current-account">
        <strong>Current Account:</strong> {{ account }}
      </div>

      <!-- Live Notifications -->
      <div v-if="eventNotifications.length > 0" class="notifications-section">
        <h3>📡 Live Updates</h3>
        <div v-for="notification in eventNotifications" :key="notification.id"
             :class="`notification notification-${notification.type}`">
          <span class="notification-title">{{ notification.title }}</span>
          <p class="notification-message">{{ notification.message }}</p>
          <button @click="removeNotification(notification.id)" class="notification-close">×</button>
        </div>
      </div>

      <!-- Patient ID Management -->
      <div class="setup-section patient-id-section">
        <h3>👤 Patient ID Management</h3>

        <!-- Strategy Selection -->
        <div class="form-group">
          <label>ID Generation Strategy:</label>
          <select v-model="idGenerationStrategy" class="input-field">
            <option value="high_entropy">🔒 High Entropy (Recommended)</option>
            <option value="uuid_blockchain">⛓️ UUID + Blockchain</option>
            <option value="crypto_sequential">🔢 Crypto Sequential</option>
            <option value="timestamp_random">⏰ Timestamp + Random</option>
            <option value="deterministic">🎯 Deterministic</option>
          </select>
        </div>

        <!-- Current Patient ID -->
        <div class="form-group">
          <label>Current Patient ID:</label>
          <div class="patient-id-display">
            <div class="patient-id-actions">
              <button @click="generateUniqueId" class="btn-primary">
                🎲 Generate New ID
              </button>
              <button @click="showPatientManager = !showPatientManager" class="btn-secondary">
                📋 My Patient IDs ({{ myPatientIds.length }})
              </button>
            </div>
            <div v-if="patientId" class="generated-id">
              <strong>Active Patient ID:</strong>
              <code>{{ patientId }}</code>
              <button @click="copyToClipboard(patientId)" class="copy-btn">📋 Copy</button>
            </div>
          </div>
        </div>

        <!-- Patient ID Manager -->
        <div v-if="showPatientManager" class="patient-manager">
          <h4>📚 My Patient IDs</h4>
          <div v-if="myPatientIds.length === 0" class="no-patients">
            <p>No patient IDs found. Generate your first one above!</p>
          </div>
          <div v-else class="patient-list">
            <div v-for="stored in myPatientIds" :key="stored.patientId" class="patient-item">
              <div class="patient-header">
                <code class="patient-id-text">{{ stored.patientId.slice(0, 20) }}...</code>
                <span class="patient-date">{{ new Date(stored.generatedAt).toLocaleDateString() }}</span>
              </div>
              <div class="patient-roles">
                <span v-if="stored.roles?.guardian" class="role-badge guardian">👨‍⚕️ Guardian</span>
                <span v-if="stored.roles?.psychologist" class="role-badge psychologist">🧠 Psychologist</span>
                <span v-if="stored.roles?.insurer" class="role-badge insurer">🏥 Insurer</span>
              </div>
              <div class="patient-actions">
                <button @click="selectPatientId(stored.patientId)" class="btn-small btn-primary">
                  Select
                </button>
                <button @click="copyToClipboard(stored.patientId)" class="btn-small btn-secondary">
                  Copy
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="setup-section">
        <h3>Set Pediatric Psychologist</h3>

        <div class="form-group">
          <label>Psychologist Address:</label>
          <input
            v-model="psychologistAddress"
            placeholder="0x..."
            class="input-field"
          />
        </div>

        <button
          @click="setPsychologist"
          :disabled="!patientId || !psychologistAddress || isLoading"
          class="btn-primary"
        >
          {{ isLoading ? 'Setting...' : 'Set Pediatric Psychologist' }}
        </button>
      </div>

      <div class="setup-section">
        <h3>Set Guardian</h3>
        <div class="form-group">
          <label>Guardian Address:</label>
          <input
            v-model="guardianAddress"
            placeholder="0x..."
            class="input-field"
          />
        </div>
        <button
          @click="setGuardian"
          :disabled="!patientId || !guardianAddress || isLoading"
          class="btn-primary"
        >
          {{ isLoading ? 'Setting...' : 'Set Guardian' }}
        </button>
      </div>

      <div class="setup-section">
        <h3>Set Insurer</h3>
        <div class="form-group">
          <label>Insurer Address:</label>
          <input
            v-model="insurerAddress"
            placeholder="0x..."
            class="input-field"
          />
        </div>
        <button
          @click="setInsurer"
          :disabled="!patientId || !insurerAddress || isLoading"
          class="btn-primary"
        >
          {{ isLoading ? 'Setting...' : 'Set Insurer' }}
        </button>
      </div>

      <div v-if="statusMessage" class="status-message" :class="messageType">
        {{ statusMessage }}
      </div>

      <!-- Role Status Display -->
      <div v-if="currentRoles && patientId" class="roles-status">
        <h3>📋 Current Roles</h3>
        <div class="role-item">
          <span>Psychologist:</span> {{ currentRoles.psychologist || 'Not set' }}
        </div>
        <div class="role-item">
          <span>Guardian:</span> {{ currentRoles.guardian || 'Not set' }}
        </div>
        <div class="role-item">
          <span>Insurer:</span> {{ currentRoles.insurer || 'Not set' }}
        </div>
      </div>

      <div class="quick-setup">
        <h3>🚀 Quick Test Setup</h3>
        <p>Set current account ({{ account }}) as psychologist for test patient:</p>
        <button @click="quickSetup" :disabled="isLoading" class="btn-success">
          Quick Setup for Testing
        </button>
      </div>

      <!-- Recent Events -->
      <div v-if="recentEvents.length > 0" class="events-section">
        <h3>📊 Recent Blockchain Events</h3>
        <div class="events-list">
          <div v-for="event in recentEvents" :key="`${event.transactionHash}-${event.timestamp}`" class="event-item">
            <div class="event-header">
              <span class="event-type">{{ event.event }}</span>
              <span class="event-time">{{ new Date(event.timestamp).toLocaleTimeString() }}</span>
            </div>
            <div class="event-details">
              <div class="event-patient">Patient: {{ event.patientId.slice(0, 12) }}...</div>
              <div v-if="event.address" class="event-address">Address: {{ event.address.slice(0, 8) }}...{{ event.address.slice(-6) }}</div>
              <div v-if="event.transactionHash" class="event-tx">
                <a :href="`https://coston2-explorer.flare.network/tx/${event.transactionHash}`" target="_blank">
                  View Transaction ↗
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { ethers } from 'ethers'
import {
  generateUniquePatientId,
  generatePatientIdAdvanced,
  IdGenerationStrategy,
  validatePatientId
} from '@/utils/encryption'
import {
  storeNewPatientId,
  getMyPatientIds,
  updatePatientRoles,
  type StoredPatientId
} from '@/utils/patient-storage'
import {
  getContractEventListener,
  type ContractEvent,
  type EventNotification
} from '@/utils/contract-events'

const props = defineProps<{
  account: string
  contract: any
  isConnected: boolean
}>()

const patientId = ref('')
const psychologistAddress = ref('')
const guardianAddress = ref('')
const insurerAddress = ref('')
const isLoading = ref(false)
const statusMessage = ref('')
const messageType = ref<'success' | 'error'>('success')
const currentRoles = ref<{guardian: string, psychologist: string, insurer: string} | null>(null)

// New reactive state
const myPatientIds = ref<StoredPatientId[]>([])
const selectedPatientId = ref<string>('')
const showPatientManager = ref(false)
const idGenerationStrategy = ref<IdGenerationStrategy>(IdGenerationStrategy.HIGH_ENTROPY)
const eventNotifications = ref<EventNotification[]>([])
const recentEvents = ref<ContractEvent[]>([])
const eventListener = ref<any>(null)

// Enhanced ID generation with storage
const generateUniqueId = () => {
  try {
    // Generate new patient ID with collision detection
    const newPatientId = generatePatientIdAdvanced({
      strategy: idGenerationStrategy.value,
      walletAddress: props.account,
      collisionCheck: true,
      maxRetries: 10
    })

    patientId.value = newPatientId

    // Store the new patient ID
    const storedId = storeNewPatientId(newPatientId, props.account)

    // Refresh the list
    loadMyPatientIds()

    // Validate the generated ID
    const validation = validatePatientId(newPatientId)
    if (!validation.valid) {
      console.warn('Generated ID validation issues:', validation.issues)
    }

    // Auto-check roles after generating ID
    setTimeout(() => checkRoles(), 100)

    statusMessage.value = `✅ New patient ID generated (${validation.strength} strength)`
    messageType.value = 'success'
  } catch (error: any) {
    statusMessage.value = `❌ Failed to generate ID: ${error.message}`
    messageType.value = 'error'
  }
}

// Load stored patient IDs
const loadMyPatientIds = () => {
  if (props.account) {
    myPatientIds.value = getMyPatientIds(props.account)
  }
}

// Select an existing patient ID
const selectPatientId = (id: string) => {
  patientId.value = id
  selectedPatientId.value = id
  showPatientManager.value = false

  // Auto-check roles
  setTimeout(() => checkRoles(), 100)
}

// Initialize event listeners
const initializeEventListeners = () => {
  eventListener.value = getContractEventListener()

  if (eventListener.value) {
    // Listen for role setting events
    eventListener.value.on('GuardianSet', handleRoleEvent)
    eventListener.value.on('PsychologistSet', handleRoleEvent)
    eventListener.value.on('InsurerSet', handleRoleEvent)
    eventListener.value.on('ReadAccessGranted', handleRoleEvent)

    // Listen for notifications
    eventListener.value.on('notification', handleNotification)

    // Load recent events and notifications
    recentEvents.value = eventListener.value.getEventHistory().slice(0, 10)
    eventNotifications.value = eventListener.value.getNotifications(5)
  }
}

// Handle blockchain events
const handleRoleEvent = (event: ContractEvent) => {
  console.log('Role event received:', event)

  // Update local storage if this event affects our patient IDs
  const storedId = myPatientIds.value.find(id => id.patientId === event.patientId)
  if (storedId && event.address) {
    const roleUpdate: any = {}

    switch (event.event) {
      case 'GuardianSet':
        roleUpdate.guardian = event.address
        break
      case 'PsychologistSet':
        roleUpdate.psychologist = event.address
        break
      case 'InsurerSet':
        roleUpdate.insurer = event.address
        break
    }

    if (Object.keys(roleUpdate).length > 0) {
      updatePatientRoles(event.patientId, props.account, roleUpdate)
      loadMyPatientIds() // Refresh the list
    }
  }

  // If this is the currently selected patient, refresh roles
  if (event.patientId === patientId.value) {
    setTimeout(() => checkRoles(), 500)
  }

  // Update recent events
  recentEvents.value.unshift(event)
  if (recentEvents.value.length > 10) {
    recentEvents.value = recentEvents.value.slice(0, 10)
  }
}

// Handle notifications
const handleNotification = (notification: EventNotification) => {
  eventNotifications.value.unshift(notification)
  if (eventNotifications.value.length > 5) {
    eventNotifications.value = eventNotifications.value.slice(0, 5)
  }

  // Auto-dismiss after 5 seconds
  setTimeout(() => {
    removeNotification(notification.id)
  }, 5000)
}

// Remove notification
const removeNotification = (id: string) => {
  const index = eventNotifications.value.findIndex(n => n.id === id)
  if (index > -1) {
    eventNotifications.value.splice(index, 1)
  }
}

// Lifecycle hooks
onMounted(() => {
  loadMyPatientIds()
  initializeEventListeners()
})

onUnmounted(() => {
  // Clean up event listeners
  if (eventListener.value) {
    eventListener.value.off('GuardianSet', handleRoleEvent)
    eventListener.value.off('PsychologistSet', handleRoleEvent)
    eventListener.value.off('InsurerSet', handleRoleEvent)
    eventListener.value.off('ReadAccessGranted', handleRoleEvent)
    eventListener.value.off('notification', handleNotification)
  }
})

const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text)
    statusMessage.value = '📋 Copied to clipboard!'
    messageType.value = 'success'
    setTimeout(() => {
      statusMessage.value = ''
    }, 2000)
  } catch (error) {
    console.error('Failed to copy:', error)
  }
}


const setPsychologist = async () => {
  if (!props.contract || !patientId.value || !psychologistAddress.value) return

  isLoading.value = true
  statusMessage.value = ''

  try {
    console.log('Setting pediatric psychologist...')
    console.log('Patient ID:', patientId.value)
    console.log('Psychologist:', psychologistAddress.value)

    const tx = await props.contract.setPediatricPsychologist(
      patientId.value,
      psychologistAddress.value
    )

    console.log('Transaction sent:', tx.hash)
    statusMessage.value = `Transaction sent: ${tx.hash}`
    messageType.value = 'success'

    await tx.wait()
    statusMessage.value = `✅ Pediatric psychologist set successfully!`
    console.log('Pediatric psychologist set successfully!')

  } catch (error: any) {
    console.error('Error setting psychologist:', error)
    statusMessage.value = `❌ Error: ${error.message}`
    messageType.value = 'error'
  } finally {
    isLoading.value = false
  }
}

const setGuardian = async () => {
  if (!props.contract || !patientId.value || !guardianAddress.value) return

  isLoading.value = true
  statusMessage.value = ''

  try {
    const tx = await props.contract.setGuardian(patientId.value, guardianAddress.value)
    statusMessage.value = `Transaction sent: ${tx.hash}`
    messageType.value = 'success'

    await tx.wait()
    statusMessage.value = `✅ Guardian set successfully!`

  } catch (error: any) {
    console.error('Error setting guardian:', error)
    statusMessage.value = `❌ Error: ${error.message}`
    messageType.value = 'error'
  } finally {
    isLoading.value = false
  }
}

const setInsurer = async () => {
  if (!props.contract || !patientId.value || !insurerAddress.value) return

  isLoading.value = true
  statusMessage.value = ''

  try {
    const tx = await props.contract.setInsurer(patientId.value, insurerAddress.value)
    statusMessage.value = `Transaction sent: ${tx.hash}`
    messageType.value = 'success'

    await tx.wait()
    statusMessage.value = `✅ Insurer set successfully!`

  } catch (error: any) {
    console.error('Error setting insurer:', error)
    statusMessage.value = `❌ Error: ${error.message}`
    messageType.value = 'error'
  } finally {
    isLoading.value = false
  }
}

const checkRoles = async () => {
  if (!props.contract || !patientId.value) return

  isLoading.value = true
  statusMessage.value = ''

  try {
    console.log('Checking roles for patient:', patientId.value)
    const roles = await props.contract.getRoles(patientId.value)

    currentRoles.value = {
      guardian: roles[0],
      psychologist: roles[1],
      insurer: roles[2]
    }

    console.log('Current roles:', currentRoles.value)
    statusMessage.value = `✅ Roles retrieved successfully!`
    messageType.value = 'success'

  } catch (error: any) {
    console.error('Error checking roles:', error)
    statusMessage.value = `❌ Error: ${error.message}`
    messageType.value = 'error'
  } finally {
    isLoading.value = false
  }
}

const quickSetup = async () => {
  // Generate unique patient ID
  generateUniqueId()

  // Set current account as psychologist and guardian
  psychologistAddress.value = props.account
  guardianAddress.value = props.account
  insurerAddress.value = props.account

  // Set up all roles
  await setPsychologist()
  if (statusMessage.value.includes('✅')) {
    await setGuardian()
  }
  if (statusMessage.value.includes('✅')) {
    await setInsurer()
  }
}

</script>

<style scoped>
.role-setup {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
}

.setup-card {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.setup-card h2 {
  color: #2c3e50;
  margin-bottom: 1rem;
  text-align: center;
}

.warning {
  background: #fff3cd;
  color: #856404;
  padding: 0.75rem;
  border-radius: 8px;
  margin-bottom: 1.5rem;
  text-align: center;
  border: 1px solid #ffeaa7;
}

.current-account {
  background: #f8f9fa;
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 1.5rem;
  font-family: monospace;
  word-break: break-all;
}

.setup-section {
  margin-bottom: 2rem;
  padding: 1.5rem;
  border: 1px solid #e9ecef;
  border-radius: 8px;
}

.setup-section h3 {
  color: #495057;
  margin-bottom: 1rem;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #495057;
}

.patient-id-generator {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}

.input-field {
  flex: 1;
  min-width: 200px;
  padding: 0.75rem;
  border: 2px solid #e9ecef;
  border-radius: 8px;
  font-size: 1rem;
  transition: border-color 0.3s;
}

.input-field:focus {
  outline: none;
  border-color: #3498db;
}

.generated-id {
  background: #e8f5e8;
  padding: 0.75rem;
  border-radius: 8px;
  margin-top: 0.5rem;
}

.generated-id code {
  font-family: monospace;
  font-size: 0.9rem;
  word-break: break-all;
}

.btn-primary, .btn-secondary, .btn-success {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 500;
  transition: all 0.3s;
}

.btn-primary {
  background: #3498db;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #2980b9;
}

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background: #5a6268;
}

.btn-success {
  background: #27ae60;
  color: white;
  width: 100%;
}

.btn-success:hover:not(:disabled) {
  background: #219a52;
}

button:disabled {
  background: #95a5a6;
  cursor: not-allowed;
}

.status-message {
  padding: 1rem;
  border-radius: 8px;
  margin-top: 1rem;
  word-break: break-all;
}

.status-message.success {
  background: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.status-message.error {
  background: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}

.quick-setup {
  background: #e8f5e8;
  padding: 1.5rem;
  border-radius: 8px;
  text-align: center;
}

.quick-setup h3 {
  color: #27ae60;
  margin-bottom: 0.5rem;
}

.roles-status {
  background: #f8f9fa;
  padding: 1.5rem;
  border-radius: 8px;
  margin-bottom: 1.5rem;
  border: 1px solid #e9ecef;
}

.roles-status h3 {
  color: #2c3e50;
  margin-bottom: 1rem;
}

.role-item {
  display: flex;
  justify-content: space-between;
  padding: 0.5rem;
  background: white;
  border-radius: 4px;
  margin-bottom: 0.5rem;
  font-family: monospace;
  font-size: 0.9rem;
}

.role-item span {
  font-weight: bold;
  color: #495057;
}

.roles-display {
  margin-top: 1rem;
  padding: 1rem;
  background: #e8f5e8;
  border-radius: 8px;
  border: 1px solid #c3e6cb;
}

.roles-display p {
  margin-bottom: 0.5rem;
  font-family: monospace;
  font-size: 0.9rem;
}


.help-text {
  font-size: 0.8rem;
  color: #6c757d;
  margin-top: 0.5rem;
  font-style: italic;
}


.copy-btn {
  background: #28a745;
  color: white;
  border: none;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8rem;
  transition: background 0.3s;
}

.copy-btn:hover {
  background: #218838;
}


/* Notifications */
.notifications-section {
  margin-bottom: 2rem;
}

.notification {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 0.5rem;
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.notification-success {
  background: #d4edda;
  border-color: #c3e6cb;
  color: #155724;
}

.notification-info {
  background: #d1ecf1;
  border-color: #bee5eb;
  color: #0c5460;
}

.notification-warning {
  background: #fff3cd;
  border-color: #ffeaa7;
  color: #856404;
}

.notification-error {
  background: #f8d7da;
  border-color: #f5c6cb;
  color: #721c24;
}

.notification-title {
  font-weight: bold;
  font-size: 0.9rem;
}

.notification-message {
  font-size: 0.8rem;
  margin: 0;
}

.notification-close {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  background: none;
  border: none;
  font-size: 1.2rem;
  cursor: pointer;
  opacity: 0.6;
  transition: opacity 0.3s;
}

.notification-close:hover {
  opacity: 1;
}

/* Patient ID Management */
.patient-id-section {
  background: #f8f9fa;
  border: 2px solid #e9ecef;
}

.patient-id-display {
  background: white;
  padding: 1rem;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.patient-id-actions {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.patient-manager {
  background: white;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 1rem;
  margin-top: 1rem;
}

.patient-manager h4 {
  color: #495057;
  margin-bottom: 1rem;
  border-bottom: 1px solid #e9ecef;
  padding-bottom: 0.5rem;
}

.no-patients {
  text-align: center;
  padding: 2rem;
  color: #6c757d;
  font-style: italic;
}

.patient-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.patient-item {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 6px;
  padding: 0.75rem;
  transition: border-color 0.3s;
}

.patient-item:hover {
  border-color: #3498db;
}

.patient-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.patient-id-text {
  font-family: monospace;
  font-size: 0.8rem;
  background: white;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  border: 1px solid #e9ecef;
}

.patient-date {
  font-size: 0.7rem;
  color: #6c757d;
}

.patient-roles {
  display: flex;
  gap: 0.25rem;
  margin-bottom: 0.5rem;
  flex-wrap: wrap;
}

.role-badge {
  font-size: 0.7rem;
  padding: 0.2rem 0.4rem;
  border-radius: 4px;
  font-weight: 500;
}

.role-badge.guardian {
  background: #d4edda;
  color: #155724;
}

.role-badge.psychologist {
  background: #d1ecf1;
  color: #0c5460;
}

.role-badge.insurer {
  background: #fff3cd;
  color: #856404;
}

.patient-actions {
  display: flex;
  gap: 0.25rem;
}

.btn-small {
  padding: 0.25rem 0.5rem;
  font-size: 0.7rem;
  border-radius: 4px;
}

/* Events Section */
.events-section {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
}

.events-section h3 {
  color: #2c3e50;
  margin-bottom: 1rem;
  border-bottom: 1px solid #e9ecef;
  padding-bottom: 0.5rem;
}

.events-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.event-item {
  background: white;
  border: 1px solid #e9ecef;
  border-radius: 6px;
  padding: 0.75rem;
  transition: border-color 0.3s;
}

.event-item:hover {
  border-color: #3498db;
}

.event-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.event-type {
  font-weight: bold;
  color: #2c3e50;
  background: #e9ecef;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  font-size: 0.8rem;
}

.event-time {
  font-size: 0.7rem;
  color: #6c757d;
}

.event-details {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.8rem;
}

.event-patient,
.event-address {
  font-family: monospace;
  color: #495057;
}

.event-tx a {
  color: #3498db;
  text-decoration: none;
  font-size: 0.7rem;
}

.event-tx a:hover {
  text-decoration: underline;
}

@media (max-width: 768px) {
  .patient-id-generator {
    flex-direction: column;
  }

  .input-field {
    min-width: auto;
  }

  .patient-id-actions {
    flex-direction: column;
  }

  .patient-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.25rem;
  }

  .event-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.25rem;
  }

  .notification {
    padding: 0.75rem;
  }
}
</style>