// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

/**
 * MedicalRecordVaultXRPL (Coston2 / Flare EVM)
 * --------------------------------------------
 * - OPEN uploads and reads (no ACL). Patient / pediatric psychologist / anyone can use it.
 * - Every upload REQUIRES an XRPL payment proved by FDC; amount (drops) must cover USD fee via FTSO.
 * - Per-patient "Insurer Portal" metadata (xrplAccount, contact) for UI — does NOT gate anything.
 * - Only encrypted pointers (hash/CID/URI) are stored on-chain. No PII.
 *
 * Off-chain tip: derive patientId = keccak256(abi.encodePacked(MRN, "|", salt)).
 */

interface IFDC {
    /// Verifies an XRPL payment proof tied to a statementId.
    function verify(bytes calldata proof, bytes32 statementId) external view returns (bool);
}

interface IFTSO {
    /// Returns (XRP price in USD with `decimals`, decimals, timestamp)
    function getXRPUSDPrice() external view returns (uint256 price, uint8 decimals, uint256 timestamp);
}

contract MedicalRecordVaultXRPL {
    /* ─────────────── Types ─────────────── */
    enum DocKind { Diagnosis, Referral, Intake } // 0,1,2

    struct DocMeta {
        string  hashURI;        // encrypted pointer (IPFS/S3/etc.)
        uint256 version;        // increments on each upload
        uint256 updatedAt;      // unix timestamp

        // Payment trace (XRPL path)
        bytes32 paymentProof;   // proof id / hash attested by FDC
        uint256 paidDrops;      // XRP drops paid (attested)
        uint256 paidUSDc;       // kept 0 (we price via FTSO), kept for compatibility
        bytes32 currencyHash;   // unused for XRP-only path (0)
    }

    struct RecordSet {
        mapping(uint8 => DocMeta) docs;
        // Optional metadata (NOT used for permissions—purely informational)
        address guardian;
        address pediatricPsychologist;
    }

    /// Per-patient Insurer Portal metadata (purely informational)
    struct InsurerInfo { 
        string  xrplAccount;    // XRPL classic/X-address for display, memos, etc.
        address contact;        // EVM contact (insurer ops wallet, optional)
    }

    /* ─────────────── Events ─────────────── */
    event DocumentUploaded(bytes32 indexed patientId, uint8 indexed kind, string hashURI, uint256 version);
    event DocumentRead(bytes32 indexed patientId, uint8 indexed kind, address accessor);

    event UploadPaidXRPLXRP(
        bytes32 indexed patientId,
        uint8   indexed kind,
        uint256 version,
        uint256 paidDrops,
        bytes32 proofHash
    );

    event FtsoSet(address indexed ftso);
    event FdcSet(address indexed fdc);
    event OracleStalenessUpdated(uint256 seconds_);
    event FeesUpdated(uint256 feeUSDc);

    // Insurer portal metadata events
    event InsurerInfoSet(bytes32 indexed patientId, string xrplAccount, address contact);

    /* ─────────────── Ownership (for parameters only) ─────────────── */
    address public owner;
    modifier onlyOwner() { require(msg.sender == owner, "not owner"); _; }

    constructor() {
        owner = msg.sender;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "zero owner");
        owner = newOwner;
    }

    /* ─────────────── Storage ─────────────── */
    mapping(bytes32 => RecordSet) private records;        // per-patient
    mapping(bytes32 => mapping(uint8 => uint256)) public paidVersion; // patientId => kind => paid version

    // Per-patient insurer portal metadata (NOT used for gating)
    mapping(bytes32 => InsurerInfo) private insurerInfoOf;

    // Pricing/oracle
    IFDC  public fdc;
    IFTSO public ftso;
    uint256 public uploadFeeUSDc = 500;           // $5.00 in USD cents
    uint256 public maxOracleStaleness = 10 minutes;

    /* ─────────────── Admin (parameters / optional metadata) ─────────────── */
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

    function setUploadFeeUSDc(uint256 feeUSDc) external onlyOwner {
        uploadFeeUSDc = feeUSDc;
        emit FeesUpdated(feeUSDc);
    }

    // Optional: purely informational tags for UI; NOT access control
    function setGuardian(bytes32 patientId, address guardian_) external onlyOwner {
        records[patientId].guardian = guardian_;
    }

    function setPediatricPsychologist(bytes32 patientId, address psychologist) external onlyOwner {
        records[patientId].pediatricPsychologist = psychologist;
    }

    /* ─────────────── Insurer Portal (metadata only) ─────────────── */

    /// Set per-patient insurer portal metadata (XRPL account string + EVM contact).
    /// Owner-only to keep registry clean; change to guardian/owner if you prefer.
    function setInsurerInfo(bytes32 patientId, string calldata xrplAccount, address contact) external onlyOwner {
        insurerInfoOf[patientId] = InsurerInfo({ xrplAccount: xrplAccount, contact: contact });
        emit InsurerInfoSet(patientId, xrplAccount, contact);
    }

    /// Read per-patient insurer portal metadata (for the frontend).
    function getInsurerInfo(bytes32 patientId) external view returns (string memory xrplAccount, address contact) {
        InsurerInfo storage i = insurerInfoOf[patientId];
        return (i.xrplAccount, i.contact);
    }

    /* ─────────────── UPLOAD (XRP proof required) ─────────────── */

    /// Single upload path: XRPL payment proof via FDC; amount in drops must cover USD fee via FTSO.
    /// OPEN to anyone; no role checks.
    function uploadDocumentXRP(
        bytes32 patientId,
        uint8   kind,              // 0/1/2
        string calldata hashURI,   // encrypted pointer
        bytes  calldata xrplProof, // opaque proof verified by FDC
        bytes32 statementId,       // context-bound statement id
        bytes32 proofId,           // identifier for logging
        uint256 xrplPaidDrops      // amount paid (drops), attested by FDC off-chain
    ) external {
        _requireFdcAndFtso();
        _verifyFDC(xrplProof, statementId);

        // Enforce that XRPL payment in drops covers current USD fee.
        uint256 requiredDrops = _requiredDrops();
        require(xrplPaidDrops >= requiredDrops, "XRP payment too small");

        // Write document and mark paid
        _writeDoc(patientId, kind, hashURI);
        DocMeta storage d = records[patientId].docs[kind];
        paidVersion[patientId][kind] = d.version;
        d.paymentProof = proofId;
        d.paidDrops    = xrplPaidDrops;
        d.paidUSDc     = 0;
        d.currencyHash = bytes32(0);

        emit UploadPaidXRPLXRP(patientId, kind, d.version, xrplPaidDrops, proofId);
    }

    /* ─────────────── READ (open; requires paid) ─────────────── */

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

    /* ─────────────── Views ─────────────── */

    function getDocMeta(bytes32 patientId, uint8 kind)
        external
        view
        returns (string memory hashURI, uint256 version, uint256 updatedAt, bytes32 paymentProof, uint256 paidUSDc, uint256 paidDrops, bytes32 currencyHash)
    {
        DocMeta storage d = records[patientId].docs[kind];
        return (d.hashURI, d.version, d.updatedAt, d.paymentProof, d.paidUSDc, d.paidDrops, d.currencyHash);
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

    /* ─────────────── Internals ─────────────── */

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
        (uint256 px, uint8 dec, uint256 ts) = ftso.getXRPUSDPrice(); // USD per XRP
        require(px > 0, "oracle price=0");
        require(block.timestamp >= ts && block.timestamp - ts <= maxOracleStaleness, "price stale");
        return _requiredXrpDropsFromUSDc(uploadFeeUSDc, px, dec);
    }

    /* ─────────────── Math helpers ─────────────── */

    function _requiredXrpDropsFromUSDc(uint256 feeUSDc, uint256 price, uint8 priceDecimals) internal pure returns (uint256) {
        // USD cents -> 18-dec USD
        uint256 usdWad   = feeUSDc * 1e16;                    // $1.00 => 1e18
        uint256 priceWad = _scaleDecimals(price, priceDecimals, 18); // USD per XRP in 18d
        // required XRP (WAD) = ceil(usdWad / priceWad)
        uint256 xrpWad   = _ceilDiv(usdWad * 1e18, priceWad);
        // Convert XRP (18d) to drops: 1 XRP = 1e6 drops => 18 - 6 = 12
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
