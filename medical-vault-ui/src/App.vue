<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ethers } from 'ethers'
import DocumentUpload from './components/DocumentUpload.vue'
import DocumentDownload from './components/DocumentDownload.vue'
import RoleSetup from './components/RoleSetup.vue'
import MedicalVaultABI from '@/assets/MedicalVault.json'
import { connectToMetaMask, switchToCoston2, isMetaMaskInstalled, getConnectedAccounts } from '@/utils/wallet'
import { connectWalletSimple, createContractInterface } from '@/utils/wallet-fallback'
import { connectBasic, switchToCoston2Basic } from '@/utils/wallet-basic'

// Reactive state
const currentView = ref('upload') // 'upload', 'download', 'setup'
const isConnected = ref(false)
const account = ref('')
const chainId = ref(0)
const provider = ref<ethers.providers.Web3Provider | null>(null)
const contract = ref<any>(null)
const isConnecting = ref(false)

// Environment variables
const VAULT_ADDRESS = import.meta.env.VITE_VAULT_ADDRESS
const COSTON2_CHAIN_ID = 114

// Computed properties
const isCorrectNetwork = computed(() => chainId.value === COSTON2_CHAIN_ID)

// Reset wallet connection to fix proxy issues
const resetWalletConnection = async () => {
  console.log('🔄 Resetting wallet connection...')

  // Clear all state
  isConnected.value = false
  account.value = ''
  chainId.value = 0
  provider.value = null
  contract.value = null

  // Clear any cached ethereum data
  if (typeof window.ethereum !== 'undefined') {
    const ethereum = window.ethereum as any
    ethereum.removeAllListeners?.('accountsChanged')
    ethereum.removeAllListeners?.('chainChanged')

    // Clear any cached provider state
    if (ethereum._metamask) {
      try {
        await ethereum._metamask.isUnlocked()
      } catch (e) {
        console.log('Cleared MetaMask cache state')
      }
    }
  }

  // Longer delay to ensure everything clears
  await new Promise(resolve => setTimeout(resolve, 1000))

  console.log('✅ Wallet state reset complete')
}

// Connect to MetaMask wallet
const connectWallet = async () => {
  if (!isMetaMaskInstalled()) {
    alert('MetaMask is not installed. Please install MetaMask extension to continue.')
    return
  }

  // Prevent multiple concurrent connection attempts
  if (isConnecting.value) {
    return
  }

  isConnecting.value = true

  try {
    // Reset any previous connection state first
    await resetWalletConnection()

    // Start with the most basic connection method first
    console.log('Attempting basic wallet connection...')
    const basicConnection = await connectBasic()

    account.value = basicConnection.account
    chainId.value = basicConnection.chainId
    isConnected.value = true

    console.log('Basic connection successful, setting up ethers provider...')

    // Try to create ethers provider after basic connection
    try {
      provider.value = new ethers.providers.Web3Provider(basicConnection.ethereum)

      // Initialize contract with ethers if available
      if (VAULT_ADDRESS) {
        const signer = provider.value.getSigner()
        contract.value = new ethers.Contract(VAULT_ADDRESS, MedicalVaultABI.abi, signer)
      }
    } catch (ethersError) {
      console.warn('Ethers provider creation failed, using basic interface:', ethersError)

      // Fallback to basic contract interface
      if (VAULT_ADDRESS) {
        contract.value = await createContractInterface(
          basicConnection.ethereum,
          VAULT_ADDRESS,
          MedicalVaultABI.abi
        )
      }
    }

    // Setup event listeners
    setupEventListeners()

    console.log('✅ Wallet connected successfully!')

  } catch (error: any) {
    console.error('All connection methods failed:', error)
    alert(`Failed to connect wallet: ${error.message}`)
  } finally {
    isConnecting.value = false
  }
}

// Setup MetaMask event listeners
const setupEventListeners = () => {
  if (typeof window.ethereum === 'undefined') return

  const ethereum = window.ethereum as any

  // Remove existing listeners
  ethereum.removeAllListeners?.('accountsChanged')
  ethereum.removeAllListeners?.('chainChanged')

  // Listen for account changes
  ethereum.on('accountsChanged', (accounts: string[]) => {
    if (accounts.length === 0) {
      disconnect()
    } else {
      account.value = accounts[0]
      // Update contract with new account
      if (provider.value && VAULT_ADDRESS) {
        const signer = provider.value.getSigner()
        contract.value = new ethers.Contract(VAULT_ADDRESS, MedicalVaultABI.abi, signer)
      }
    }
  })

  // Listen for network changes
  ethereum.on('chainChanged', (newChainId: string) => {
    chainId.value = parseInt(newChainId, 16)
    // Reload page on network change for safety
    window.location.reload()
  })
}

