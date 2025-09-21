'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('documents', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      patientId: {
        type: Sequelize.STRING(66),
        allowNull: false,
        references: {
          model: 'patients',
          key: 'patientId'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      documentType: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      title: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      originalFilename: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      fileType: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      fileSize: {
        type: Sequelize.BIGINT,
        allowNull: false
      },
      ipfsCid: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      ipfsURI: {
        type: Sequelize.STRING(120),
        allowNull: false
      },
      encryptionHash: {
        type: Sequelize.STRING(64),
        allowNull: false
      },
      version: {
        type: Sequelize.INTEGER,
        defaultValue: 1
      },
      blockchainTxHash: {
        type: Sequelize.STRING(66),
        allowNull: true
      },
      blockNumber: {
        type: Sequelize.BIGINT,
        allowNull: true
      },
      gasUsed: {
        type: Sequelize.STRING(20),
        allowNull: true
      },
      uploadedBy: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      status: {
        type: Sequelize.ENUM('uploading', 'processing', 'completed', 'failed'),
        defaultValue: 'uploading'
      },
      metadata: {
        type: Sequelize.JSONB,
        allowNull: true
      },
      tags: {
        type: Sequelize.JSONB,
        allowNull: true
      },
      isEncrypted: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      isPinned: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      expiresAt: {
        type: Sequelize.DATE,
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
    await queryInterface.addIndex('documents', ['patientId'])
    await queryInterface.addIndex('documents', ['documentType'])
    await queryInterface.addIndex('documents', ['ipfsCid'])
    await queryInterface.addIndex('documents', ['blockchainTxHash'])
    await queryInterface.addIndex('documents', ['uploadedBy'])
    await queryInterface.addIndex('documents', ['status'])
    await queryInterface.addIndex('documents', ['createdAt'])
    await queryInterface.addIndex('documents', ['patientId', 'documentType', 'version'], {
      name: 'idx_patient_doc_type_version'
    })
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('documents')
  }
}