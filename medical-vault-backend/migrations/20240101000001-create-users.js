'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('users', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      walletAddress: {
        type: Sequelize.STRING(42),
        allowNull: false,
        unique: true
      },
      email: {
        type: Sequelize.STRING(255),
        allowNull: false,
        unique: true
      },
      username: {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true
      },
      firstName: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      lastName: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      role: {
        type: Sequelize.ENUM('admin', 'guardian', 'psychologist', 'insurer', 'patient'),
        allowNull: false,
        defaultValue: 'patient'
      },
      passwordHash: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      profilePicture: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      bio: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      licenseNumber: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      specialty: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      organization: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      phone: {
        type: Sequelize.STRING(20),
        allowNull: true
      },
      address: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      timezone: {
        type: Sequelize.STRING(50),
        allowNull: true,
        defaultValue: 'UTC'
      },
      preferences: {
        type: Sequelize.JSONB,
        allowNull: true
      },
      permissions: {
        type: Sequelize.JSONB,
        allowNull: true
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      isVerified: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      lastLoginAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      loginCount: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      twoFactorEnabled: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      twoFactorSecret: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      createdAt: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      },
      updatedAt: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      }
    })

    // Add indexes
    await queryInterface.addIndex('users', ['walletAddress'], { unique: true })
    await queryInterface.addIndex('users', ['email'], { unique: true })
    await queryInterface.addIndex('users', ['username'], { unique: true })
    await queryInterface.addIndex('users', ['role'])
    await queryInterface.addIndex('users', ['isActive'])
    await queryInterface.addIndex('users', ['isVerified'])
    await queryInterface.addIndex('users', ['licenseNumber'])
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('users')
  }
}