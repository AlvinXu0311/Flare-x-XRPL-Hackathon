const mongoose = require('mongoose');

const documentMappingSchema = new mongoose.Schema({
  // Composite primary key: txHash + walletAddress
  _id: {
    type: String,
    required: true
  },

  // Blockchain transaction details
  txHash: {
    type: String,
    required: true,
    index: true
  },

  // User wallet address
  walletAddress: {
    type: String,
    required: true,
    index: true
  },

  // Document content hash (SHA-256)
  contentHash: {
    type: String,
    required: true,
    index: true
  },

  // File metadata
  fileName: {
    type: String,
    required: true
  },

  fileSize: {
    type: Number,
    required: true
  },

  contentType: {
    type: String,
    required: true
  },

  // Medical record details
  patientId: {
    type: String,
    required: true,
    index: true
  },

  docType: {
    type: Number,
    required: true,
    enum: [0, 1, 2], // 0: Diagnosis Letter, 1: Referral, 2: Intake Form
    default: 0
  },

  // Blockchain details
  blockNumber: {
    type: Number,
    required: true
  },

  gasUsed: {
    type: String,
    required: true
  },

  version: {
    type: Number,
    required: true,
    default: 1
  },

  // Local storage status
  isAvailableLocally: {
    type: Boolean,
    default: true
  },

  // IndexedDB reference
  localFileId: {
    type: String,
    required: true
  },

  // Encryption metadata
  encryptionMethod: {
    type: String,
    default: 'wallet-signature'
  },

  // Content URI from blockchain
  contentURI: {
    type: String,
    required: true
  },

  // Timestamps
  uploadDate: {
    type: Date,
    default: Date.now,
    index: true
  },

  lastAccessed: {
    type: Date,
    default: Date.now
  },

  // Device/browser info for local storage reference
  deviceInfo: {
    userAgent: String,
    deviceId: String // Could be a hash of browser fingerprint
  }
}, {
  timestamps: true,
  collection: 'document_mappings'
});

// Indexes for efficient queries
documentMappingSchema.index({ walletAddress: 1, uploadDate: -1 });
documentMappingSchema.index({ txHash: 1 }, { unique: true });
documentMappingSchema.index({ patientId: 1, docType: 1 });
documentMappingSchema.index({ contentHash: 1 });

// Virtual for document type name
documentMappingSchema.virtual('docTypeName').get(function() {
  const types = {
    0: 'Diagnosis Letter',
    1: 'Referral',
    2: 'Intake Form'
  };
  return types[this.docType] || 'Unknown';
});

// Method to update last accessed
documentMappingSchema.methods.updateLastAccessed = function() {
  this.lastAccessed = new Date();
  return this.save();
};

// Static method to find by wallet
documentMappingSchema.statics.findByWallet = function(walletAddress, limit = 20) {
  return this.find({ walletAddress })
    .sort({ uploadDate: -1 })
    .limit(limit);
};

// Static method to find by transaction hash
documentMappingSchema.statics.findByTxHash = function(txHash) {
  return this.findOne({ txHash });
};

// Static method to find by patient ID
documentMappingSchema.statics.findByPatient = function(patientId) {
  return this.find({ patientId }).sort({ uploadDate: -1 });
};

// Pre-save middleware to set _id
documentMappingSchema.pre('save', function(next) {
  if (!this._id) {
    this._id = `${this.txHash}_${this.walletAddress}`;
  }
  next();
});

module.exports = mongoose.model('DocumentMapping', documentMappingSchema);