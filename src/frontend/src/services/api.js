import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

api.interceptors.request.use(
  (config) => {
    console.log(`Making ${config.method?.toUpperCase()} request to ${config.url}`)
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

api.interceptors.response.use(
  (response) => {
    return response
  },
  (error) => {
    console.error('API Error:', error.response?.data || error.message)
    return Promise.reject(error)
  }
)

export const fileService = {
  async uploadFile(formData, onProgress) {
    return api.post('/api/files/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      onUploadProgress: onProgress
    })
  },

  async getPresignedUrl(filename, contentType) {
    return api.get('/api/files/presign', {
      params: { filename, contentType }
    })
  },

  async decryptFile(fileKey, encryptionKey) {
    return api.post('/api/files/decrypt', {
      fileKey,
      encryptionKey
    }, {
      responseType: 'blob'
    })
  }
}

export const reportService = {
  async getAllReports() {
    return api.get('/api/reports')
  },

  async getReportById(id) {
    return api.get(`/api/reports/${id}`)
  },

  async createReport(reportData) {
    return api.post('/api/reports', reportData)
  },

  async searchReports(searchParams) {
    return api.get('/api/reports/search', {
      params: searchParams
    })
  },

  async getReportLogs(id) {
    return api.get(`/api/reports/${id}/logs`)
  },

  async downloadReport(id) {
    return api.post(`/api/reports/${id}/download`, {}, {
      responseType: 'blob'
    })
  }
}

export const accessService = {
  async createPaymentIntent(intentData) {
    return api.post('/api/access/intents', intentData)
  },

  async confirmPayment(confirmationData) {
    return api.post('/api/access/confirm', confirmationData)
  },

  async verifyAccess(accessParams) {
    return api.get('/api/access/verify', {
      params: accessParams
    })
  },

  async revokeAccess(accessId) {
    return api.delete(`/api/access/${accessId}`)
  },

  async getAccessHistory() {
    return api.get('/api/access/history')
  }
}

export const blockchainService = {
  async mintNFT(nftData) {
    return api.post('/api/blockchain/mint-nft', nftData)
  },

  async mintMedicalRecord(recordData) {
    return api.post('/api/blockchain/mint-medical-record', recordData)
  },

  async grantHospitalAccess(accessData) {
    return api.post('/api/blockchain/grant-hospital-access', accessData)
  },

  async checkHospitalAccess(tokenId, hospitalAddress) {
    return api.get(`/api/blockchain/check-hospital-access/${tokenId}/${hospitalAddress}`)
  },

  async getMedicalRecords(patientAddress) {
    return api.get(`/api/blockchain/medical-records/${patientAddress}`)
  },

  async verifyTransaction(txHash) {
    return api.post('/api/blockchain/verify-tx', {
      transactionHash: txHash
    })
  },

  async getWalletBalance(address) {
    return api.get('/api/blockchain/balance', {
      params: { address }
    })
  },

  async sendPayment(paymentData) {
    return api.post('/api/blockchain/payment', paymentData)
  }
}

export const billingService = {
  async sendBill(billData) {
    return api.post('/api/billing/send', billData)
  },

  async getBillingHistory() {
    return api.get('/api/billing')
  },

  async autoPayBill(billId, walletData) {
    return api.post('/api/billing/auto-pay', {
      billId,
      ...walletData
    })
  }
}

export const systemService = {
  async healthCheck() {
    return api.get('/api/health')
  },

  async getSystemStats() {
    return api.get('/api/stats')
  }
}

export const mockData = {
  evaluations: [
    {
      id: 'eval_001',
      tokenId: 'NFT_TOKEN_ABC123XYZ789',
      patientName: 'John Doe',
      type: 'ADOS',
      uploadDate: '2024-01-15',
      fileSize: '2.3 MB',
      hasAccess: false
    },
    {
      id: 'eval_002',
      tokenId: 'NFT_TOKEN_DEF456UVW012',
      patientName: 'Jane Smith',
      type: 'ADI-R',
      uploadDate: '2024-01-10',
      fileSize: '1.8 MB',
      hasAccess: true
    },
    {
      id: 'eval_003',
      tokenId: 'NFT_TOKEN_GHI789RST345',
      patientName: 'Mike Johnson',
      type: 'Both',
      uploadDate: '2024-01-08',
      fileSize: '3.1 MB',
      hasAccess: false
    }
  ],

  accessHistory: [
    {
      id: 'access_001',
      patientName: 'Jane Smith',
      evaluationType: 'ADI-R',
      accessDate: '2024-01-12',
      expiryDate: '2024-02-11',
      tokenId: 'NFT_TOKEN_DEF456UVW012'
    }
  ]
}

export default api