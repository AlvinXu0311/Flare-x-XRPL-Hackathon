const { sequelize } = require('../config/database')
const { DataTypes } = require('sequelize')

// Import models
const Patient = require('./Patient')(sequelize, DataTypes)
const Document = require('./Document')(sequelize, DataTypes)
const User = require('./User')(sequelize, DataTypes)
const AccessLog = require('./AccessLog')(sequelize, DataTypes)

// Define associations
Patient.hasMany(Document, {
  foreignKey: 'patientId',
  as: 'documents'
})

Document.belongsTo(Patient, {
  foreignKey: 'patientId',
  as: 'patient'
})

User.hasMany(Document, {
  foreignKey: 'uploadedBy',
  as: 'uploadedDocuments'
})

Document.belongsTo(User, {
  foreignKey: 'uploadedBy',
  as: 'uploader'
})

Patient.hasMany(AccessLog, {
  foreignKey: 'patientId',
  as: 'accessLogs'
})

AccessLog.belongsTo(Patient, {
  foreignKey: 'patientId',
  as: 'patient'
})

User.hasMany(AccessLog, {
  foreignKey: 'accessedBy',
  as: 'accessLogs'
})

AccessLog.belongsTo(User, {
  foreignKey: 'accessedBy',
  as: 'accessor'
})

Document.hasMany(AccessLog, {
  foreignKey: 'documentId',
  as: 'accessLogs'
})

AccessLog.belongsTo(Document, {
  foreignKey: 'documentId',
  as: 'document'
})

// Export models and sequelize instance
module.exports = {
  sequelize,
  Patient,
  Document,
  User,
  AccessLog
}