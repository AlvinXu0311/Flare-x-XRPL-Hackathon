import { ethers } from 'ethers'

export interface ContractEvent {
  event: string
  patientId: string
  address?: string
  allowed?: boolean
  kind?: number
  version?: number
  timestamp: number
  transactionHash: string
  blockNumber: number
}

export interface EventNotification {
  id: string
  type: 'success' | 'info' | 'warning' | 'error'
  title: string
  message: string
  timestamp: number
  patientId?: string
}

export class ContractEventListener {
  private contract: any
  private listeners: Map<string, Function[]> = new Map()
  private eventHistory: ContractEvent[] = []
  private notifications: EventNotification[] = []

  constructor(contract: any) {
    this.contract = contract
    this.setupEventListeners()
  }

  private setupEventListeners() {
    if (!this.contract) return

    // Guardian Set Event
    this.contract.on('GuardianSet', (patientId: string, guardian: string, event: any) => {
      const contractEvent: ContractEvent = {
        event: 'GuardianSet',
        patientId,
        address: guardian,
        timestamp: Date.now(),
        transactionHash: event.transactionHash,
        blockNumber: event.blockNumber
      }

      this.addEvent(contractEvent)
      this.createNotification({
        type: 'success',
        title: 'Guardian Set',
        message: `Guardian ${this.formatAddress(guardian)} assigned to patient ${this.formatPatientId(patientId)}`,
        patientId
      })

      this.emit('GuardianSet', contractEvent)
    })

    // Psychologist Set Event
    this.contract.on('PsychologistSet', (patientId: string, psychologist: string, event: any) => {
      const contractEvent: ContractEvent = {
        event: 'PsychologistSet',
        patientId,
        address: psychologist,
        timestamp: Date.now(),
        transactionHash: event.transactionHash,
        blockNumber: event.blockNumber
      }

      this.addEvent(contractEvent)
      this.createNotification({
        type: 'success',
        title: 'Psychologist Set',
        message: `Pediatric Psychologist ${this.formatAddress(psychologist)} assigned to patient ${this.formatPatientId(patientId)}`,
        patientId
      })

      this.emit('PsychologistSet', contractEvent)
    })

    // Insurer Set Event
    this.contract.on('InsurerSet', (patientId: string, insurer: string, event: any) => {
      const contractEvent: ContractEvent = {
        event: 'InsurerSet',
        patientId,
        address: insurer,
        timestamp: Date.now(),
        transactionHash: event.transactionHash,
        blockNumber: event.blockNumber
      }

      this.addEvent(contractEvent)
      this.createNotification({
        type: 'success',
        title: 'Insurer Set',
        message: `Insurer ${this.formatAddress(insurer)} assigned to patient ${this.formatPatientId(patientId)}`,
        patientId
      })

      this.emit('InsurerSet', contractEvent)
    })

    // Read Access Granted Event
    this.contract.on('ReadAccessGranted', (patientId: string, who: string, allowed: boolean, event: any) => {
      const contractEvent: ContractEvent = {
        event: 'ReadAccessGranted',
        patientId,
        address: who,
        allowed,
        timestamp: Date.now(),
        transactionHash: event.transactionHash,
        blockNumber: event.blockNumber
      }

      this.addEvent(contractEvent)
      this.createNotification({
        type: allowed ? 'success' : 'warning',
        title: `Read Access ${allowed ? 'Granted' : 'Revoked'}`,
        message: `${this.formatAddress(who)} ${allowed ? 'granted' : 'revoked'} read access for patient ${this.formatPatientId(patientId)}`,
        patientId
      })

      this.emit('ReadAccessGranted', contractEvent)
    })

    // Document Uploaded Event
    this.contract.on('DocumentUploaded', (patientId: string, kind: number, hashURI: string, version: number, event: any) => {
      const contractEvent: ContractEvent = {
        event: 'DocumentUploaded',
        patientId,
        kind,
        version,
        timestamp: Date.now(),
        transactionHash: event.transactionHash,
        blockNumber: event.blockNumber
      }

      this.addEvent(contractEvent)
      this.createNotification({
        type: 'info',
        title: 'Document Uploaded',
        message: `${this.getDocumentKindName(kind)} v${version} uploaded for patient ${this.formatPatientId(patientId)}`,
        patientId
      })

      this.emit('DocumentUploaded', contractEvent)
    })

    // Document Read Event
    this.contract.on('DocumentRead', (patientId: string, kind: number, accessor: string, event: any) => {
      const contractEvent: ContractEvent = {
        event: 'DocumentRead',
        patientId,
        address: accessor,
        kind,
        timestamp: Date.now(),
        transactionHash: event.transactionHash,
        blockNumber: event.blockNumber
      }

      this.addEvent(contractEvent)
      this.createNotification({
        type: 'info',
        title: 'Document Accessed',
        message: `${this.formatAddress(accessor)} accessed ${this.getDocumentKindName(kind)} for patient ${this.formatPatientId(patientId)}`,
        patientId
      })

      this.emit('DocumentRead', contractEvent)
    })

    console.log('📡 Contract event listeners initialized')
  }