// Disconnect wallet
const disconnect = () => {
  isConnected.value = false
  account.value = ''
  chainId.value = 0
  provider.value = null
  contract.value = null
  isConnecting.value = false
}

// Switch network to Coston2
const switchNetwork = async () => {
  if (!isMetaMaskInstalled()) {
    alert('MetaMask is not installed.')
    return
  }

  try {
    await switchToCoston2Basic()
  } catch (error: any) {
    console.error('Failed to switch network:', error)
    alert(error.message || 'Failed to switch to Coston2 network')
  }
}

// Check for existing connection on mount
onMounted(async () => {
  if (isMetaMaskInstalled()) {
    try {
      const accounts = await getConnectedAccounts()
      if (accounts.length > 0) {
        // Only auto-connect if user was previously connected
        await connectWallet()
      }
    } catch (error) {
      console.warn('Failed to check existing wallet connection:', error)
    }
  }
})
</script>

<template>
  <div id="app">
    <!-- Header with Navigation -->
    <header class="app-header">
      <div class="header-content">
        <h1>🏥 Medical Vault</h1>

        <!-- Navigation -->
        <nav class="main-nav">
          <button
            @click="currentView = 'upload'"
            :class="{ active: currentView === 'upload' }"
            class="nav-btn"
          >
            📤 Upload Document
          </button>
          <button
            @click="currentView = 'download'"
            :class="{ active: currentView === 'download' }"
            class="nav-btn"
          >
            📥 Download Document
          </button>
          <button
            @click="currentView = 'setup'"
            :class="{ active: currentView === 'setup' }"
            class="nav-btn setup-btn"
          >
            ⚙️ Admin Setup
          </button>
        </nav>

        <!-- Wallet Status -->
        <div class="wallet-status">
          <div v-if="!isConnected" class="wallet-disconnected">
            <button
              @click="connectWallet"
              :disabled="isConnecting"
              class="connect-wallet-btn"
            >
              {{ isConnecting ? '⏳ Connecting...' : '🔗 Connect Wallet' }}
            </button>
          </div>
          <div v-else class="wallet-connected">
            <div class="wallet-info">
              <span class="account">{{ account.slice(0, 6) }}...{{ account.slice(-4) }}</span>
              <span class="network" :class="{ incorrect: !isCorrectNetwork }">
                {{ isCorrectNetwork ? '✅ Coston2' : '❌ Wrong Network' }}
              </span>
            </div>
            <button v-if="!isCorrectNetwork" @click="switchNetwork" class="switch-network-btn">
              🔄 Switch to Coston2
            </button>
          </div>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="app-main">
      <!-- Connection Required Notice -->
      <div v-if="!isConnected" class="connection-notice">
        <div class="notice-content">
          <h2>🔐 Wallet Connection Required</h2>
          <p>Please connect your MetaMask wallet to access the Medical Vault.</p>
          <button
            @click="connectWallet"
            :disabled="isConnecting"
            class="connect-btn-large"
          >
            {{ isConnecting ? '⏳ Connecting...' : 'Connect MetaMask Wallet' }}
          </button>
        </div>
      </div>

      <!-- Wrong Network Notice -->
      <div v-else-if="!isCorrectNetwork" class="network-notice">
        <div class="notice-content">
          <h2>🌐 Wrong Network</h2>
          <p>Please switch to the Coston2 network to use the Medical Vault.</p>
          <button @click="switchNetwork" class="switch-btn-large">
            Switch to Coston2 Network
          </button>
        </div>
      </div>

      <!-- Contract Address Missing -->
      <div v-else-if="!VAULT_ADDRESS" class="contract-notice">
        <div class="notice-content">
          <h2>⚙️ Configuration Required</h2>
          <p>Please set the VITE_VAULT_ADDRESS in your .env file.</p>
          <code>.env file: VITE_VAULT_ADDRESS=0x...</code>
        </div>
      </div>

      <!-- Main Application -->
      <div v-else>
        <!-- Upload Document -->
        <DocumentUpload
          v-if="currentView === 'upload'"
          :account="account"
          :contract="contract"
          :isConnected="isConnected"
        />

        <!-- Download Document -->
        <DocumentDownload
          v-if="currentView === 'download'"
          :account="account"
          :contract="contract"
          :isConnected="isConnected"
        />

        <!-- Role Setup -->
        <RoleSetup
          v-if="currentView === 'setup'"
          :account="account"
          :contract="contract"
          :isConnected="isConnected"
        />
      </div>
    </main>

    <!-- Footer -->
    <footer class="app-footer">
      <p>🔒 Secure Medical Records on Flare Network | Built with Vue.js & Ethers.js</p>
    </footer>
  </div>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  min-height: 100vh;
}

