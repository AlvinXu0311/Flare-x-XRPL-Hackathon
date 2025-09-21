import { ethers } from 'ethers'

export interface StoredPatientId {
  patientId: string
  generatedAt: number
  walletAddress: string
  nickname?: string
  roles?: {
    guardian?: string
    psychologist?: string
    insurer?: string
  }
  lastRoleUpdate?: number
  notes?: string
}

export interface PatientIdStats {
  totalGenerated: number
  lastGenerated?: number
  activePatients: number
}

class PatientStorageManager {
  private readonly STORAGE_KEY = 'medicalVault_patientIds'
  private readonly WALLET_PREFIX = 'medicalVault_wallet_'
  private readonly MAX_STORED_IDS = 100

  // Store a new patient ID
  storePatientId(patientId: string, walletAddress: string, nickname?: string): StoredPatientId {
    const storedId: StoredPatientId = {
      patientId,
      generatedAt: Date.now(),
      walletAddress: walletAddress.toLowerCase(),
      nickname,
      roles: {}
    }

    // Get existing IDs for this wallet
    const existingIds = this.getPatientIds(walletAddress)

    // Check for duplicates
    const duplicate = existingIds.find(id => id.patientId === patientId)
    if (duplicate) {
      console.warn('Patient ID already exists:', patientId)
      return duplicate
    }

    // Add new ID
    existingIds.unshift(storedId)

    // Limit storage size
    if (existingIds.length > this.MAX_STORED_IDS) {
      existingIds.splice(this.MAX_STORED_IDS)
    }

    // Save to localStorage
    this.savePatientIds(walletAddress, existingIds)

    // Update global statistics
    this.updateGlobalStats()

    console.log('✅ Patient ID stored:', patientId)
    return storedId
  }

  // Get all patient IDs for a wallet
  getPatientIds(walletAddress: string): StoredPatientId[] {
    try {
      const key = this.getWalletKey(walletAddress)
      const stored = localStorage.getItem(key)
      if (!stored) return []

      const parsed = JSON.parse(stored)
      return Array.isArray(parsed) ? parsed : []
    } catch (error) {
      console.error('Error loading patient IDs:', error)
      return []
    }
  }

  // Get a specific patient ID
  getPatientId(patientId: string, walletAddress: string): StoredPatientId | null {
    const ids = this.getPatientIds(walletAddress)
    return ids.find(id => id.patientId === patientId) || null
  }

  // Update patient ID roles
  updatePatientRoles(patientId: string, walletAddress: string, roles: Partial<StoredPatientId['roles']>): boolean {
    const ids = this.getPatientIds(walletAddress)
    const index = ids.findIndex(id => id.patientId === patientId)

    if (index === -1) {
      console.warn('Patient ID not found for role update:', patientId)
      return false
    }

    // Update roles
    ids[index].roles = { ...ids[index].roles, ...roles }
    ids[index].lastRoleUpdate = Date.now()

    // Save updated data
    this.savePatientIds(walletAddress, ids)
    console.log('✅ Patient roles updated:', patientId)
    return true
  }

  // Update patient nickname
  updatePatientNickname(patientId: string, walletAddress: string, nickname: string): boolean {
    const ids = this.getPatientIds(walletAddress)
    const index = ids.findIndex(id => id.patientId === patientId)

    if (index === -1) {
      console.warn('Patient ID not found for nickname update:', patientId)
      return false
    }

    ids[index].nickname = nickname
    this.savePatientIds(walletAddress, ids)
    console.log('✅ Patient nickname updated:', patientId)
    return true
  }

  // Update patient notes
  updatePatientNotes(patientId: string, walletAddress: string, notes: string): boolean {
    const ids = this.getPatientIds(walletAddress)
    const index = ids.findIndex(id => id.patientId === patientId)

    if (index === -1) {
      console.warn('Patient ID not found for notes update:', patientId)
      return false
    }

    ids[index].notes = notes
    this.savePatientIds(walletAddress, ids)
    console.log('✅ Patient notes updated:', patientId)
    return true
  }

  // Delete a patient ID
  deletePatientId(patientId: string, walletAddress: string): boolean {
    const ids = this.getPatientIds(walletAddress)
    const index = ids.findIndex(id => id.patientId === patientId)

    if (index === -1) {
      console.warn('Patient ID not found for deletion:', patientId)
      return false
    }

    ids.splice(index, 1)
    this.savePatientIds(walletAddress, ids)
    this.updateGlobalStats()
    console.log('✅ Patient ID deleted:', patientId)
    return true
  }

  // Get statistics for a wallet
  getWalletStats(walletAddress: string): PatientIdStats {
    const ids = this.getPatientIds(walletAddress)
    const activeIds = ids.filter(id => id.roles && Object.keys(id.roles).length > 0)

    return {
      totalGenerated: ids.length,
      lastGenerated: ids.length > 0 ? ids[0].generatedAt : undefined,
      activePatients: activeIds.length
    }
  }

