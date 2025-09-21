module.exports = (sequelize, DataTypes) => {
  const AccessLog = sequelize.define('AccessLog', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    patientId: {
      type: DataTypes.STRING(66),
      allowNull: false,
      references: {
        model: 'patients',
        key: 'patientId'
      }
    },
    documentId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'documents',
        key: 'id'
      }
    },
    accessedBy: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    accessType: {
      type: DataTypes.ENUM('view', 'download', 'upload', 'update', 'delete', 'share'),
      allowNull: false
    },
    ipAddress: {
      type: DataTypes.INET,
      allowNull: true
    },
    userAgent: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    sessionId: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    blockchainTxHash: {
      type: DataTypes.STRING(66),
      allowNull: true,
      comment: 'Associated blockchain transaction'
    },
    accessReason: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Reason for accessing the record'
    },
    permissionGrantedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      },
      comment: 'Who granted the permission for this access'
    },
    accessDuration: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Duration of access in seconds'
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Additional access metadata'
    },
    success: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: 'Whether the access was successful'
    },
    errorMessage: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Error message if access failed'
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'access_logs',
    timestamps: false,
    updatedAt: false,
    indexes: [
      {
        fields: ['patientId']
      },
      {
        fields: ['documentId']
      },
      {
        fields: ['accessedBy']
      },
      {
        fields: ['accessType']
      },
      {
        fields: ['createdAt']
      },
      {
        fields: ['blockchainTxHash']
      },
      {
        fields: ['ipAddress']
      },
      {
        composite: true,
        fields: ['patientId', 'accessedBy', 'createdAt']
      },
      {
        composite: true,
        fields: ['documentId', 'accessType', 'createdAt']
      }
    ]
  })

  AccessLog.logAccess = async function(data) {
    try {
      return await this.create({
        patientId: data.patientId,
        documentId: data.documentId || null,
        accessedBy: data.accessedBy,
        accessType: data.accessType,
        ipAddress: data.ipAddress || null,
        userAgent: data.userAgent || null,
        sessionId: data.sessionId || null,
        blockchainTxHash: data.blockchainTxHash || null,
        accessReason: data.accessReason || null,
        permissionGrantedBy: data.permissionGrantedBy || null,
        accessDuration: data.accessDuration || null,
        metadata: data.metadata || null,
        success: data.success !== false,
        errorMessage: data.errorMessage || null
      })
    } catch (error) {
      console.error('Failed to log access:', error)
      throw error
    }
  }

  return AccessLog
}