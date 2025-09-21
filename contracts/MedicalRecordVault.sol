// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

/**
 * MedicalRecordVaultXRPL (Flare EVM) — no role/permission gating
 * --------------------------------------------------------------
 * - Stores ONLY pointers (hash/CID/URI) to off-chain encrypted docs.
 * - Roles (guardian/pediatricPsychologist/insurer) remain settable & viewable,
 *   but are NOT enforced for uploads/reads.
 *
 * Payment options for each upload (choose one):
 *   A) FLR-deduct: insurer deposits native FLR; contract deducts per upload.
 *   B) XRPL any-currency via FDC attestation: verifier attests USD cents paid.
 *   C) (Optional legacy) XRPL + FTSO XRP pricing: drops attested by FDC vs USD fee.
 *
 * SECURITY:
 * - Never store PII on-chain. Derive patientId off-chain (e.g., keccak256(MRN|salt)).
 * - hashURI must point to encrypted content.
 */

interface IFDC {
    function verify(bytes calldata proof, bytes32 statementId) external view returns (bool);
}

interface IFTSO {
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
        uint256 paidDrops;      // For XRP pricing path (legacy)
        uint256 paidUSDc;       // For XRPL any-currency path; USD cents attested by FDC
        bytes32 currencyHash;   // Info (any-currency path): keccak256(currencyCode|issuer)
    }

    struct RecordSet {
        mapping(uint8 => DocMeta) docs; // one DocMeta per kind
        address guardian;               // retained metadata (NOT enforced)
        address pediatricPsychologist;  // retained metadata (NOT enforced)
    }

    /* ──────────────── Events ──────────────── */
    event GuardianSet(bytes32 indexed patientId, address indexed guardian);
    event PsychologistSet(bytes32 indexed patientId, address indexed psychologist);
    event InsurerSet(bytes32 indexed patientId, address indexed insurer);

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

    /* ──────────────── Admin / Setup (metadata only) ──────────────── */
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

    /* ──────────────── UPLOADS (no role checks) ──────────────── */

    /// A) FLR-deduct mode: contract deducts fee from insurer deposit.
    function uploadDocumentDeduct(
        bytes32 patientId,
        uint8   kind,        // 0/1/2
        string calldata hashURI
    ) external {
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
    function uploadDocumentWithXRPLAnyCurrency(
        bytes32 patientId,
        uint8   kind,
        string calldata hashURI,
        bytes  calldata xrplProof,
        bytes32 statementId,
        bytes32 proofId,
        uint256 attestedUSDc,
        bytes32 currencyHash
    ) external {
        _requireFdc();
        _verifyFDC(xrplProof, statementId);
        require(attestedUSDc >= uploadFeeUSDc, "USD attestation too small");

        _writeDoc(patientId, kind, hashURI);
        DocMeta storage d = records[patientId].docs[kind];
        paidVersion[patientId][kind] = d.version;
        d.paymentProof = proofId;
        d.paidDrops    = 0;
        d.paidUSDc     = attestedUSDc;
        d.currencyHash = currencyHash;

        emit UploadPaidXRPLAny(patientId, kind, insurerOf[patientId], d.version, attestedUSDc, proofId, currencyHash);
    }

    /// C) (Legacy/optional) XRPL + FDC + FTSO (XRP-only priced in USD via oracle).
    function uploadDocumentWithXRPProof(
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

    /// Internal write: increments version and stores URI/timestamp. (No role checks)
    function _writeDoc(bytes32 patientId, uint8 kind, string calldata hashURI) internal {
        require(kind <= uint8(DocKind.Intake), "bad kind");
        DocMeta storage d = records[patientId].docs[kind];
        d.hashURI  = hashURI;
        d.version += 1;
        d.updatedAt = block.timestamp;
        emit DocumentUploaded(patientId, kind, hashURI, d.version);
    }

    /* ──────────────── READ (free; requires paid) ──────────────── */

    /// Anyone may read if the latest version has been paid for.
    function getDocument(bytes32 patientId, uint8 kind)
        external
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

    function getRoles(bytes32 patientId)
        external
        view
        returns (address guardian, address pediatricPsychologist, address insurer)
    {
        return (records[patientId].guardian, records[patientId].pediatricPsychologist, insurerOf[patientId]);
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
