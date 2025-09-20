// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title AutismMedicalSystemSimple
 * @dev Simplified autism evaluation management system for testing
 * Core functionality: Upload evaluations, track diagnosis, manage access
 */
contract AutismMedicalSystemSimple is ERC721, ERC721URIStorage, AccessControl, ReentrancyGuard {
    bytes32 public constant INSURANCE_ROLE = keccak256("INSURANCE_ROLE");
    bytes32 public constant HOSPITAL_ROLE = keccak256("HOSPITAL_ROLE");
    bytes32 public constant EVALUATOR_ROLE = keccak256("EVALUATOR_ROLE");

    uint256 private _tokenIdCounter;

    // Evaluation types for autism spectrum
    enum EvaluationType {
        ADOS,           // Autism Diagnostic Observation Schedule
        ADIR,           // Autism Diagnostic Interview-Revised
        CARS,           // Childhood Autism Rating Scale
        MCHAT,          // Modified Checklist for Autism in Toddlers
        GARS,           // Gilliam Autism Rating Scale
        SRS,            // Social Responsiveness Scale
        ABC,            // Autism Behavior Checklist
        ASRS            // Autism Spectrum Rating Scales
    }

    // Diagnosis severity levels (DSM-5)
    enum SeverityLevel {
        None,
        Level1_RequiringSupport,
        Level2_RequiringSubstantialSupport,
        Level3_RequiringVerySubstantialSupport
    }

    struct InsuranceInfo {
        string insuranceProvider;      // Insurance company name
        string policyNumber;           // Patient's policy number
        string memberID;               // Member ID
        string insuranceXRPL;          // Insurance company XRPL wallet
        uint256 coveragePercentage;    // Coverage percentage (0-100)
        bool isVerified;               // Insurance verification status
    }

    struct AutismEvaluation {
        uint256 tokenId;
        address patient;
        address evaluator;              // Professional who conducted evaluation
        bytes32 fileHash;               // Encrypted file hash
        string fileLocation;            // S3/IPFS location
        bytes32 encryptedKey;           // Encrypted access key
        EvaluationType evaluationType;
        uint256 evaluationDate;
        uint256 uploadDate;
        bool isPaidByInsurance;
        string insurancePaymentTx;      // XRPL transaction hash
        uint256 evaluationCostUSD;
        InsuranceInfo insurance;
    }

    struct DiagnosisRecord {
        SeverityLevel currentLevel;
        uint256 firstDiagnosisDate;
        uint256 lastUpdateDate;
        string primaryDiagnosis;        // e.g., "299.00 Autistic Disorder"
        uint256 totalEvaluations;
    }

    struct AccessRecord {
        address accessor;               // Hospital/Insurance who accessed
        uint256 accessTime;
        string purpose;                 // Reason for access
        bool isPaid;                    // Whether they paid for access
    }

    struct Bill {
        bytes32 billId;
        uint256 evaluationTokenId;
        address hospital;
        address patient;
        uint256 amountUSD;
        uint256 insurancePortion;       // Amount insurance will pay
        uint256 patientPortion;         // Patient responsibility
        bool isPaid;
        uint256 createdAt;
    }

    // State mappings
    mapping(uint256 => AutismEvaluation) public evaluations;
    mapping(address => DiagnosisRecord) public patientDiagnosis;
    mapping(uint256 => AccessRecord[]) public accessHistory;
    mapping(uint256 => mapping(address => bool)) public hasPaidAccess;
    mapping(bytes32 => Bill) public medicalBills;
    mapping(address => bytes32[]) public patientBills;
    mapping(string => bool) public verifiedInsuranceProviders;

    // Statistics
    uint256 public totalEvaluations;
    uint256 public totalInsurancePayments;
    uint256 public totalDiagnosedPatients;

    // Events
    event EvaluationUploaded(
        uint256 indexed tokenId,
        address indexed patient,
        EvaluationType evaluationType,
        bool paidByInsurance
    );

    event InsurancePaymentProcessed(
        uint256 indexed tokenId,
        string insuranceProvider,
        string xrplTxHash,
        uint256 amountUSD
    );

    event FileAccessGranted(
        uint256 indexed tokenId,
        address indexed accessor,
        string purpose,
        bool requiresPayment
    );

    event BillCreated(
        bytes32 indexed billId,
        uint256 indexed tokenId,
        address indexed patient,
        uint256 totalAmount,
        uint256 insurancePortion
    );

    event DiagnosisUpdated(
        address indexed patient,
        SeverityLevel newLevel,
        uint256 evaluationTokenId
    );

    constructor() ERC721("Autism Evaluation NFT", "AEN") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);

        // Add some default verified insurance providers
        verifiedInsuranceProviders["Blue Cross Blue Shield"] = true;
        verifiedInsuranceProviders["Aetna"] = true;
        verifiedInsuranceProviders["UnitedHealthcare"] = true;
        verifiedInsuranceProviders["Test Insurance Co"] = true;
    }

    /**
     * @dev FLOW 1: Upload evaluation with insurance payment
     */
    function uploadEvaluationWithInsurance(
        InsuranceInfo memory insurance,
        bytes32 fileHash,
        string memory fileLocation,
        bytes32 encryptedKey,
        EvaluationType evaluationType,
        uint256 evaluationCostUSD,
        string memory insurancePaymentTxHash
    ) external nonReentrant returns (uint256 tokenId) {
        // Verify insurance information
        require(bytes(insurance.insuranceProvider).length > 0, "Invalid insurance");
        require(verifiedInsuranceProviders[insurance.insuranceProvider], "Insurance not verified");

        // For demo purposes, we'll accept the payment hash without full verification
        require(bytes(insurancePaymentTxHash).length > 0, "Insurance payment hash required");

        // Mint NFT
        tokenId = _tokenIdCounter++;
        _safeMint(msg.sender, tokenId);

        // Store evaluation data
        AutismEvaluation storage eval = evaluations[tokenId];
        eval.tokenId = tokenId;
        eval.patient = msg.sender;
        eval.fileHash = fileHash;
        eval.fileLocation = fileLocation;
        eval.encryptedKey = encryptedKey;
        eval.evaluationType = evaluationType;
        eval.evaluationDate = block.timestamp;
        eval.uploadDate = block.timestamp;
        eval.isPaidByInsurance = true;
        eval.insurancePaymentTx = insurancePaymentTxHash;
        eval.evaluationCostUSD = evaluationCostUSD;
        eval.insurance = insurance;

        // Mark as paid by insurance
        hasPaidAccess[tokenId][address(this)] = true;

        // Update patient diagnosis record
        _updatePatientDiagnosis(msg.sender, tokenId);

        totalEvaluations++;
        totalInsurancePayments++;

        emit EvaluationUploaded(tokenId, msg.sender, evaluationType, true);
        emit InsurancePaymentProcessed(
            tokenId,
            insurance.insuranceProvider,
            insurancePaymentTxHash,
            evaluationCostUSD
        );

        return tokenId;
    }

    /**
     * @dev FLOW 2: Hospital/Insurance can check and download file
     */
    function accessEvaluationFile(
        uint256 tokenId,
        string memory purpose
    ) external nonReentrant returns (
        string memory fileLocation,
        bytes32 encryptedKey,
        bool requiresPayment
    ) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        require(
            hasRole(HOSPITAL_ROLE, msg.sender) ||
            hasRole(INSURANCE_ROLE, msg.sender),
            "Not authorized"
        );

        AutismEvaluation storage eval = evaluations[tokenId];

        // Check if already paid (by insurance or previous access)
        bool alreadyPaid = eval.isPaidByInsurance || hasPaidAccess[tokenId][msg.sender];

        if (!alreadyPaid) {
            requiresPayment = true;
            return ("", 0, true);
        }

        // Grant access
        hasPaidAccess[tokenId][msg.sender] = true;

        // Log access
        AccessRecord memory record = AccessRecord({
            accessor: msg.sender,
            accessTime: block.timestamp,
            purpose: purpose,
            isPaid: true
        });

        accessHistory[tokenId].push(record);

        emit FileAccessGranted(tokenId, msg.sender, purpose, false);

        return (eval.fileLocation, eval.encryptedKey, false);
    }

    /**
     * @dev FLOW 3: Hospital can bill patient through insurance
     */
    function billPatientThroughInsurance(
        uint256 evaluationTokenId,
        uint256 serviceAmountUSD,
        string memory serviceDescription
    ) external nonReentrant returns (bytes32 billId) {
        require(hasRole(HOSPITAL_ROLE, msg.sender), "Not a hospital");
        require(_ownerOf(evaluationTokenId) != address(0), "Invalid evaluation");

        AutismEvaluation storage eval = evaluations[evaluationTokenId];

        // Calculate insurance coverage (simplified)
        uint256 coverageAmount = (serviceAmountUSD * eval.insurance.coveragePercentage) / 100;
        uint256 insurancePays = coverageAmount;
        uint256 patientPays = serviceAmountUSD - coverageAmount;

        // Create bill
        billId = keccak256(abi.encodePacked(
            evaluationTokenId,
            msg.sender,
            serviceAmountUSD,
            block.timestamp
        ));

        Bill storage bill = medicalBills[billId];
        bill.billId = billId;
        bill.evaluationTokenId = evaluationTokenId;
        bill.hospital = msg.sender;
        bill.patient = eval.patient;
        bill.amountUSD = serviceAmountUSD;
        bill.insurancePortion = insurancePays;
        bill.patientPortion = patientPays;
        bill.createdAt = block.timestamp;

        patientBills[eval.patient].push(billId);

        emit BillCreated(
            billId,
            evaluationTokenId,
            eval.patient,
            serviceAmountUSD,
            insurancePays
        );

        return billId;
    }

    /**
     * @dev FLOW 4: Track diagnosis history for patient
     */
    function updateDiagnosis(
        address patient,
        uint256 evaluationTokenId,
        SeverityLevel newLevel,
        string memory primaryDiagnosis
    ) external {
        require(hasRole(EVALUATOR_ROLE, msg.sender), "Not authorized evaluator");
        require(_ownerOf(evaluationTokenId) != address(0), "Invalid evaluation");

        DiagnosisRecord storage diagnosis = patientDiagnosis[patient];

        // First diagnosis
        if (diagnosis.firstDiagnosisDate == 0) {
            diagnosis.firstDiagnosisDate = block.timestamp;
            totalDiagnosedPatients++;
        }

        // Update current state
        diagnosis.currentLevel = newLevel;
        diagnosis.lastUpdateDate = block.timestamp;
        diagnosis.primaryDiagnosis = primaryDiagnosis;
        diagnosis.totalEvaluations++;

        emit DiagnosisUpdated(patient, newLevel, evaluationTokenId);
    }

    /**
     * @dev Get patient diagnosis record
     */
    function getPatientDiagnosis(address patient) external view returns (
        SeverityLevel currentLevel,
        uint256 firstDiagnosisDate,
        uint256 lastUpdateDate,
        string memory primaryDiagnosis,
        uint256 totalEvals
    ) {
        DiagnosisRecord storage diagnosis = patientDiagnosis[patient];
        return (
            diagnosis.currentLevel,
            diagnosis.firstDiagnosisDate,
            diagnosis.lastUpdateDate,
            diagnosis.primaryDiagnosis,
            diagnosis.totalEvaluations
        );
    }

    /**
     * @dev Get evaluation details
     */
    function getEvaluation(uint256 tokenId) external view returns (
        address patient,
        EvaluationType evaluationType,
        uint256 evaluationDate,
        bool isPaidByInsurance,
        string memory insuranceProvider
    ) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        AutismEvaluation storage eval = evaluations[tokenId];

        return (
            eval.patient,
            eval.evaluationType,
            eval.evaluationDate,
            eval.isPaidByInsurance,
            eval.insurance.insuranceProvider
        );
    }

    /**
     * @dev Get access history for an evaluation
     */
    function getAccessHistory(uint256 tokenId) external view returns (AccessRecord[] memory) {
        return accessHistory[tokenId];
    }

    /**
     * @dev Get patient's medical bills
     */
    function getPatientBills(address patient) external view returns (bytes32[] memory) {
        return patientBills[patient];
    }

    /**
     * @dev Pay medical bill (simplified)
     */
    function payBill(bytes32 billId, string memory xrplPaymentTx) external {
        Bill storage bill = medicalBills[billId];
        require(!bill.isPaid, "Bill already paid");
        require(bill.patient == msg.sender, "Not bill owner");
        require(bytes(xrplPaymentTx).length > 0, "Payment transaction required");

        bill.isPaid = true;
    }

    // Internal functions

    function _updatePatientDiagnosis(address patient, uint256 tokenId) internal {
        DiagnosisRecord storage diagnosis = patientDiagnosis[patient];

        if (diagnosis.firstDiagnosisDate == 0) {
            diagnosis.firstDiagnosisDate = block.timestamp;
        }

        diagnosis.lastUpdateDate = block.timestamp;
        diagnosis.totalEvaluations++;
    }

    function _ownerOf(uint256 tokenId) internal view override returns (address) {
        return evaluations[tokenId].patient;
    }

    // Admin functions

    function addVerifiedInsurance(string memory provider) external onlyRole(DEFAULT_ADMIN_ROLE) {
        verifiedInsuranceProviders[provider] = true;
    }

    function grantRole(bytes32 role, address account) public override onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(role, account);
    }

    // Get available evaluation types
    function getEvaluationTypes() external pure returns (string[] memory) {
        string[] memory types = new string[](8);
        types[0] = "ADOS";
        types[1] = "ADIR";
        types[2] = "CARS";
        types[3] = "MCHAT";
        types[4] = "GARS";
        types[5] = "SRS";
        types[6] = "ABC";
        types[7] = "ASRS";
        return types;
    }

    // Get severity levels
    function getSeverityLevels() external pure returns (string[] memory) {
        string[] memory levels = new string[](4);
        levels[0] = "None";
        levels[1] = "Level1_RequiringSupport";
        levels[2] = "Level2_RequiringSubstantialSupport";
        levels[3] = "Level3_RequiringVerySubstantialSupport";
        return levels;
    }

    // Override functions
    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, AccessControl, ERC721URIStorage) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}