  // Subscribe to specific events
  on(eventName: string, callback: Function) {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, [])
    }
    this.listeners.get(eventName)!.push(callback)
  }

  // Unsubscribe from events
  off(eventName: string, callback: Function) {
    const callbacks = this.listeners.get(eventName)
    if (callbacks) {
      const index = callbacks.indexOf(callback)
      if (index > -1) {
        callbacks.splice(index, 1)
      }
    }
  }

  // Emit events to subscribers
  private emit(eventName: string, data: any) {
    const callbacks = this.listeners.get(eventName)
    if (callbacks) {
      callbacks.forEach(callback => callback(data))
    }
  }

  // Add event to history
  private addEvent(event: ContractEvent) {
    this.eventHistory.unshift(event)
    // Keep only last 100 events
    if (this.eventHistory.length > 100) {
      this.eventHistory = this.eventHistory.slice(0, 100)
    }
  }

  // Create notification
  private createNotification(notification: Omit<EventNotification, 'id' | 'timestamp'>) {
    const fullNotification: EventNotification = {
      ...notification,
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now()
    }

    this.notifications.unshift(fullNotification)
    // Keep only last 50 notifications
    if (this.notifications.length > 50) {
      this.notifications = this.notifications.slice(0, 50)
    }

    // Emit notification event
    this.emit('notification', fullNotification)
  }

  // Get event history
  getEventHistory(patientId?: string): ContractEvent[] {
    if (patientId) {
      return this.eventHistory.filter(event => event.patientId === patientId)
    }
    return [...this.eventHistory]
  }

  // Get notifications
  getNotifications(limit?: number): EventNotification[] {
    const notifications = [...this.notifications]
    return limit ? notifications.slice(0, limit) : notifications
  }

  // Clear notifications
  clearNotifications() {
    this.notifications = []
    this.emit('notificationsCleared', {})
  }

  // Remove specific notification
  removeNotification(id: string) {
    const index = this.notifications.findIndex(n => n.id === id)
    if (index > -1) {
      this.notifications.splice(index, 1)
      this.emit('notificationRemoved', { id })
    }
  }

  // Get events for specific patient
  getPatientEvents(patientId: string): ContractEvent[] {
    return this.eventHistory.filter(event => event.patientId === patientId)
  }

  // Helper methods
  private formatAddress(address: string): string {
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  private formatPatientId(patientId: string): string {
    return `${patientId.slice(0, 10)}...${patientId.slice(-8)}`
  }

  private getDocumentKindName(kind: number): string {
    switch (kind) {
      case 0: return 'Diagnosis Letter'
      case 1: return 'Referral'
      case 2: return 'Intake'
      default: return `Document #${kind}`
    }
  }

  // Cleanup
  destroy() {
    if (this.contract) {
      this.contract.removeAllListeners()
    }
    this.listeners.clear()
    this.eventHistory = []
    this.notifications = []
    console.log('📡 Contract event listeners destroyed')
  }
}

// Global instance holder
let globalEventListener: ContractEventListener | null = null

export function initializeContractEvents(contract: any): ContractEventListener {
  // Cleanup existing listener
  if (globalEventListener) {
    globalEventListener.destroy()
  }

  // Create new listener
  globalEventListener = new ContractEventListener(contract)
  return globalEventListener
}

export function getContractEventListener(): ContractEventListener | null {
  return globalEventListener
}

export function destroyContractEvents() {
  if (globalEventListener) {
    globalEventListener.destroy()
    globalEventListener = null
  }
}