#app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

/* Header Styles */
.app-header {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-bottom: 2px solid rgba(255, 255, 255, 0.2);
  padding: 1rem 0;
  position: sticky;
  top: 0;
  z-index: 100;
}

.header-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
}

.header-content h1 {
  color: #2c3e50;
  font-size: 1.8rem;
  font-weight: bold;
}

/* Navigation Styles */
.main-nav {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.nav-btn {
  background: #ecf0f1;
  color: #2c3e50;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 25px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 500;
  transition: all 0.3s ease;
  border: 2px solid transparent;
}

.nav-btn:hover {
  background: #d5dbdb;
  transform: translateY(-2px);
}

.nav-btn.active {
  background: #3498db;
  color: white;
  border-color: #2980b9;
}

.setup-btn {
  background: #e67e22 !important;
  color: white !important;
}

.setup-btn:hover {
  background: #d35400 !important;
}

.setup-btn.active {
  background: #d35400 !important;
  border-color: #a0522d !important;
}

/* Wallet Status Styles */
.wallet-status {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.connect-wallet-btn {
  background: #27ae60;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 25px;
  cursor: pointer;
  font-weight: 500;
  transition: background 0.3s;
}

.connect-wallet-btn:hover:not(:disabled) {
  background: #219a52;
}

.connect-wallet-btn:disabled {
  background: #95a5a6;
  cursor: not-allowed;
}

.wallet-connected {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.wallet-info {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.25rem;
}

.account {
  font-family: monospace;
  background: #f8f9fa;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.9rem;
}

.network {
  font-size: 0.8rem;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  background: #d5f4e6;
  color: #27ae60;
}

.network.incorrect {
  background: #ffebee;
  color: #e74c3c;
}

.switch-network-btn {
  background: #e74c3c;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 20px;
  cursor: pointer;
  font-size: 0.8rem;
  transition: background 0.3s;
}

.switch-network-btn:hover {
  background: #c0392b;
}

/* Main Content Styles */
.app-main {
  flex: 1;
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
}

/* Notice Styles */
.connection-notice,
.network-notice,
.contract-notice {
  background: white;
  border-radius: 12px;
  padding: 3rem;
  text-align: center;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  margin: 2rem 0;
}

.notice-content h2 {
  color: #2c3e50;
  margin-bottom: 1rem;
  font-size: 1.5rem;
}

.notice-content p {
  color: #7f8c8d;
  margin-bottom: 2rem;
  font-size: 1.1rem;
}

.connect-btn-large,
.switch-btn-large {
  background: #3498db;
  color: white;
  border: none;
  padding: 1rem 2rem;
  border-radius: 30px;
  cursor: pointer;
  font-size: 1.1rem;
  font-weight: 500;
  transition: all 0.3s ease;
}

.connect-btn-large:hover:not(:disabled),
.switch-btn-large:hover:not(:disabled) {
  background: #2980b9;
  transform: translateY(-2px);
}

.connect-btn-large:disabled,
.switch-btn-large:disabled {
  background: #95a5a6;
  cursor: not-allowed;
  transform: none;
}

.contract-notice code {
  background: #f8f9fa;
  padding: 1rem;
  border-radius: 8px;
  display: block;
  margin-top: 1rem;
  font-family: monospace;
  color: #e74c3c;
}

/* Footer Styles */
.app-footer {
  background: rgba(255, 255, 255, 0.1);
  text-align: center;
  padding: 1rem;
  color: white;
  font-size: 0.9rem;
  margin-top: auto;
}

/* Responsive Design */
@media (max-width: 768px) {
  .header-content {
    flex-direction: column;
    text-align: center;
  }

  .main-nav {
    justify-content: center;
  }

  .nav-btn {
    padding: 0.5rem 1rem;
    font-size: 0.8rem;
  }

  .wallet-info {
    align-items: center;
  }

  .app-main {
    padding: 1rem;
  }

  .notice-content {
    padding: 2rem 1rem;
  }
}

@media (max-width: 480px) {
  .header-content h1 {
    font-size: 1.4rem;
  }

  .nav-btn {
    padding: 0.5rem 0.75rem;
    font-size: 0.7rem;
  }
}
</style>
