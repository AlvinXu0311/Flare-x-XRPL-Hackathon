const mongoose = require('mongoose');

const paymentIntentSchema = new mongoose.Schema({
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

  amount: {
    type: Number,
    required: true,
    default: 15
  },

  currency: {
    type: String,
    default: 'USD'
  },

  xrpAmount: {
    type: String,
    required: true
  },

  destinationWallet: {
    type: String,
    required: true
  },

  sourceWallet: {
    type: String,
    required: true
  },

  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'expired'],
    default: 'pending'
  },

  blockchain: {
    transactionHash: String,
    networkId: String,
    confirmations: {
      type: Number,
      default: 0
    },
    blockHeight: Number,
    gasUsed: String
  },

  verification: {
    flareVerified: {
      type: Boolean,
      default: false
    },
    verificationHash: String,
    verifiedAt: Date,
    verificationStatus: {
      type: String,
      enum: ['pending', 'verified', 'failed'],
      default: 'pending'
    }
  },

  expiresAt: {
    type: Date,
    required: true,
    default: () => new Date(Date.now() + 30 * 60 * 1000)
  },

  metadata: {
    userAgent: String,
    ipAddress: String,
    sessionId: String
  }
}, {
  timestamps: true
});

paymentIntentSchema.index({ hospitalId: 1, status: 1 });
paymentIntentSchema.index({ evaluationId: 1 });
paymentIntentSchema.index({ expiresAt: 1 });
paymentIntentSchema.index({ 'blockchain.transactionHash': 1 });

paymentIntentSchema.methods.isExpired = function() {
  return this.expiresAt < new Date();
};

paymentIntentSchema.methods.markAsCompleted = function(transactionHash, blockHeight) {
  this.status = 'completed';
  this.blockchain.transactionHash = transactionHash;
  this.blockchain.blockHeight = blockHeight;
  this.blockchain.confirmations = 1;
};

paymentIntentSchema.methods.markAsVerified = function(verificationHash) {
  this.verification.flareVerified = true;
  this.verification.verificationHash = verificationHash;
  this.verification.verifiedAt = new Date();
  this.verification.verificationStatus = 'verified';
};

paymentIntentSchema.statics.findPendingPayments = function() {
  return this.find({
    status: 'pending',
    expiresAt: { $gt: new Date() }
  });
};

paymentIntentSchema.statics.findExpiredPayments = function() {
  return this.find({
    status: 'pending',
    expiresAt: { $lte: new Date() }
  });
};

module.exports = mongoose.model('PaymentIntent', paymentIntentSchema);