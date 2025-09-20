const mongoose = require('mongoose');

const accessLogSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },

  evaluationId: {
    type: String,
    required: true,
    ref: 'Evaluation'
  },

  hospitalId: {
    type: String,
    required: true
  },

  paymentIntentId: {
    type: String,
    required: true,
    ref: 'PaymentIntent'
  },

  accessType: {
    type: String,
    enum: ['download', 'view', 'search'],
    required: true
  },

  grantedAt: {
    type: Date,
    default: Date.now
  },

  expiresAt: {
    type: Date,
    required: true
  },

  downloadHistory: [{
    downloadedAt: {
      type: Date,
      default: Date.now
    },
    fileSize: Number,
    downloadDuration: Number,
    userAgent: String,
    ipAddress: String
  }],

  paymentDetails: {
    amount: Number,
    currency: String,
    transactionHash: String,
    blockHeight: Number,
    verificationHash: String
  },

  status: {
    type: String,
    enum: ['active', 'expired', 'revoked', 'suspended'],
    default: 'active'
  },

  metadata: {
    userAgent: String,
    ipAddress: String,
    sessionId: String,
    hospitalName: String,
    department: String
  }
}, {
  timestamps: true
});

accessLogSchema.index({ hospitalId: 1, status: 1 });
accessLogSchema.index({ evaluationId: 1 });
accessLogSchema.index({ expiresAt: 1 });
accessLogSchema.index({ grantedAt: -1 });

accessLogSchema.methods.isValid = function() {
  return this.status === 'active' && this.expiresAt > new Date();
};

accessLogSchema.methods.addDownload = function(fileSize, userAgent, ipAddress) {
  this.downloadHistory.push({
    downloadedAt: new Date(),
    fileSize,
    userAgent,
    ipAddress
  });
};

accessLogSchema.methods.revokeAccess = function() {
  this.status = 'revoked';
};

accessLogSchema.statics.findValidAccess = function(hospitalId, evaluationId) {
  return this.findOne({
    hospitalId,
    evaluationId,
    status: 'active',
    expiresAt: { $gt: new Date() }
  });
};

accessLogSchema.statics.findExpiredAccess = function() {
  return this.find({
    status: 'active',
    expiresAt: { $lte: new Date() }
  });
};

accessLogSchema.statics.getHospitalAccessHistory = function(hospitalId, limit = 50) {
  return this.find({ hospitalId })
    .sort({ grantedAt: -1 })
    .limit(limit)
    .populate('evaluationId');
};

module.exports = mongoose.model('AccessLog', accessLogSchema);