  // Get all wallets with patient IDs
  getAllWallets(): string[] {
    const wallets: string[] = []

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(this.WALLET_PREFIX)) {
        const wallet = key.replace(this.WALLET_PREFIX, '')
        wallets.push(wallet)
      }
    }

    return wallets
  }

  // Get global statistics
  getGlobalStats(): PatientIdStats {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY)
      if (!stored) return { totalGenerated: 0, activePatients: 0 }

      return JSON.parse(stored)
    } catch (error) {
      console.error('Error loading global stats:', error)
      return { totalGenerated: 0, activePatients: 0 }
    }
  }

  // Search patient IDs
  searchPatientIds(walletAddress: string, query: string): StoredPatientId[] {
    const ids = this.getPatientIds(walletAddress)
    const lowerQuery = query.toLowerCase()

    return ids.filter(id =>
      id.patientId.toLowerCase().includes(lowerQuery) ||
      (id.nickname && id.nickname.toLowerCase().includes(lowerQuery)) ||
      (id.notes && id.notes.toLowerCase().includes(lowerQuery))
    )
  }

  // Export patient data
  exportPatientData(walletAddress: string): string {
    const ids = this.getPatientIds(walletAddress)
    return JSON.stringify({
      walletAddress,
      exportedAt: Date.now(),
      patientIds: ids
    }, null, 2)
  }

  // Import patient data
  importPatientData(walletAddress: string, jsonData: string): boolean {
    try {
      const data = JSON.parse(jsonData)

      if (!data.patientIds || !Array.isArray(data.patientIds)) {
        throw new Error('Invalid data format')
      }

      // Validate each patient ID
      const validIds = data.patientIds.filter((id: any) =>
        id.patientId &&
        id.generatedAt &&
        id.walletAddress
      )

      if (validIds.length === 0) {
        throw new Error('No valid patient IDs found')
      }

      // Merge with existing data
      const existingIds = this.getPatientIds(walletAddress)
      const mergedIds = [...existingIds]

      validIds.forEach((importedId: StoredPatientId) => {
        const existing = mergedIds.find(id => id.patientId === importedId.patientId)
        if (!existing) {
          mergedIds.push(importedId)
        }
      })

      // Sort by generation date (newest first)
      mergedIds.sort((a, b) => b.generatedAt - a.generatedAt)

      // Limit storage size
      if (mergedIds.length > this.MAX_STORED_IDS) {
        mergedIds.splice(this.MAX_STORED_IDS)
      }

      this.savePatientIds(walletAddress, mergedIds)
      this.updateGlobalStats()

      console.log(`✅ Imported ${validIds.length} patient IDs`)
      return true
    } catch (error) {
      console.error('Error importing patient data:', error)
      return false
    }
  }

  // Clear all data for a wallet
  clearWalletData(walletAddress: string): boolean {
    try {
      const key = this.getWalletKey(walletAddress)
      localStorage.removeItem(key)
      this.updateGlobalStats()
      console.log('✅ Wallet data cleared:', walletAddress)
      return true
    } catch (error) {
      console.error('Error clearing wallet data:', error)
      return false
    }
  }

  // Clear all data
  clearAllData(): boolean {
    try {
      const wallets = this.getAllWallets()
      wallets.forEach(wallet => {
        const key = this.getWalletKey(wallet)
        localStorage.removeItem(key)
      })
      localStorage.removeItem(this.STORAGE_KEY)
      console.log('✅ All patient data cleared')
      return true
    } catch (error) {
      console.error('Error clearing all data:', error)
      return false
    }
  }

  // Check if patient ID exists
  patientIdExists(patientId: string, walletAddress: string): boolean {
    const ids = this.getPatientIds(walletAddress)
    return ids.some(id => id.patientId === patientId)
  }

  // Validate patient ID format
  isValidPatientId(patientId: string): boolean {
    // Check if it's a valid hex string (keccak256 hash)
    return ethers.utils.isHexString(patientId) && patientId.length === 66
  }

  // Private helper methods
  private getWalletKey(walletAddress: string): string {
    return `${this.WALLET_PREFIX}${walletAddress.toLowerCase()}`
  }

  private savePatientIds(walletAddress: string, ids: StoredPatientId[]): void {
    try {
      const key = this.getWalletKey(walletAddress)
      localStorage.setItem(key, JSON.stringify(ids))
    } catch (error) {
      console.error('Error saving patient IDs:', error)
    }
  }

  private updateGlobalStats(): void {
    try {
      const wallets = this.getAllWallets()
      let totalGenerated = 0
      let activePatients = 0
      let lastGenerated = 0

      wallets.forEach(wallet => {
        const ids = this.getPatientIds(wallet)
        totalGenerated += ids.length
        activePatients += ids.filter(id => id.roles && Object.keys(id.roles).length > 0).length

        if (ids.length > 0) {
          lastGenerated = Math.max(lastGenerated, ids[0].generatedAt)
        }
      })

      const stats: PatientIdStats = {
        totalGenerated,
        activePatients,
        lastGenerated: lastGenerated > 0 ? lastGenerated : undefined
      }

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(stats))
    } catch (error) {
      console.error('Error updating global stats:', error)
    }
  }
}

// Global instance
export const patientStorage = new PatientStorageManager()

// Helper functions for common operations
export function storeNewPatientId(patientId: string, walletAddress: string, nickname?: string): StoredPatientId {
  return patientStorage.storePatientId(patientId, walletAddress, nickname)
}

export function getMyPatientIds(walletAddress: string): StoredPatientId[] {
  return patientStorage.getPatientIds(walletAddress)
}

export function updatePatientRoles(patientId: string, walletAddress: string, roles: Partial<StoredPatientId['roles']>): boolean {
  return patientStorage.updatePatientRoles(patientId, walletAddress, roles)
}

export function findPatientId(patientId: string, walletAddress: string): StoredPatientId | null {
  return patientStorage.getPatientId(patientId, walletAddress)
}

export function patientIdExists(patientId: string, walletAddress: string): boolean {
  return patientStorage.patientIdExists(patientId, walletAddress)
}