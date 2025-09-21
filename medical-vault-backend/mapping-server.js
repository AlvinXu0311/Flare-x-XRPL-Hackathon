require('dotenv').config();

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// MongoDB connection
const connectMongoDB = async () => {
  try {
    const mongoURI = `mongodb+srv://sd1f080302_db_user:KfR7LlQrltanHwCx@cluster0.mongodb.net/medical-vault?retryWrites=true&w=majority`;

    await mongoose.connect(mongoURI);

    console.log('✅ MongoDB connected successfully');
    return mongoose.connection;
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    process.exit(1);
  }
};

// Document Mapping Schema
const documentMappingSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  txHash: { type: String, required: true },
  walletAddress: { type: String, required: true },
  contentHash: { type: String, required: true },
  fileName: { type: String, required: true },
  fileSize: { type: Number, required: true },
  contentType: { type: String, required: true },
  patientId: { type: String, required: true },
  docType: { type: Number, required: true, enum: [0, 1, 2], default: 0 },
  blockNumber: { type: Number, required: true },
  gasUsed: { type: String, required: true },
  version: { type: Number, required: true, default: 1 },
  isAvailableLocally: { type: Boolean, default: true },
  localFileId: { type: String, required: true },
  encryptionMethod: { type: String, default: 'wallet-signature' },
  contentURI: { type: String, required: true },
  uploadDate: { type: Date, default: Date.now },
  lastAccessed: { type: Date, default: Date.now },
  deviceInfo: {
    userAgent: String,
    deviceId: String
  }
}, {
  timestamps: true,
  collection: 'document_mappings'
});

// Indexes
documentMappingSchema.index({ walletAddress: 1, uploadDate: -1 });
documentMappingSchema.index({ txHash: 1 }, { unique: true });
documentMappingSchema.index({ patientId: 1, docType: 1 });
documentMappingSchema.index({ contentHash: 1 });
documentMappingSchema.index({ uploadDate: -1 });

// Pre-save middleware
documentMappingSchema.pre('save', function(next) {
  if (!this._id) {
    this._id = `${this.txHash}_${this.walletAddress}`;
  }
  next();
});

const DocumentMapping = mongoose.model('DocumentMapping', documentMappingSchema);

// Routes
// Store mapping
app.post('/api/mappings', async (req, res) => {
  try {
    const {
      txHash, walletAddress, contentHash, fileName, fileSize,
      contentType, patientId, docType, blockNumber, gasUsed,
      version, localFileId, contentURI, deviceInfo
    } = req.body;

    // Check if mapping already exists
    const existingMapping = await DocumentMapping.findOne({ txHash });
    if (existingMapping) {
      return res.status(409).json({
        success: false,
        message: 'Mapping already exists for this transaction hash'
      });
    }

    const mapping = new DocumentMapping({
      txHash, walletAddress, contentHash, fileName, fileSize,
      contentType, patientId, docType, blockNumber, gasUsed,
      version, localFileId, contentURI, deviceInfo,
      isAvailableLocally: true
    });

    await mapping.save();

    console.log(`✅ Document mapping stored: ${txHash} -> ${fileName}`);

    res.status(201).json({
      success: true,
      message: 'Document mapping stored successfully',
      data: {
        id: mapping._id,
        txHash: mapping.txHash,
        fileName: mapping.fileName,
        uploadDate: mapping.uploadDate
      }
    });

  } catch (error) {
    console.error('❌ Store mapping error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to store document mapping',
      error: error.message
    });
  }
});

// Get mappings by wallet
app.get('/api/mappings/wallet/:address', async (req, res) => {
  try {
    const { address } = req.params;
    const { limit = 20, offset = 0 } = req.query;

    const mappings = await DocumentMapping.find({ walletAddress: address })
      .sort({ uploadDate: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset))
      .select('-deviceInfo');

    res.json({
      success: true,
      data: mappings,
      count: mappings.length
    });

  } catch (error) {
    console.error('❌ Get mappings by wallet error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve mappings',
      error: error.message
    });
  }
});

// Get mapping by transaction hash
app.get('/api/mappings/tx/:hash', async (req, res) => {
  try {
    const { hash } = req.params;

    const mapping = await DocumentMapping.findOne({ txHash: hash });
    if (!mapping) {
      return res.status(404).json({
        success: false,
        message: 'Mapping not found for this transaction hash'
      });
    }

    // Update last accessed time
    mapping.lastAccessed = new Date();
    await mapping.save();

    res.json({
      success: true,
      data: mapping
    });

  } catch (error) {
    console.error('❌ Get mapping by tx hash error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve mapping',
      error: error.message
    });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Document Mapping API is running',
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// Start server
const PORT = process.env.MAPPING_PORT || 3002;

async function startServer() {
  try {
    await connectMongoDB();

    app.listen(PORT, () => {
      console.log(`🚀 Document Mapping API server running on port ${PORT}`);
      console.log(`📊 MongoDB connected and ready`);
      console.log(`🔗 API endpoints:`);
      console.log(`   POST /api/mappings - Store mapping`);
      console.log(`   GET  /api/mappings/wallet/:address - Get by wallet`);
      console.log(`   GET  /api/mappings/tx/:hash - Get by transaction`);
      console.log(`   GET  /api/health - Health check`);
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();