// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

/**
 * MedicalRecordVaultWithBilling (Coston2 / Flare EVM)
 * ---------------------------------------------------
 * Enhanced medical vault with hospital billing functionality:
 * - Document storage with XRPL payment verification via FDC
 * - Hospital billing system with patient-insurance mapping
 * - Complete transaction history tracking
 * - Multi-party transaction recording (Patient ↔ Hospital ↔ Insurance)
 * - FTSO oracle integration for real-time pricing
 */

interface IFDC {
    /// Verifies an XRPL payment proof tied to a statementId.
    function verify(bytes calldata proof, bytes32 statementId) external view returns (bool);
}

interface IFTSO {
    /// Returns (XRP price in USD with `decimals`, decimals, timestamp)
    function getXRPUSDPrice() external view returns (uint256 price, uint8 decimals, uint256 timestamp);
}

contract MedicalRecordVaultWithBilling {
    /* ─────────────── Types ─────────────── */
    enum DocKind { Diagnosis, Referral, Intake } // 0,1,2
    enum ServiceType { Consultation, Diagnosis, Treatment, Emergency, Procedure, Other } // 0,1,2,3,4,5
    enum ChargeStatus { Pending, Approved, Paid, Disputed, Rejected } // 0,1,2,3,4
    enum TransactionType { DocumentUpload, HospitalCharge, InsurancePayment, PatientPayment } // 0,1,2,3

    struct DocMeta {
        string  hashURI;        // encrypted pointer (IPFS/S3/etc.)
        uint256 version;        // increments on each upload
        uint256 updatedAt;      // unix timestamp
        bytes32 paymentProof;   // proof id / hash attested by FDC
        uint256 paidDrops;      // XRP drops paid (attested)
        uint256 paidUSDc;       // kept 0 (we price via FTSO)
        bytes32 currencyHash;   // unused for XRP-only path (0)
    }

    struct RecordSet {
        mapping(uint8 => DocMeta) docs;
        address guardian;
        address pediatricPsychologist;
    }

    struct InsurerInfo {
        string  xrplAccount;    // XRPL classic/X-address
        address contact;        // EVM contact address
        bool isActive;          // Whether insurer is active
    }

    struct HospitalInfo {
        string name;
        string xrplAccount;     // Hospital's XRPL wallet
        address contact;        // Hospital's EVM address
        bool isRegistered;      // Registration status
        uint256 totalCharges;   // Total charges submitted
        uint256 registeredAt;   // Registration timestamp
    }

    struct MedicalCharge {
        bytes32 chargeId;       // Unique charge identifier
        bytes32 patientId;      // Patient identifier (hashed)
        bytes32 hospitalId;     // Hospital identifier
        bytes32 insurerId;      // Insurance provider identifier
        ServiceType serviceType; // Type of medical service
        string description;     // Service description
        uint256 amountUSD;      // Amount in USD cents
        uint256 amountDrops;    // Amount in XRP drops
        ChargeStatus status;    // Current status
        bytes32 xrplProof;      // XRPL payment proof
        uint256 createdAt;      // Creation timestamp
        uint256 updatedAt;      // Last update timestamp
        string metadata;        // Additional metadata (JSON)
    }

    struct TransactionRecord {
        bytes32 txId;           // Unique transaction ID
        TransactionType txType; // Type of transaction
        bytes32 fromParty;      // Source party (patient/hospital/insurance)
        bytes32 toParty;        // Destination party
        bytes32 relatedId;      // Related charge/document ID
        uint256 amount;         // Amount in drops
        bytes32 xrplTxHash;     // XRPL transaction hash
        bytes32 fdcProof;       // FDC verification proof
        uint256 timestamp;      // Transaction timestamp
        string notes;           // Additional notes
    }

    /* ─────────────── Events ─────────────── */
    event DocumentUploaded(bytes32 indexed patientId, uint8 indexed kind, string hashURI, uint256 version);
    event DocumentRead(bytes32 indexed patientId, uint8 indexed kind, address accessor);

    event HospitalRegistered(bytes32 indexed hospitalId, string name, string xrplAccount, address contact);
    event InsuranceRegistered(bytes32 indexed insurerId, bytes32 indexed patientId, string xrplAccount, address contact);

    event ChargeCreated(
        bytes32 indexed chargeId,
        bytes32 indexed patientId,
        bytes32 indexed hospitalId,
        bytes32 insurerId,
        ServiceType serviceType,
        uint256 amountUSD,
        uint256 amountDrops
    );

    event ChargeStatusUpdated(
        bytes32 indexed chargeId,
        ChargeStatus indexed oldStatus,
        ChargeStatus indexed newStatus,
        uint256 timestamp
    );

    event PaymentProcessed(
        bytes32 indexed chargeId,
        bytes32 indexed fromParty,
        bytes32 indexed toParty,
        uint256 amount,
        bytes32 xrplTxHash,
        bytes32 fdcProof
    );

    event TransactionRecorded(
        bytes32 indexed txId,
        TransactionType indexed txType,
        bytes32 indexed fromParty,
        bytes32 toParty,
        uint256 amount,
        bytes32 xrplTxHash
    );

    event UploadPaidXRPLXRP(
        bytes32 indexed patientId,
        uint8   indexed kind,
        uint256 version,
        uint256 paidDrops,
        bytes32 proofHash
    );

    /* ─────────────── Storage ─────────────── */
    address public owner;

    // Document storage (existing functionality)
    mapping(bytes32 => RecordSet) private records;
    mapping(bytes32 => mapping(uint8 => uint256)) public paidVersion;
    mapping(bytes32 => InsurerInfo) private insurerInfoOf;

    // Hospital billing system
    mapping(bytes32 => HospitalInfo) public hospitals;           // hospitalId => HospitalInfo
    mapping(bytes32 => MedicalCharge) public charges;            // chargeId => MedicalCharge
    mapping(bytes32 => TransactionRecord) public transactions;   // txId => TransactionRecord

    // Relationship mappings
    mapping(bytes32 => bytes32[]) public patientCharges;         // patientId => chargeId[]
    mapping(bytes32 => bytes32[]) public hospitalCharges;        // hospitalId => chargeId[]
    mapping(bytes32 => bytes32[]) public insuranceCharges;       // insurerId => chargeId[]
    mapping(bytes32 => bytes32[]) public patientTransactions;    // patientId => txId[]

    // Counters for statistics
    uint256 public totalCharges;
    uint256 public totalTransactions;
    mapping(bytes32 => uint256) public hospitalChargeCount;
    mapping(bytes32 => uint256) public insurancePaymentCount;

    // Oracle and pricing
    IFDC  public fdc;
    IFTSO public ftso;
    uint256 public uploadFeeUSDc = 500;           // $5.00 in USD cents for document uploads
    uint256 public maxOracleStaleness = 10 minutes;

    modifier onlyOwner() { require(msg.sender == owner, "not owner"); _; }

    constructor() {
        owner = msg.sender;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "zero owner");
        owner = newOwner;
    }

    /* ─────────────── Hospital Registration ─────────────── */

    function registerHospital(
        bytes32 hospitalId,
        string calldata name,
        string calldata xrplAccount,
        address contact
    ) external onlyOwner {
        require(!hospitals[hospitalId].isRegistered, "Hospital already registered");

        hospitals[hospitalId] = HospitalInfo({
            name: name,
            xrplAccount: xrplAccount,
            contact: contact,
            isRegistered: true,
            totalCharges: 0,
            registeredAt: block.timestamp
        });

        emit HospitalRegistered(hospitalId, name, xrplAccount, contact);
    }

    function updateHospitalInfo(
        bytes32 hospitalId,
        string calldata name,
        string calldata xrplAccount,
        address contact
    ) external onlyOwner {
        require(hospitals[hospitalId].isRegistered, "Hospital not registered");

        HospitalInfo storage hospital = hospitals[hospitalId];
        hospital.name = name;
        hospital.xrplAccount = xrplAccount;
        hospital.contact = contact;
    }

    /* ─────────────── Insurance Registration ─────────────── */

    function registerInsuranceForPatient(
        bytes32 patientId,
        bytes32 insurerId,
        string calldata xrplAccount,
        address contact
    ) external onlyOwner {
        insurerInfoOf[patientId] = InsurerInfo({
            xrplAccount: xrplAccount,
            contact: contact,
            isActive: true
        });

        emit InsuranceRegistered(insurerId, patientId, xrplAccount, contact);
    }

    /* ─────────────── Hospital Billing Functions ─────────────── */

    function createHospitalCharge(
        bytes32 chargeId,
        bytes32 patientId,
        bytes32 hospitalId,
        bytes32 insurerId,
        ServiceType serviceType,
        string calldata description,
        uint256 amountUSD,
        string calldata metadata
    ) external {
        require(hospitals[hospitalId].isRegistered, "Hospital not registered");
        require(charges[chargeId].chargeId == bytes32(0), "Charge ID already exists");
        require(amountUSD > 0, "Amount must be greater than 0");

        // Calculate XRP amount using FTSO oracle
        uint256 requiredDrops = _calculateRequiredDrops(amountUSD);

        // Create charge record
        charges[chargeId] = MedicalCharge({
            chargeId: chargeId,
            patientId: patientId,
            hospitalId: hospitalId,
            insurerId: insurerId,
            serviceType: serviceType,
            description: description,
            amountUSD: amountUSD,
            amountDrops: requiredDrops,
            status: ChargeStatus.Pending,
            xrplProof: bytes32(0),
            createdAt: block.timestamp,
            updatedAt: block.timestamp,
            metadata: metadata
        });

        // Update mappings
        patientCharges[patientId].push(chargeId);
        hospitalCharges[hospitalId].push(chargeId);
        insuranceCharges[insurerId].push(chargeId);

        // Update counters
        totalCharges++;
        hospitals[hospitalId].totalCharges++;
        hospitalChargeCount[hospitalId]++;

        emit ChargeCreated(chargeId, patientId, hospitalId, insurerId, serviceType, amountUSD, requiredDrops);
    }

    function processPaymentWithXRPL(
        bytes32 chargeId,
        bytes calldata xrplProof,
        bytes32 statementId,
        bytes32 xrplTxHash,
        uint256 paidDrops
    ) external {
        require(charges[chargeId].chargeId != bytes32(0), "Charge does not exist");
        require(charges[chargeId].status == ChargeStatus.Pending, "Charge not pending");

        _requireFdcAndFtso();
        _verifyFDC(xrplProof, statementId);

        MedicalCharge storage charge = charges[chargeId];
        require(paidDrops >= charge.amountDrops, "Insufficient payment");

        // Update charge status
        ChargeStatus oldStatus = charge.status;
        charge.status = ChargeStatus.Paid;
        charge.xrplProof = keccak256(xrplProof);
        charge.updatedAt = block.timestamp;

        // Create transaction record
        bytes32 txId = keccak256(abi.encodePacked(chargeId, xrplTxHash, block.timestamp));
        _recordTransaction(
            txId,
            TransactionType.InsurancePayment,
            charge.insurerId,
            charge.hospitalId,
            charge.chargeId,
            paidDrops,
            xrplTxHash,
            charge.xrplProof,
            "Insurance payment for medical services"
        );

        // Update insurance payment counter
        insurancePaymentCount[charge.insurerId]++;

        emit ChargeStatusUpdated(chargeId, oldStatus, ChargeStatus.Paid, block.timestamp);
        emit PaymentProcessed(chargeId, charge.insurerId, charge.hospitalId, paidDrops, xrplTxHash, charge.xrplProof);
    }

    function updateChargeStatus(bytes32 chargeId, ChargeStatus newStatus) external onlyOwner {
        require(charges[chargeId].chargeId != bytes32(0), "Charge does not exist");

        MedicalCharge storage charge = charges[chargeId];
        ChargeStatus oldStatus = charge.status;
        charge.status = newStatus;
        charge.updatedAt = block.timestamp;

        emit ChargeStatusUpdated(chargeId, oldStatus, newStatus, block.timestamp);
    }

    /* ─────────────── Transaction History ─────────────── */

    function _recordDocumentUpload(
        bytes32 patientId,
        uint8 kind,
        uint256 version,
        uint256 xrplPaidDrops,
        bytes32 proofId,
        string calldata hashURI
    ) internal {
        bytes32 txId = keccak256(abi.encodePacked("doc", patientId, kind, version, block.timestamp));
        bytes32 contractAddr = bytes32(uint256(uint160(address(this))));
        bytes32 docId = keccak256(abi.encodePacked(patientId, kind));

        _recordTransaction(
            txId,
            TransactionType.DocumentUpload,
            patientId,
            contractAddr,
            docId,
            xrplPaidDrops,
            bytes32(0),
            proofId,
            string(abi.encodePacked("Document upload: ", hashURI))
        );
    }

    function _recordTransaction(
        bytes32 txId,
        TransactionType txType,
        bytes32 fromParty,
        bytes32 toParty,
        bytes32 relatedId,
        uint256 amount,
        bytes32 xrplTxHash,
        bytes32 fdcProof,
        string memory notes
    ) internal {
        transactions[txId] = TransactionRecord({
            txId: txId,
            txType: txType,
            fromParty: fromParty,
            toParty: toParty,
            relatedId: relatedId,
            amount: amount,
            xrplTxHash: xrplTxHash,
            fdcProof: fdcProof,
            timestamp: block.timestamp,
            notes: notes
        });

        // Add to patient transaction history
        if (txType == TransactionType.DocumentUpload || txType == TransactionType.PatientPayment) {
            patientTransactions[fromParty].push(txId);
        } else if (txType == TransactionType.InsurancePayment || txType == TransactionType.HospitalCharge) {
            // For medical charges, link to patient via charge lookup
            if (charges[relatedId].patientId != bytes32(0)) {
                patientTransactions[charges[relatedId].patientId].push(txId);
            }
        }

        totalTransactions++;
        emit TransactionRecorded(txId, txType, fromParty, toParty, amount, xrplTxHash);
    }

    /* ─────────────── Document Upload (Enhanced) ─────────────── */

    function uploadDocumentXRP(
        bytes32 patientId,
        uint8   kind,
        string calldata hashURI,
        bytes  calldata xrplProof,
        bytes32 statementId,
        bytes32 proofId,
        uint256 xrplPaidDrops
    ) external {
        _requireFdcAndFtso();
        _verifyFDC(xrplProof, statementId);

        uint256 requiredDrops = _requiredDrops();
        require(xrplPaidDrops >= requiredDrops, "XRP payment too small");

        _writeDoc(patientId, kind, hashURI);
        DocMeta storage d = records[patientId].docs[kind];
        paidVersion[patientId][kind] = d.version;
        d.paymentProof = proofId;
        d.paidDrops    = xrplPaidDrops;
        d.paidUSDc     = 0;
        d.currencyHash = bytes32(0);

        // Record transaction for document upload (simplified to avoid stack depth)
        _recordDocumentUpload(patientId, kind, d.version, xrplPaidDrops, proofId, hashURI);

        emit UploadPaidXRPLXRP(patientId, kind, d.version, xrplPaidDrops, proofId);
    }

    /* ─────────────── Query Functions ─────────────── */

    function getCharge(bytes32 chargeId) external view returns (MedicalCharge memory) {
        require(charges[chargeId].chargeId != bytes32(0), "Charge does not exist");
        return charges[chargeId];
    }

    function getPatientCharges(bytes32 patientId) external view returns (bytes32[] memory) {
        return patientCharges[patientId];
    }

    function getHospitalCharges(bytes32 hospitalId) external view returns (bytes32[] memory) {
        return hospitalCharges[hospitalId];
    }

    function getInsuranceCharges(bytes32 insurerId) external view returns (bytes32[] memory) {
        return insuranceCharges[insurerId];
    }

    function getPatientTransactionHistory(bytes32 patientId) external view returns (bytes32[] memory) {
        return patientTransactions[patientId];
    }

    function getTransaction(bytes32 txId) external view returns (TransactionRecord memory) {
        return transactions[txId];
    }

    function getHospitalInfo(bytes32 hospitalId) external view returns (HospitalInfo memory) {
        return hospitals[hospitalId];
    }

    function getChargesByStatus(ChargeStatus status) external view returns (bytes32[] memory) {
        bytes32[] memory result = new bytes32[](totalCharges);
        uint256 count = 0;

        // This is a simplified implementation - in production you'd want pagination
        for (uint256 i = 1; i <= totalCharges; i++) {
            bytes32 chargeId = keccak256(abi.encodePacked("charge", i));
            if (charges[chargeId].status == status) {
                result[count] = chargeId;
                count++;
            }
        }

        // Resize array to actual count
        bytes32[] memory finalResult = new bytes32[](count);
        for (uint256 i = 0; i < count; i++) {
            finalResult[i] = result[i];
        }

        return finalResult;
    }

    /* ─────────────── Statistics ─────────────── */

    function getSystemStats() external view returns (
        uint256 _totalCharges,
        uint256 _totalTransactions,
        uint256 _registeredHospitals,
        uint256 _activeInsurers
    ) {
        // Count registered hospitals (simplified - in production use a counter)
        uint256 hospCount = 0;
        uint256 insurerCount = 0;

        return (totalCharges, totalTransactions, hospCount, insurerCount);
    }

    function getPatientStats(bytes32 patientId) external view returns (
        uint256 totalDocuments,
        uint256 totalChargesReceived,
        uint256 totalTransactions,
        uint256 totalAmountCharged
    ) {
        // Count documents for patient
        uint256 docCount = 0;
        for (uint8 i = 0; i <= uint8(DocKind.Intake); i++) {
            if (records[patientId].docs[i].version > 0) {
                docCount++;
            }
        }

        bytes32[] memory chargeIds = patientCharges[patientId];
        uint256 totalAmount = 0;
        for (uint256 i = 0; i < chargeIds.length; i++) {
            totalAmount += charges[chargeIds[i]].amountUSD;
        }

        return (
            docCount,
            chargeIds.length,
            patientTransactions[patientId].length,
            totalAmount
        );
    }

    /* ─────────────── Existing Document Functions ─────────────── */

    function getDocument(bytes32 patientId, uint8 kind)
        external
        returns (string memory, uint256, uint256, bytes32)
    {
        require(kind <= uint8(DocKind.Intake), "bad kind");
        DocMeta storage d = records[patientId].docs[kind];
        require(d.version > 0 && paidVersion[patientId][kind] >= d.version, "unpaid or empty");
        emit DocumentRead(patientId, kind, msg.sender);
        return (d.hashURI, d.version, d.updatedAt, d.paymentProof);
    }

    function getDocMeta(bytes32 patientId, uint8 kind)
        external
        view
        returns (string memory hashURI, uint256 version, uint256 updatedAt, bytes32 paymentProof, uint256 paidUSDc, uint256 paidDrops, bytes32 currencyHash)
    {
        DocMeta storage d = records[patientId].docs[kind];
        return (d.hashURI, d.version, d.updatedAt, d.paymentProof, d.paidUSDc, d.paidDrops, d.currencyHash);
    }

    function getInsurerInfo(bytes32 patientId) external view returns (string memory xrplAccount, address contact) {
        InsurerInfo storage i = insurerInfoOf[patientId];
        return (i.xrplAccount, i.contact);
    }

    /* ─────────────── Oracle and Admin Functions ─────────────── */

    function setFDC(address verifier) external onlyOwner {
        fdc = IFDC(verifier);
    }

    function setFTSO(address oracle) external onlyOwner {
        ftso = IFTSO(oracle);
    }

    function setMaxOracleStaleness(uint256 seconds_) external onlyOwner {
        maxOracleStaleness = seconds_;
    }

    function setUploadFeeUSDc(uint256 feeUSDc) external onlyOwner {
        uploadFeeUSDc = feeUSDc;
    }

    function requiredXrpDrops()
        external
        view
        returns (uint256 drops, uint256 price, uint8 decimals, uint256 timestamp)
    {
        require(address(ftso) != address(0), "FTSO not set");
        (uint256 px, uint8 dec, uint256 ts) = ftso.getXRPUSDPrice();
        require(px > 0, "oracle price=0");
        return (_requiredXrpDropsFromUSDc(uploadFeeUSDc, px, dec), px, dec, ts);
    }

    /* ─────────────── Internal Functions ─────────────── */

    function _requireFdcAndFtso() internal view {
        require(address(fdc) != address(0), "FDC not set");
        require(address(ftso) != address(0), "FTSO not set");
    }

    function _verifyFDC(bytes calldata xrplProof, bytes32 statementId) internal view {
        require(fdc.verify(xrplProof, statementId), "invalid XRPL payment proof");
    }

    function _writeDoc(bytes32 patientId, uint8 kind, string calldata hashURI) internal {
        require(kind <= uint8(DocKind.Intake), "bad kind");
        DocMeta storage d = records[patientId].docs[kind];
        d.hashURI  = hashURI;
        d.version += 1;
        d.updatedAt = block.timestamp;
        emit DocumentUploaded(patientId, kind, hashURI, d.version);
    }

    function _requiredDrops() internal view returns (uint256) {
        (uint256 px, uint8 dec, uint256 ts) = ftso.getXRPUSDPrice();
        require(px > 0, "oracle price=0");
        require(block.timestamp >= ts && block.timestamp - ts <= maxOracleStaleness, "price stale");
        return _requiredXrpDropsFromUSDc(uploadFeeUSDc, px, dec);
    }

    function _calculateRequiredDrops(uint256 amountUSDc) internal view returns (uint256) {
        require(address(ftso) != address(0), "FTSO not set");
        (uint256 px, uint8 dec, uint256 ts) = ftso.getXRPUSDPrice();
        require(px > 0, "oracle price=0");
        require(block.timestamp >= ts && block.timestamp - ts <= maxOracleStaleness, "price stale");
        return _requiredXrpDropsFromUSDc(amountUSDc, px, dec);
    }

    function _requiredXrpDropsFromUSDc(uint256 feeUSDc, uint256 price, uint8 priceDecimals) internal pure returns (uint256) {
        uint256 usdWad   = feeUSDc * 1e16;
        uint256 priceWad = _scaleDecimals(price, priceDecimals, 18);
        uint256 xrpWad   = _ceilDiv(usdWad * 1e18, priceWad);
        return _ceilDiv(xrpWad, 1e12);
    }

    function _scaleDecimals(uint256 x, uint8 fromDec, uint8 toDec) internal pure returns (uint256) {
        if (fromDec == toDec) return x;
        return (fromDec < toDec)
            ? x * (10 ** (toDec - fromDec))
            : x / (10 ** (fromDec - toDec));
    }

    function _ceilDiv(uint256 a, uint256 b) internal pure returns (uint256) {
        return a == 0 ? 0 : 1 + ((a - 1) / b);
    }
}