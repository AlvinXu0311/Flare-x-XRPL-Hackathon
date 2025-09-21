module.exports = (sequelize, DataTypes) => {
  const Document = sequelize.define('Document', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    patientId: {
      type: DataTypes.STRING(66), // Blockchain patient ID
      allowNull: false,
      references: {
        model: 'patients',
        key: 'patientId'
      }
    },
    documentType: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: '0=Diagnosis, 1=Referral, 2=Intake'
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    originalFilename: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    fileType: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    fileSize: {
      type: DataTypes.BIGINT,
      allowNull: false,
      comment: 'File size in bytes'
    },
    ipfsCid: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'IPFS Content Identifier'
    },
    ipfsURI: {
      type: DataTypes.STRING(120),
      allowNull: false,
      comment: 'Complete IPFS URI (ipfs://...)'
    },
    encryptionHash: {
      type: DataTypes.STRING(64),
      allowNull: false,
      comment: 'SHA256 hash of encrypted file'
    },
    version: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
      comment: 'Document version from blockchain'
    },
    blockchainTxHash: {
      type: DataTypes.STRING(66),
      allowNull: true,
      comment: 'Blockchain transaction hash'
    },
    blockNumber: {
      type: DataTypes.BIGINT,
      allowNull: true,
      comment: 'Block number where transaction was mined'
    },
    gasUsed: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: 'Gas used for blockchain transaction'
    },
    uploadedBy: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    status: {
      type: DataTypes.ENUM('uploading', 'processing', 'completed', 'failed'),
      defaultValue: 'uploading'
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Additional document metadata'
    },
    tags: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Document tags for categorization'
    },
    isEncrypted: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    isPinned: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: 'Whether file is pinned in IPFS'
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Document expiration date'
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    updatedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'documents',
    timestamps: true,
    indexes: [
      {
        fields: ['patientId']
      },
      {
        fields: ['documentType']
      },
      {
        fields: ['ipfsCid']
      },
      {
        fields: ['blockchainTxHash']
      },
      {
        fields: ['uploadedBy']
      },
      {
        fields: ['status']
      },
      {
        fields: ['createdAt']
      },
      {
        composite: true,
        fields: ['patientId', 'documentType', 'version']
      }
    ]
  })

  Document.getDocumentTypeName = function(type) {
    const types = {
      0: 'Diagnosis',
      1: 'Referral',
      2: 'Intake'
    }
    return types[type] || 'Unknown'
  }

  Document.prototype.getTypeName = function() {
    return Document.getDocumentTypeName(this.documentType)
  }

  return Document
}