// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

/**
 * MedicalRecordVaultXRPL (Flare EVM)
 * ----------------------------------
 * - Stores ONLY pointers (hash/CID/URI) to off-chain encrypted docs.
 * - Per patientId (bytes32): owner sets guardian, pediatricPsychologist, and insurer.
 * - Guardian grants READ permissions to parties.
 * - Pediatric Psychologist (or owner) uploads documents.
 *
 * Payment options for each upload (choose one):
 *   A) FLR-deduct: insurer deposits native FLR; contract deducts per upload.
 *   B) XRPL any-currency via FDC attestation: verify XRPL payment proof where the
 *      verifier attests the USD value paid (so insurer can pay in XRP or any IOU).
 *   C) (Optional legacy) XRPL + FTSO XRP pricing: verify XRPL proof + price XRP via FTSO.
 *
 * Reads are FREE (view). If you want an on-chain log, call getDocument (emits).
 *
 * SECURITY:
 * - Never store PII on-chain. Derive patientId off-chain (e.g., keccak256(MRN|salt)).
 * - hashURI must point to encrypted content (IPFS/S3) and be encrypted.
 *
 * NOTE:
 * - Refactored with helpers to avoid "stack too deep".
 */

interface IFDC {
    /// Generic verification of an XRPL payment proof tied to a statement.
    /// Your FDC implementation should bind `statementId` to the expected payer/beneficiary context.
    function verify(bytes calldata proof, bytes32 statementId) external view returns (bool);
}

/// Optional: XRP oracle for XRP-only pricing path
interface IFTSO {
    /// Returns (XRP price in USD with `decimals`, decimals, timestamp)
    function getXRPUSDPrice() external view returns (uint256 price, uint8 decimals, uint256 timestamp);
}

