const mongoose = require('mongoose');

const evaluationSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },

  nftTokenId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },

  fileHash: {
    type: String,
    required: true,
    unique: true
  },

  s3Key: {
    type: String,
    required: true
  },

  encryptionKey: {
    type: String,
    required: true
  },

  patientInfo: {
    firstName: {
      type: String,
      required: true
    },
    lastName: {
      type: String,
      required: true
    },
    dateOfBirth: {
      type: Date,
      required: true
    },
    evaluationType: {
      type: String,
      enum: ['ADOS', 'ADI-R', 'Both'],
      required: true
    },
    notes: {
      type: String,
      default: ''
    }
  },

  fileMetadata: {
    originalName: String,
    mimeType: String,
    size: Number,
    uploadDate: {
      type: Date,
      default: Date.now
    }
  },

  blockchain: {
    nftTokenId: String,
    transactionHash: String,
    networkId: String,
    mintedAt: Date,
    walletAddress: String
  },

  status: {
    type: String,
    enum: ['pending', 'encrypted', 'minted', 'completed', 'failed'],
    default: 'pending'
  },

  accessLog: [{
    hospitalId: String,
    accessDate: {
      type: Date,
      default: Date.now
    },
    expiryDate: Date,
    paymentAmount: Number,
    transactionHash: String,
    downloadCount: {
      type: Number,
      default: 0
    }
  }]
}, {
  timestamps: true
});

evaluationSchema.index({ 'patientInfo.firstName': 1, 'patientInfo.lastName': 1 });
evaluationSchema.index({ 'patientInfo.evaluationType': 1 });
evaluationSchema.index({ 'fileMetadata.uploadDate': -1 });

evaluationSchema.methods.getPatientName = function() {
  return `${this.patientInfo.firstName} ${this.patientInfo.lastName}`;
};

evaluationSchema.methods.hasValidAccess = function(hospitalId) {
  const access = this.accessLog.find(log =>
    log.hospitalId === hospitalId &&
    log.expiryDate > new Date()
  );
  return !!access;
};

evaluationSchema.methods.addAccess = function(hospitalId, paymentAmount, transactionHash) {
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + 30);

  this.accessLog.push({
    hospitalId,
    accessDate: new Date(),
    expiryDate,
    paymentAmount,
    transactionHash
  });
};

module.exports = mongoose.model('Evaluation', evaluationSchema);