'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('patients', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      patientId: {
        type: Sequelize.STRING(66),
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
      dateOfBirth: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      gender: {
        type: Sequelize.ENUM('male', 'female', 'other'),
        allowNull: false
      },
      email: {
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
      emergencyContact: {
        type: Sequelize.JSONB,
        allowNull: true
      },
      medicalHistory: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      allergies: {
        type: Sequelize.JSONB,
        allowNull: true
      },
      medications: {
        type: Sequelize.JSONB,
        allowNull: true
      },
      guardianAddress: {
        type: Sequelize.STRING(42),
        allowNull: true
      },
      psychologistAddress: {
        type: Sequelize.STRING(42),
        allowNull: true
      },
      insurerAddress: {
        type: Sequelize.STRING(42),
        allowNull: true
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      encryptionKey: {
        type: Sequelize.STRING(256),
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
    await queryInterface.addIndex('patients', ['patientId'], { unique: true })
    await queryInterface.addIndex('patients', ['email'])
    await queryInterface.addIndex('patients', ['guardianAddress'])
    await queryInterface.addIndex('patients', ['psychologistAddress'])
    await queryInterface.addIndex('patients', ['insurerAddress'])
    await queryInterface.addIndex('patients', ['isActive'])
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('patients')
  }
}