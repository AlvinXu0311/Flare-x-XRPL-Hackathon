const bcrypt = require('bcryptjs')

module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    walletAddress: {
      type: DataTypes.STRING(42),
      allowNull: false,
      unique: true,
      comment: 'Ethereum wallet address'
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true
      }
    },
    username: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true
    },
    firstName: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    lastName: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    role: {
      type: DataTypes.ENUM('admin', 'guardian', 'psychologist', 'insurer', 'patient'),
      allowNull: false,
      defaultValue: 'patient'
    },
    passwordHash: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Optional password for non-wallet authentication'
    },
    profilePicture: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'IPFS CID or URL to profile picture'
    },
    bio: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    licenseNumber: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Professional license number for healthcare providers'
    },
    specialty: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Medical specialty or area of expertise'
    },
    organization: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Hospital, clinic, or organization name'
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    timezone: {
      type: DataTypes.STRING(50),
      allowNull: true,
      defaultValue: 'UTC'
    },
    preferences: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'User preferences and settings'
    },
    permissions: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Additional role-based permissions'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    isVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Whether user identity is verified'
    },
    lastLoginAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    loginCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    twoFactorEnabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    twoFactorSecret: {
      type: DataTypes.STRING(255),
      allowNull: true
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
    tableName: 'users',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['walletAddress']
      },
      {
        unique: true,
        fields: ['email']
      },
      {
        unique: true,
        fields: ['username']
      },
      {
        fields: ['role']
      },
      {
        fields: ['isActive']
      },
      {
        fields: ['isVerified']
      },
      {
        fields: ['licenseNumber']
      }
    ],
    hooks: {
      beforeCreate: async (user) => {
        if (user.passwordHash) {
          const saltRounds = parseInt(process.env.SALT_ROUNDS) || 12
          user.passwordHash = await bcrypt.hash(user.passwordHash, saltRounds)
        }
      },
      beforeUpdate: async (user) => {
        if (user.changed('passwordHash') && user.passwordHash) {
          const saltRounds = parseInt(process.env.SALT_ROUNDS) || 12
          user.passwordHash = await bcrypt.hash(user.passwordHash, saltRounds)
        }
      }
    }
  })

  User.prototype.validatePassword = async function(password) {
    if (!this.passwordHash) {
      return false
    }
    return await bcrypt.compare(password, this.passwordHash)
  }

  User.prototype.toSafeJSON = function() {
    const values = Object.assign({}, this.get())
    delete values.passwordHash
    delete values.twoFactorSecret
    return values
  }

  User.prototype.getFullName = function() {
    return `${this.firstName} ${this.lastName}`
  }

  User.prototype.updateLoginStats = async function() {
    this.lastLoginAt = new Date()
    this.loginCount = (this.loginCount || 0) + 1
    await this.save()
  }

  return User
}