// server.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();

// Set timeout for long-running operations like contract deployment
app.use((req, res, next) => {
  // Set longer timeout for deployment endpoints
  if (req.url.includes('/deploy-contract')) {
    req.setTimeout(300000); // 5 minutes
    res.setTimeout(300000); // 5 minutes
  }
  next();
});

// Import services
const xrplService = require('./services/xrplService');
const s3Service = require('./services/s3Service');
const flareRegistryService = require('./services/flareRegistryService');

// Import routes
const authRoutes = require('./routes/auth');
const fileRoutes = require('./routes/files');
const reportRoutes = require('./routes/reports');
const accessRoutes = require('./routes/access');
const billingRoutes = require('./routes/billing');
const blockchainRoutes = require('./routes/blockchain');

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// MongoDB connection disabled for local storage mode
// if (process.env.MONGODB_URI) {
//   mongoose.connect(process.env.MONGODB_URI, {
//     useNewUrlParser: true,
//     useUnifiedTopology: true,
//   })
//   .then(() => console.log('📊 Connected to MongoDB'))
//   .catch(err => console.error('❌ MongoDB connection error:', err));
// } else {
  console.log('📁 Using local storage mode (MongoDB disabled)');
// }

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0'
  });
});

// Initialize services
async function initializeServices() {
  try {
    console.log('🚀 Initializing services...');

    if (xrplService) {
      await xrplService.initialize();
    }

    if (flareRegistryService) {
      await flareRegistryService.initialize();
    }

    console.log('✅ All services initialized');
  } catch (error) {
    console.error('❌ Service initialization failed:', error);
  }
}

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/access', accessRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/blockchain', blockchainRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal server error',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: {
      message: 'Route not found',
      path: req.originalUrl
    }
  });
});

const PORT = process.env.PORT || 3000;

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  if (xrplService) {
    await xrplService.disconnect();
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  if (xrplService) {
    await xrplService.disconnect();
  }
  process.exit(0);
});

app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📁 S3 configured: ${s3Service.isConfigured()}`);
  console.log(`💰 S3 bucket: ${s3Service.getBucketInfo().bucketName}`);

  await initializeServices();

  console.log('🎉 XRPL Medical Platform backend is ready!');
});