contract MedicalRecordVaultXRPL {
    /* ──────────────── Types ──────────────── */
    enum DocKind { Diagnosis, Referral, Intake } // 0,1,2

    struct DocMeta {
        string  hashURI;        // encrypted pointer
        uint256 version;        // increments per upload
        uint256 updatedAt;      // unix timestamp

        // Payment trace
        bytes32 paymentProof;   // XRPL proof id; 0x0 for FLR-deduct
        uint256 paidDrops;      // For XRP pricing path (B-legacy); 0 for others
        uint256 paidUSDc;       // For XRPL any-currency path; USD cents attested by FDC
        bytes32 currencyHash;   // For info (any-currency path): keccak256(currencyCode|issuer)
    }

    struct RecordSet {
        mapping(uint8 => DocMeta) docs; // one DocMeta per kind
        address guardian;               // guardian who grants read permissions
        address pediatricPsychologist;  // designated uploader (primary)
        address patient;                // patient who can upload their own documents
        bool patientCanUpload;          // flag to enable patient self-upload
    }

    /* ──────────────── Events ──────────────── */
    event GuardianSet(bytes32 indexed patientId, address indexed guardian);
    event PsychologistSet(bytes32 indexed patientId, address indexed psychologist);
    event InsurerSet(bytes32 indexed patientId, address indexed insurer);
    event PatientSet(bytes32 indexed patientId, address indexed patient);
    event PatientUploadEnabled(bytes32 indexed patientId, bool enabled);

    event ReadAccessGranted(bytes32 indexed patientId, address indexed who, bool allowed);

    event UploadPaidFLR(bytes32 indexed patientId, uint8 indexed kind, address indexed insurer, uint256 version, uint256 amountWei);
    event UploadPaidXRPLAny(
        bytes32 indexed patientId,
        uint8   indexed kind,
        address indexed insurer,
        uint256 version,
        uint256 paidUSDc,
        bytes32 proofHash,
        bytes32 currencyHash
    );
    event UploadPaidXRPLXRP(
        bytes32 indexed patientId,
        uint8   indexed kind,
        address indexed insurer,
        uint256 version,
        uint256 paidDrops,
        bytes32 proofHash
    );

    event DocumentUploaded(bytes32 indexed patientId, uint8 indexed kind, string hashURI, uint256 version);
    event DocumentRead(bytes32 indexed patientId, uint8 indexed kind, address accessor);

    event Deposit(bytes32 indexed patientId, address indexed insurer, uint256 amount);
    event Withdraw(address indexed to, uint256 amount);

    event FtsoSet(address indexed ftso);
    event FdcSet(address indexed fdc);
    event OracleParams(uint256 price, uint8 decimals, uint256 timestamp);
    event FeesUpdated(uint256 feeWei, uint256 feeUSDc, address collector);
    event OracleStalenessUpdated(uint256 maxStalenessSeconds);

    /* ──────────────── Ownership ──────────────── */
    address public owner;
    modifier onlyOwner() { require(msg.sender == owner, "not owner"); _; }

    constructor() {
        owner = msg.sender;
        feeCollector = msg.sender;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "zero owner");
        owner = newOwner;
    }

    /* ──────────────── Storage ──────────────── */
    mapping(bytes32 => RecordSet) private records;                 // patient state
    mapping(bytes32 => address)  public insurerOf;                 // patient -> insurer
    mapping(bytes32 => mapping(address => bool)) public canRead;   // read ACL

    // Billing (FLR-deduct)
    mapping(address => uint256) public insurerBalances; // deposits by insurer
    uint256 public uploadFeeWei = 0.0001 ether;
    address public feeCollector;

    // XRPL path: fee in USD cents (converted or attested)
    uint256 public uploadFeeUSDc = 500; // $5.00 default

    // Latest version paid: patientId => kind => version
    mapping(bytes32 => mapping(uint8 => uint256)) public paidVersion;

    // Oracles/verifiers
    IFDC  public fdc;
    IFTSO public ftso;                       // optional (for XRP-only pricing path)
    uint256 public maxOracleStaleness = 10 minutes;

    /* ──────────────── Modifiers ──────────────── */
    modifier onlyGuardianOrOwner(bytes32 patientId) {
        require(msg.sender == records[patientId].guardian || msg.sender == owner, "not guardian/owner");
        _;
    }
    modifier onlyUploader(bytes32 patientId) {
        // Multiple authorized uploaders: owner, pediatric psychologist, or patient (if enabled)
        address s = msg.sender;
        bool isPatientUploader = records[patientId].patientCanUpload &&
                                 s == records[patientId].patient;
        require(
            s == owner ||
            s == records[patientId].pediatricPsychologist ||
            isPatientUploader,
            "not authorized uploader"
        );
        _;
    }
    modifier onlyReader(bytes32 patientId) {
        address s = msg.sender;
        require(
            s == owner || s == records[patientId].guardian || canRead[patientId][s],
            "not allowed"
        );
        _;
    }

    /* ──────────────── Admin / Setup ──────────────── */
    function setGuardian(bytes32 patientId, address guardian_) external onlyOwner {
        require(guardian_ != address(0), "guardian zero");
        records[patientId].guardian = guardian_;
        emit GuardianSet(patientId, guardian_);
    }

    function setPediatricPsychologist(bytes32 patientId, address psychologist) external onlyOwner {
        require(psychologist != address(0), "psychologist zero");
        records[patientId].pediatricPsychologist = psychologist;
        emit PsychologistSet(patientId, psychologist);
    }

    function setInsurer(bytes32 patientId, address insurer) external onlyOwner {
        require(insurer != address(0), "insurer zero");
        insurerOf[patientId] = insurer;
        emit InsurerSet(patientId, insurer);
    }

    function setPatient(bytes32 patientId, address patient) external onlyOwner {
        require(patient != address(0), "patient zero");
        records[patientId].patient = patient;
        emit PatientSet(patientId, patient);
    }

    function enablePatientUpload(bytes32 patientId, bool enabled) external onlyGuardianOrOwner(patientId) {
        records[patientId].patientCanUpload = enabled;
        emit PatientUploadEnabled(patientId, enabled);
    }

    function registerAsPatient(bytes32 patientId) external {
        require(records[patientId].patient == address(0), "patient already registered");

        // Auto-set the caller as patient and enable upload if no guardian is set
        records[patientId].patient = msg.sender;

        // If no guardian is set, patient can auto-enable their upload permission
        if (records[patientId].guardian == address(0)) {
            records[patientId].patientCanUpload = true;
            emit PatientUploadEnabled(patientId, true);
        }

        emit PatientSet(patientId, msg.sender);
    }

    function grantRead(bytes32 patientId, address who, bool allowed) external onlyGuardianOrOwner(patientId) {
        require(who != address(0), "zero");
        canRead[patientId][who] = allowed;
        emit ReadAccessGranted(patientId, who, allowed);
    }

    function setUploadFees(uint256 feeWei, uint256 feeUSDc_, address collector) external onlyOwner {
        require(collector != address(0), "collector zero");
        uploadFeeWei = feeWei;
        uploadFeeUSDc = feeUSDc_;
        feeCollector = collector;
        emit FeesUpdated(feeWei, feeUSDc_, collector);
    }

    function setFDC(address verifier) external onlyOwner {
        fdc = IFDC(verifier);
        emit FdcSet(verifier);
    }

    function setFTSO(address oracle) external onlyOwner {
        ftso = IFTSO(oracle);
        emit FtsoSet(oracle);
    }

    function setMaxOracleStaleness(uint256 seconds_) external onlyOwner {
        maxOracleStaleness = seconds_;
        emit OracleStalenessUpdated(seconds_);
    }

    /* ──────────────── Funding (FLR-deduct) ──────────────── */
    function depositFor(bytes32 patientId) external payable {
        address insurer = insurerOf[patientId];
        require(insurer != address(0), "insurer not set");
        require(msg.sender == insurer, "only insurer");
        require(msg.value > 0, "no value");
        insurerBalances[insurer] += msg.value;
        emit Deposit(patientId, insurer, msg.value);
    }

    function withdraw(address payable to, uint256 amount) external onlyOwner {
        require(to != address(0), "to zero");
        require(address(this).balance >= amount, "insufficient");
        to.transfer(amount);
        emit Withdraw(to, amount);
    }

    /* ──────────────── UPLOADS ──────────────── */

    /// A) FLR-deduct mode: contract deducts fee from insurer deposit.
    function uploadDocumentDeduct(
        bytes32 patientId,
        uint8   kind,        // 0/1/2
        string calldata hashURI
    ) external onlyUploader(patientId) {
        _writeDoc(patientId, kind, hashURI);

        address insurer = insurerOf[patientId];
        require(insurer != address(0), "insurer not set");
        require(insurerBalances[insurer] >= uploadFeeWei, "insurer balance low");

        unchecked { insurerBalances[insurer] -= uploadFeeWei; }
        (bool ok,) = payable(feeCollector).call{value: uploadFeeWei}("");
        require(ok, "fee transfer failed");

        DocMeta storage d = records[patientId].docs[kind];
        paidVersion[patientId][kind] = d.version;
        d.paymentProof = bytes32(0); // FLR-deduct marker
        d.paidDrops    = 0;
        d.paidUSDc     = 0;
        d.currencyHash = bytes32(0);

        emit UploadPaidFLR(patientId, kind, insurer, d.version, uploadFeeWei);
    }

    /// B) XRPL any-currency path via FDC attestation of USD value.
    /// - `xrplProof` + `statementId` are verified by FDC.
    /// - `attestedUSDc` is the USD cents paid (any XRPL currency) attested by the verifier.
    /// - `currencyHash` is informational: keccak256(abi.encodePacked(currencyCode, "|", issuerAddressOnXRPL))
    function uploadDocumentWithXRPLAnyCurrency(
        bytes32 patientId,
        uint8   kind,
        string calldata hashURI,
        bytes  calldata xrplProof,
        bytes32 statementId,
        bytes32 proofId,
        uint256 attestedUSDc,
        bytes32 currencyHash
    ) external onlyUploader(patientId) {
        _requireFdc();                         // preflight
        _verifyFDC(xrplProof, statementId);    // 1) attestation valid
        require(attestedUSDc >= uploadFeeUSDc, "USD attestation too small");

        _writeDoc(patientId, kind, hashURI);  // 2) write + mark paid
        _setXRPLAnyCurrencyPayment(patientId, kind, proofId, attestedUSDc, currencyHash);
    }

    function _setXRPLAnyCurrencyPayment(
        bytes32 patientId,
        uint8 kind,
        bytes32 proofId,
        uint256 attestedUSDc,
        bytes32 currencyHash
    ) internal {
        DocMeta storage d = records[patientId].docs[kind];
        paidVersion[patientId][kind] = d.version;
        d.paymentProof = proofId;
        d.paidDrops    = 0;
        d.paidUSDc     = attestedUSDc;
        d.currencyHash = currencyHash;

        emit UploadPaidXRPLAny(patientId, kind, insurerOf[patientId], d.version, attestedUSDc, proofId, currencyHash);
    }

    /// C) (Legacy/optional) XRPL + FDC + FTSO (XRP-only priced in USD via oracle).
    /// xrplPaidDrops = amount (in drops; 1 XRP = 1e6 drops) attested by FDC.
    function uploadDocumentWithXRPProof(
        bytes32 patientId,
        uint8   kind,
        string calldata hashURI,
        bytes  calldata xrplProof,
        bytes32 statementId,
        bytes32 proofId,
        uint256 xrplPaidDrops
    ) external onlyUploader(patientId) {
        _requireFdcAndFtso();                         // preflight checks
        _verifyFDC(xrplProof, statementId);           // 1) attestation valid
        uint256 requiredDrops = _requiredDrops();     // 2) price from oracle -> required drops
        require(xrplPaidDrops >= requiredDrops, "XRP payment too small");

        _writeDoc(patientId, kind, hashURI);         // 3) write + mark paid
        _setXRPPayment(patientId, kind, proofId, xrplPaidDrops);
    }

    function _setXRPPayment(bytes32 patientId, uint8 kind, bytes32 proofId, uint256 xrplPaidDrops) internal {
        DocMeta storage d = records[patientId].docs[kind];
        paidVersion[patientId][kind] = d.version;
        d.paymentProof = proofId;
        d.paidDrops    = xrplPaidDrops;
        d.paidUSDc     = 0;
        d.currencyHash = bytes32(0);

        emit UploadPaidXRPLXRP(patientId, kind, insurerOf[patientId], d.version, xrplPaidDrops, proofId);
    }

    /* ──────────────── Internal helpers ──────────────── */

    function _requireFdc() internal view {
        require(address(fdc) != address(0), "FDC not set");
    }

    function _requireFdcAndFtso() internal view {
        require(address(fdc) != address(0), "FDC not set");
        require(address(ftso) != address(0), "FTSO not set");
    }

    function _verifyFDC(bytes calldata xrplProof, bytes32 statementId) internal view {
        require(fdc.verify(xrplProof, statementId), "invalid XRPL payment proof");
    }

    /// Pull oracle, check staleness, emit params, and return required drops for current uploadFeeUSDc
    function _requiredDrops() internal view returns (uint256) {
        (uint256 px, uint8 dec, uint256 ts) = ftso.getXRPUSDPrice();
        require(px > 0, "oracle price=0");
        require(block.timestamp >= ts && block.timestamp - ts <= maxOracleStaleness, "price stale");
        return _requiredXrpDropsFromUSDc(uploadFeeUSDc, px, dec);
    }

    /// Internal write: increments version and stores URI/timestamp.
    function _writeDoc(bytes32 patientId, uint8 kind, string calldata hashURI) internal {
        // Ensure basic patient record exists (either through admin setup or patient self-registration)
        require(
            records[patientId].guardian != address(0) ||
            records[patientId].pediatricPsychologist != address(0) ||
            records[patientId].patient != address(0),
            "patient record not initialized"
        );
        require(kind <= uint8(DocKind.Intake), "bad kind");

        DocMeta storage d = records[patientId].docs[kind];
        d.hashURI  = hashURI;
        d.version += 1;
        d.updatedAt = block.timestamp;

        emit DocumentUploaded(patientId, kind, hashURI, d.version);
    }

    /* ──────────────── READ (free; requires paid) ──────────────── */

    function getDocument(bytes32 patientId, uint8 kind)
        external
        onlyReader(patientId)
        returns (string memory, uint256, uint256, bytes32)
    {
        require(kind <= uint8(DocKind.Intake), "bad kind");
        DocMeta storage d = records[patientId].docs[kind];
        require(paidVersion[patientId][kind] >= d.version && d.version > 0, "unpaid or empty");
        emit DocumentRead(patientId, kind, msg.sender);
        return (d.hashURI, d.version, d.updatedAt, d.paymentProof);
    }

    /* ──────────────── Views & helpers ──────────────── */

    function getDocMeta(bytes32 patientId, uint8 kind)
        external
        view
        returns (string memory hashURI, uint256 version, uint256 updatedAt, bytes32 paymentProof, uint256 paidUSDc, uint256 paidDrops, bytes32 currencyHash)
    {
        DocMeta storage d = records[patientId].docs[kind];
        return (d.hashURI, d.version, d.updatedAt, d.paymentProof, d.paidUSDc, d.paidDrops, d.currencyHash);
    }

    function getDocPayment(bytes32 patientId, uint8 kind)
        external
        view
        returns (uint256 paidUSDc, uint256 paidDrops, uint256 paidVersion_, bool flareDeduct)
    {
        DocMeta storage d = records[patientId].docs[kind];
        return (d.paidUSDc, d.paidDrops, paidVersion[patientId][kind], d.paymentProof == bytes32(0) && d.version > 0);
    }

    function getRoles(bytes32 patientId)
        external
        view
        returns (address guardian, address pediatricPsychologist, address insurer, address patient, bool patientCanUpload)
    {
        return (
            records[patientId].guardian,
            records[patientId].pediatricPsychologist,
            insurerOf[patientId],
            records[patientId].patient,
            records[patientId].patientCanUpload
        );
    }

    function hasRead(bytes32 patientId, address who) external view returns (bool) {
        return (who == owner || who == records[patientId].guardian || canRead[patientId][who]);
    }

    function canUploadForPatient(bytes32 patientId, address who) external view returns (bool) {
        if (who == owner) return true;
        if (who == records[patientId].pediatricPsychologist) return true;
        if (records[patientId].patientCanUpload && who == records[patientId].patient) return true;
        return false;
    }

    /// Human-readable document kind names
    function docKindName(uint8 kind) public pure returns (string memory) {
        if (kind == uint8(DocKind.Diagnosis)) return "Diagnosis Letter";
        if (kind == uint8(DocKind.Referral))  return "Referral";
        if (kind == uint8(DocKind.Intake))    return "Intake";
        revert("bad kind");
    }

    /// View: required XRP (in drops) for the current USD-cents fee (oracle path)
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

    /* ──────────────── Math ──────────────── */

    function _requiredXrpDropsFromUSDc(uint256 feeUSDc, uint256 price, uint8 priceDecimals) internal pure returns (uint256) {
        // Convert USD cents to 18-decimal USD (WAD): USDc * 1e16
        uint256 usdWad = feeUSDc * 1e16;                 // $1.00 => 1e18
        uint256 priceWad = _scaleDecimals(price, priceDecimals, 18); // USD per XRP (18d)
        // required XRP (WAD) = ceil(usdWad / priceWad) with 18-dec precision
        uint256 xrpWad = _ceilDiv(usdWad * 1e18, priceWad);
        // 1 XRP = 1e6 drops => drops = ceil(xrpWad / 1e12)
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

    receive() external payable {}
}
