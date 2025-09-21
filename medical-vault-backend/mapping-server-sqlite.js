require('dotenv').config();

const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// SQLite database setup
const dbPath = path.join(__dirname, 'medical-vault-mappings.db');
const db = new sqlite3.Database(dbPath);

// Initialize database schema
const initDatabase = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS document_mappings (
          id TEXT PRIMARY KEY,
          txHash TEXT UNIQUE NOT NULL,
          walletAddress TEXT NOT NULL,
          contentHash TEXT NOT NULL,
          fileName TEXT NOT NULL,
          fileSize INTEGER NOT NULL,
          contentType TEXT NOT NULL,
          patientId TEXT NOT NULL,
          docType INTEGER NOT NULL CHECK (docType IN (0, 1, 2)) DEFAULT 0,
          blockNumber INTEGER NOT NULL,
          gasUsed TEXT NOT NULL,
          version INTEGER NOT NULL DEFAULT 1,
          isAvailableLocally BOOLEAN DEFAULT 1,
          localFileId TEXT NOT NULL,
          encryptionMethod TEXT DEFAULT 'wallet-signature',
          contentURI TEXT NOT NULL,
          uploadDate DATETIME DEFAULT CURRENT_TIMESTAMP,
          lastAccessed DATETIME DEFAULT CURRENT_TIMESTAMP,
          userAgent TEXT,
          deviceId TEXT,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) {
          console.error('❌ Database table creation failed:', err);
          reject(err);
        } else {
          console.log('✅ Database table initialized');

          // Create indexes
          db.run(`CREATE INDEX IF NOT EXISTS idx_wallet_upload ON document_mappings(walletAddress, uploadDate DESC)`);
          db.run(`CREATE INDEX IF NOT EXISTS idx_patient_doctype ON document_mappings(patientId, docType)`);
          db.run(`CREATE INDEX IF NOT EXISTS idx_content_hash ON document_mappings(contentHash)`);
          db.run(`CREATE INDEX IF NOT EXISTS idx_upload_date ON document_mappings(uploadDate DESC)`);

          resolve();
        }
      });
    });
  });
};

// Routes
// Store mapping
app.post('/api/mappings', async (req, res) => {
  try {
    const {
      txHash, walletAddress, contentHash, fileName, fileSize,
      contentType, patientId, docType, blockNumber, gasUsed,
      version, localFileId, contentURI, deviceInfo
    } = req.body;

    // Validate required fields
    if (!txHash || !walletAddress || !contentHash || !fileName || !localFileId || !contentURI) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    const id = `${txHash}_${walletAddress}`;
    const userAgent = deviceInfo?.userAgent || null;
    const deviceId = deviceInfo?.deviceId || null;

    const stmt = db.prepare(`
      INSERT INTO document_mappings (
        id, txHash, walletAddress, contentHash, fileName, fileSize,
        contentType, patientId, docType, blockNumber, gasUsed,
        version, localFileId, contentURI, userAgent, deviceId
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run([
      id, txHash, walletAddress, contentHash, fileName, fileSize,
      contentType, patientId, docType || 0, blockNumber, gasUsed,
      version || 1, localFileId, contentURI, userAgent, deviceId
    ], function(err) {
      if (err) {
        if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
          return res.status(409).json({
            success: false,
            message: 'Mapping already exists for this transaction hash'
          });
        }
        console.error('❌ Store mapping error:', err);
        return res.status(500).json({
          success: false,
          message: 'Failed to store document mapping',
          error: err.message
        });
      }

      console.log(`✅ Document mapping stored: ${txHash} -> ${fileName}`);

      res.status(201).json({
        success: true,
        message: 'Document mapping stored successfully',
        data: {
          id: id,
          txHash: txHash,
          fileName: fileName,
          uploadDate: new Date().toISOString()
        }
      });
    });

    stmt.finalize();

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

    const stmt = db.prepare(`
      SELECT id, txHash, walletAddress, contentHash, fileName, fileSize,
             contentType, patientId, docType, blockNumber, gasUsed,
             version, isAvailableLocally, localFileId, encryptionMethod,
             contentURI, uploadDate, lastAccessed
      FROM document_mappings
      WHERE walletAddress = ?
      ORDER BY uploadDate DESC
      LIMIT ? OFFSET ?
    `);

    stmt.all([address, parseInt(limit), parseInt(offset)], (err, rows) => {
      if (err) {
        console.error('❌ Get mappings by wallet error:', err);
        return res.status(500).json({
          success: false,
          message: 'Failed to retrieve mappings',
          error: err.message
        });
      }

      res.json({
        success: true,
        data: rows,
        count: rows.length
      });
    });

    stmt.finalize();

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

    const stmt = db.prepare(`
      SELECT * FROM document_mappings WHERE txHash = ?
    `);

    stmt.get([hash], (err, row) => {
      if (err) {
        console.error('❌ Get mapping by tx hash error:', err);
        return res.status(500).json({
          success: false,
          message: 'Failed to retrieve mapping',
          error: err.message
        });
      }

      if (!row) {
        return res.status(404).json({
          success: false,
          message: 'Mapping not found for this transaction hash'
        });
      }

      // Update last accessed time
      const updateStmt = db.prepare(`
        UPDATE document_mappings
        SET lastAccessed = CURRENT_TIMESTAMP, updatedAt = CURRENT_TIMESTAMP
        WHERE txHash = ?
      `);
      updateStmt.run([hash]);
      updateStmt.finalize();

      res.json({
        success: true,
        data: row
      });
    });

    stmt.finalize();

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
    database: 'SQLite connected'
  });
});

// Start server
const PORT = process.env.MAPPING_PORT || 3002;

async function startServer() {
  try {
    await initDatabase();

    app.listen(PORT, () => {
      console.log(`🚀 Document Mapping API server running on port ${PORT}`);
      console.log(`📊 SQLite database ready at ${dbPath}`);
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

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('🛑 Shutting down gracefully...');
  db.close((err) => {
    if (err) {
      console.error('❌ Error closing database:', err);
    } else {
      console.log('✅ Database connection closed');
    }
    process.exit(0);
  });
});

startServer();