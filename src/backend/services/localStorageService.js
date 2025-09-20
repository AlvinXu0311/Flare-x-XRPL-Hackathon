const fs = require('fs');
const path = require('path');

class LocalStorageService {
  constructor() {
    this.dataFile = path.join(process.cwd(), 'data', 'evaluations.json');
    this.uploadsDir = path.join(process.cwd(), 'uploads');
    this.ensureDirectories();
    this.data = this.loadData();
  }

  ensureDirectories() {
    const dataDir = path.dirname(this.dataFile);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
  }

  loadData() {
    try {
      if (fs.existsSync(this.dataFile)) {
        const data = fs.readFileSync(this.dataFile, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.warn('Could not load data file, starting fresh:', error.message);
    }
    return {
      evaluations: [],
      paymentIntents: [],
      accessLogs: []
    };
  }

  saveData() {
    try {
      fs.writeFileSync(this.dataFile, JSON.stringify(this.data, null, 2));
    } catch (error) {
      console.error('Failed to save data:', error);
    }
  }

  // Evaluation methods
  createEvaluation(evaluation) {
    this.data.evaluations.push({
      ...evaluation,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    this.saveData();
    return evaluation;
  }

  findEvaluationById(id) {
    return this.data.evaluations.find(item => item.id === id);
  }

  findEvaluationByTokenId(tokenId) {
    return this.data.evaluations.find(item => item.nftTokenId === tokenId);
  }

  getAllEvaluations(limit = 50, offset = 0) {
    const sorted = this.data.evaluations.sort((a, b) =>
      new Date(b.createdAt) - new Date(a.createdAt)
    );
    return {
      evaluations: sorted.slice(offset, offset + limit),
      total: this.data.evaluations.length
    };
  }

  searchEvaluations(query) {
    let results = this.data.evaluations;

    if (query.tokenId) {
      results = results.filter(item =>
        item.nftTokenId.toLowerCase().includes(query.tokenId.toLowerCase())
      );
    }

    if (query.patientName) {
      results = results.filter(item =>
        item.patientInfo.firstName.toLowerCase().includes(query.patientName.toLowerCase()) ||
        item.patientInfo.lastName.toLowerCase().includes(query.patientName.toLowerCase())
      );
    }

    if (query.evaluationType) {
      results = results.filter(item =>
        item.patientInfo.evaluationType === query.evaluationType
      );
    }

    return results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  updateEvaluation(id, updates) {
    const index = this.data.evaluations.findIndex(item => item.id === id);
    if (index !== -1) {
      this.data.evaluations[index] = {
        ...this.data.evaluations[index],
        ...updates,
        updatedAt: new Date().toISOString()
      };
      this.saveData();
      return this.data.evaluations[index];
    }
    return null;
  }

  deleteEvaluation(id) {
    const index = this.data.evaluations.findIndex(item => item.id === id);
    if (index !== -1) {
      const removed = this.data.evaluations.splice(index, 1)[0];
      this.saveData();
      return removed;
    }
    return null;
  }

  // Payment Intent methods
  createPaymentIntent(paymentIntent) {
    this.data.paymentIntents.push({
      ...paymentIntent,
      createdAt: new Date().toISOString()
    });
    this.saveData();
    return paymentIntent;
  }

  findPaymentIntentById(id) {
    return this.data.paymentIntents.find(intent => intent.id === id);
  }

  updatePaymentIntent(id, updates) {
    const index = this.data.paymentIntents.findIndex(intent => intent.id === id);
    if (index !== -1) {
      this.data.paymentIntents[index] = {
        ...this.data.paymentIntents[index],
        ...updates,
        updatedAt: new Date().toISOString()
      };
      this.saveData();
      return this.data.paymentIntents[index];
    }
    return null;
  }

  // Access Log methods
  createAccessLog(accessLog) {
    this.data.accessLogs.push({
      ...accessLog,
      createdAt: new Date().toISOString()
    });
    this.saveData();
    return accessLog;
  }

  findValidAccess(hospitalId, evaluationId) {
    return this.data.accessLogs.find(log =>
      log.hospitalId === hospitalId &&
      log.evaluationId === evaluationId &&
      log.status === 'active' &&
      new Date(log.expiresAt) > new Date()
    );
  }

  findAccessLogsByHospital(hospitalId, limit = 50) {
    return this.data.accessLogs
      .filter(log => log.hospitalId === hospitalId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, limit);
  }

  updateAccessLog(id, updates) {
    const index = this.data.accessLogs.findIndex(log => log.id === id);
    if (index !== -1) {
      this.data.accessLogs[index] = {
        ...this.data.accessLogs[index],
        ...updates,
        updatedAt: new Date().toISOString()
      };
      this.saveData();
      return this.data.accessLogs[index];
    }
    return null;
  }

  // Statistics
  getStats() {
    return {
      totalEvaluations: this.data.evaluations.length,
      totalPaymentIntents: this.data.paymentIntents.length,
      totalAccessLogs: this.data.accessLogs.length,
      evaluationsByType: this.data.evaluations.reduce((acc, item) => {
        const type = item.patientInfo.evaluationType;
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {})
    };
  }

  // Backup and restore
  backup() {
    const backupFile = path.join(
      path.dirname(this.dataFile),
      `backup_${new Date().toISOString().split('T')[0]}.json`
    );
    fs.copyFileSync(this.dataFile, backupFile);
    return backupFile;
  }

  restore(backupFile) {
    if (fs.existsSync(backupFile)) {
      fs.copyFileSync(backupFile, this.dataFile);
      this.data = this.loadData();
      return true;
    }
    return false;
  }
}

module.exports = new LocalStorageService();