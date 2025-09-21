module.exports = (sequelize, DataTypes) => {
  const Patient = sequelize.define('Patient', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    patientId: {
      type: DataTypes.STRING(66), // 0x + 64 chars for bytes32
      allowNull: false,
      unique: true,
      comment: 'Blockchain patient ID (bytes32)'
    },
    firstName: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    lastName: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    dateOfBirth: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    gender: {
      type: DataTypes.ENUM('male', 'female', 'other'),
      allowNull: false
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: true,
      validate: {
        isEmail: true
      }
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    emergencyContact: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Emergency contact information'
    },
    medicalHistory: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    allergies: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'List of known allergies'
    },
    medications: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Current medications'
    },
    guardianAddress: {
      type: DataTypes.STRING(42), // Ethereum address
      allowNull: true,
      comment: 'Guardian wallet address'
    },
    psychologistAddress: {
      type: DataTypes.STRING(42),
      allowNull: true,
      comment: 'Pediatric psychologist wallet address'
    },
    insurerAddress: {
      type: DataTypes.STRING(42),
      allowNull: true,
      comment: 'Insurer wallet address'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    encryptionKey: {
      type: DataTypes.STRING(256),
      allowNull: true,
      comment: 'Patient-specific encryption key hash'
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
    tableName: 'patients',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['patientId']
      },
      {
        fields: ['email']
      },
      {
        fields: ['guardianAddress']
      },
      {
        fields: ['psychologistAddress']
      },
      {
        fields: ['insurerAddress']
      },
      {
        fields: ['isActive']
      }
    ]
  })

  Patient.prototype.toSafeJSON = function() {
    const values = Object.assign({}, this.get())
    delete values.encryptionKey
    return values
  }

  return Patient
}