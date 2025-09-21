<template>
  <div class="role-setup">
    <div class="setup-card">
      <h2>🔧 Contract Role Setup</h2>
      <p class="warning">⚠️ Only contract owner can perform these actions</p>

      <div class="current-account">
        <strong>Current Account:</strong> {{ account }}
      </div>

      <div class="setup-section">
        <h3>Set Pediatric Psychologist</h3>

        <!-- Simple Patient ID Generation -->
        <div class="form-group">
          <label>Patient ID:</label>
          <div class="patient-id-generator">
            <button @click="generateUniqueId" class="btn-secondary">
              🎲 Generate New Patient ID
            </button>
            <p class="help-text">Creates a unique patient identifier</p>
          </div>
          <div v-if="patientId" class="generated-id">
            <strong>Patient ID:</strong>
            <code>{{ patientId }}</code>
            <button @click="copyToClipboard(patientId)" class="copy-btn">📋 Copy</button>
          </div>
        </div>

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
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ethers } from 'ethers'
import { generateUniquePatientId } from '@/utils/encryption'

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

const generateUniqueId = () => {
  patientId.value = generateUniquePatientId()
  // Auto-check roles after generating ID
  setTimeout(() => checkRoles(), 100)
}

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


@media (max-width: 768px) {
  .patient-id-generator {
    flex-direction: column;
  }

  .input-field {
    min-width: auto;
  }
}
</style>