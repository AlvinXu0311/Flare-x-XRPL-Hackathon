const express = require('express');
const multer = require('multer');
const autismMedicalService = require('../services/autismMedicalService');

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept common medical file formats
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'application/json'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, JPEG, PNG, and JSON files are allowed.'));
    }
  }
});

/**
 * FLOW 1: Patient uploads evaluation with insurance payment
 * POST /api/autism/upload-evaluation
 */
router.post('/upload-evaluation', upload.single('evaluationFile'), async (req, res) => {
  try {
    const {
      patientAddress,
      evaluationType,
      evaluationCostUSD,
      insuranceProvider,
      policyNumber,
      groupNumber,
      memberID,
      insuranceXRPL,
      coveragePercentage,
      deductible,
      deductibleMet,
      insurancePaymentTxHash
    } = req.body;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No evaluation file uploaded'
      });
    }

    // Validate required fields
    if (!patientAddress || !evaluationType || !insurancePaymentTxHash) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: patientAddress, evaluationType, or insurancePaymentTxHash'
      });
    }

    const patientData = {
      patientAddress,
      evaluationFile: req.file,
      evaluationType,
      evaluationCostUSD: parseFloat(evaluationCostUSD),
      insuranceInfo: {
        provider: insuranceProvider,
        policyNumber,
        groupNumber,
        memberID,
        insuranceXRPL,
        coveragePercentage: parseInt(coveragePercentage),
        deductible: parseFloat(deductible),
        deductibleMet: parseFloat(deductibleMet)
      },
      insurancePaymentTxHash
    };

    const result = await autismMedicalService.uploadEvaluationWithInsurance(patientData);

    res.json({
      success: true,
      message: 'Evaluation uploaded and tokenized successfully',
      data: result
    });

  } catch (error) {
    console.error('Upload evaluation error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * FLOW 2: Hospital/Insurance accesses evaluation file
 * POST /api/autism/access-evaluation
 */
router.post('/access-evaluation', async (req, res) => {
  try {
    const { tokenId, accessorAddress, purpose } = req.body;

    if (!tokenId || !accessorAddress || !purpose) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: tokenId, accessorAddress, or purpose'
      });
    }

    const result = await autismMedicalService.accessEvaluationFile(
      tokenId,
      accessorAddress,
      purpose
    );

    if (!result.success && result.requiresPayment) {
      return res.status(402).json({
        success: false,
        requiresPayment: true,
        message: result.message,
        accessCost: result.accessCost
      });
    }

    res.json({
      success: true,
      message: 'File access granted',
      data: result
    });

  } catch (error) {
    console.error('Access evaluation error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * FLOW 3: Hospital bills patient through insurance
 * POST /api/autism/bill-patient
 */
router.post('/bill-patient', async (req, res) => {
  try {
    const {
      evaluationTokenId,
      hospitalAddress,
      serviceAmountUSD,
      serviceDescription
    } = req.body;

    if (!evaluationTokenId || !hospitalAddress || !serviceAmountUSD || !serviceDescription) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    const billingData = {
      evaluationTokenId,
      hospitalAddress,
      serviceAmountUSD: parseFloat(serviceAmountUSD),
      serviceDescription
    };

    const result = await autismMedicalService.billPatientThroughInsurance(billingData);

    res.json({
      success: true,
      message: 'Bill created successfully',
      data: result
    });

  } catch (error) {
    console.error('Billing error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * FLOW 4: Update patient diagnosis
 * POST /api/autism/update-diagnosis
 */
router.post('/update-diagnosis', async (req, res) => {
  try {
    const {
      patientAddress,
      evaluationTokenId,
      severityLevel,
      primaryDiagnosis,
      comorbidities,
      notes,
      evaluatorAddress
    } = req.body;

    if (!patientAddress || !evaluationTokenId || !severityLevel || !primaryDiagnosis) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    const diagnosisData = {
      patientAddress,
      evaluationTokenId,
      severityLevel,
      primaryDiagnosis,
      comorbidities: comorbidities || [],
      notes: notes || '',
      evaluatorAddress
    };

    const result = await autismMedicalService.updatePatientDiagnosis(diagnosisData);

    res.json({
      success: true,
      message: 'Diagnosis updated successfully',
      data: result
    });

  } catch (error) {
    console.error('Diagnosis update error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get patient diagnosis history
 * GET /api/autism/diagnosis-history/:patientAddress
 */
router.get('/diagnosis-history/:patientAddress', async (req, res) => {
  try {
    const { patientAddress } = req.params;

    if (!patientAddress) {
      return res.status(400).json({
        success: false,
        error: 'Patient address is required'
      });
    }

    const result = await autismMedicalService.getPatientDiagnosisHistory(patientAddress);

    res.json({
      success: true,
      message: 'Diagnosis history retrieved successfully',
      data: result
    });

  } catch (error) {
    console.error('Get diagnosis history error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get evaluation access history
 * GET /api/autism/access-history/:tokenId
 */
router.get('/access-history/:tokenId', async (req, res) => {
  try {
    const { tokenId } = req.params;

    if (!tokenId) {
      return res.status(400).json({
        success: false,
        error: 'Token ID is required'
      });
    }

    const result = await autismMedicalService.getEvaluationAccessHistory(tokenId);

    res.json({
      success: true,
      message: 'Access history retrieved successfully',
      data: result
    });

  } catch (error) {
    console.error('Get access history error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get patient bills
 * GET /api/autism/patient-bills/:patientAddress
 */
router.get('/patient-bills/:patientAddress', async (req, res) => {
  try {
    const { patientAddress } = req.params;

    const billIds = await autismMedicalService.contract.getPatientBills(patientAddress);

    res.json({
      success: true,
      message: 'Patient bills retrieved successfully',
      data: {
        patientAddress,
        billIds: billIds.map(id => id.toString()),
        totalBills: billIds.length
      }
    });

  } catch (error) {
    console.error('Get patient bills error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Pay medical bill
 * POST /api/autism/pay-bill
 */
router.post('/pay-bill', async (req, res) => {
  try {
    const { billId, xrplPaymentTx } = req.body;

    if (!billId || !xrplPaymentTx) {
      return res.status(400).json({
        success: false,
        error: 'Missing billId or xrplPaymentTx'
      });
    }

    const tx = await autismMedicalService.contract.payBill(
      billId,
      ethers.keccak256(ethers.toUtf8Bytes(xrplPaymentTx))
    );

    const receipt = await tx.wait();

    res.json({
      success: true,
      message: 'Bill paid successfully',
      data: {
        billId,
        xrplPaymentTx,
        transactionHash: tx.hash,
        blockNumber: receipt.blockNumber
      }
    });

  } catch (error) {
    console.error('Pay bill error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get evaluation types
 * GET /api/autism/evaluation-types
 */
router.get('/evaluation-types', (req, res) => {
  res.json({
    success: true,
    data: {
      evaluationTypes: Object.keys(autismMedicalService.evaluationTypes),
      descriptions: {
        'ADOS': 'Autism Diagnostic Observation Schedule',
        'ADIR': 'Autism Diagnostic Interview-Revised',
        'CARS': 'Childhood Autism Rating Scale',
        'MCHAT': 'Modified Checklist for Autism in Toddlers',
        'GARS': 'Gilliam Autism Rating Scale',
        'SRS': 'Social Responsiveness Scale',
        'ABC': 'Autism Behavior Checklist',
        'ASRS': 'Autism Spectrum Rating Scales'
      }
    }
  });
});

/**
 * Get severity levels
 * GET /api/autism/severity-levels
 */
router.get('/severity-levels', (req, res) => {
  res.json({
    success: true,
    data: {
      severityLevels: Object.keys(autismMedicalService.severityLevels),
      descriptions: {
        'None': 'No autism spectrum disorder',
        'Level1_RequiringSupport': 'Level 1: Requiring support',
        'Level2_RequiringSubstantialSupport': 'Level 2: Requiring substantial support',
        'Level3_RequiringVerySubstantialSupport': 'Level 3: Requiring very substantial support'
      }
    }
  });
});

/**
 * Admin: Add verified insurance provider
 * POST /api/autism/admin/add-insurance
 */
router.post('/admin/add-insurance', async (req, res) => {
  try {
    const { insuranceProvider } = req.body;

    if (!insuranceProvider) {
      return res.status(400).json({
        success: false,
        error: 'Insurance provider name is required'
      });
    }

    const result = await autismMedicalService.addVerifiedInsurance(insuranceProvider);

    res.json({
      success: true,
      message: 'Insurance provider added successfully',
      data: result
    });

  } catch (error) {
    console.error('Add insurance provider error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Admin: Grant role to address
 * POST /api/autism/admin/grant-role
 */
router.post('/admin/grant-role', async (req, res) => {
  try {
    const { role, address } = req.body;

    if (!role || !address) {
      return res.status(400).json({
        success: false,
        error: 'Role and address are required'
      });
    }

    const validRoles = ['HOSPITAL_ROLE', 'INSURANCE_ROLE', 'EVALUATOR_ROLE'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        error: `Invalid role. Must be one of: ${validRoles.join(', ')}`
      });
    }

    const result = await autismMedicalService.grantRole(role, address);

    res.json({
      success: true,
      message: 'Role granted successfully',
      data: result
    });

  } catch (error) {
    console.error('Grant role error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;