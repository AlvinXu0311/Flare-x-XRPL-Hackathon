'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('access_logs', {
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
        onDelete: 'CASCADE'
      },
      documentId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'documents',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      accessedBy: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      accessType: {
        type: Sequelize.ENUM('view', 'download', 'upload', 'update', 'delete', 'share'),
        allowNull: false
      },
      ipAddress: {
        type: Sequelize.INET,
        allowNull: true
      },
      userAgent: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      sessionId: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      blockchainTxHash: {
        type: Sequelize.STRING(66),
        allowNull: true
      },
      accessReason: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      permissionGrantedBy: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      accessDuration: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      metadata: {
        type: Sequelize.JSONB,
        allowNull: true
      },
      success: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      errorMessage: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      createdAt: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      }
    })

    // Add indexes
    await queryInterface.addIndex('access_logs', ['patientId'])
    await queryInterface.addIndex('access_logs', ['documentId'])
    await queryInterface.addIndex('access_logs', ['accessedBy'])
    await queryInterface.addIndex('access_logs', ['accessType'])
    await queryInterface.addIndex('access_logs', ['createdAt'])
    await queryInterface.addIndex('access_logs', ['blockchainTxHash'])
    await queryInterface.addIndex('access_logs', ['ipAddress'])
    await queryInterface.addIndex('access_logs', ['patientId', 'accessedBy', 'createdAt'], {
      name: 'idx_patient_accessor_time'
    })
    await queryInterface.addIndex('access_logs', ['documentId', 'accessType', 'createdAt'], {
      name: 'idx_doc_access_type_time'
    })
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('access_logs')
  }
}