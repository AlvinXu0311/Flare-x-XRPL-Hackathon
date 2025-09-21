// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

/**
 * SimpleMedicalVault - XRPL-only payment, no ACL
 * ------------------------------------------------
 * Based on the working yi-update design:
 * - Single upload path: uploadDocumentXRP()
 * - XRPL payment verification via FDC + FTSO pricing
 * - No complex role system - anyone can upload for any patientId
 * - Clean state model with version tracking
 */

interface IFDC {
    function verify(bytes calldata proof, bytes32 statementId) external view returns (bool);
}

interface IFTSO {
    function getXRPUSDPrice() external view returns (uint256 price, uint8 decimals, uint256 timestamp);
}

contract SimpleMedicalVault {
    /* ──────────────── Types ──────────────── */
    enum DocKind { Diagnosis, Referral, Intake } // 0,1,2

    struct DocMeta {
        string  hashURI;        // encrypted pointer (IPFS CID/URI)
        uint256 version;        // increments per upload
        uint256 updatedAt;      // unix timestamp

        // Payment trace
        bytes32 paymentProof;   // XRPL proof id for logging
        uint256 paidDrops;      // XRP amount paid (in drops)
        bytes32 currencyHash;   // keccak256(currencyCode|issuer)
    }

    struct InsurerInfo {
        string xrplAccount;     // XRPL address (optional metadata)
        string contact;         // contact info (optional metadata)
    }

    /* ──────────────── Events ──────────────── */
    event DocumentUploaded(bytes32 indexed patientId, uint8 indexed kind, string hashURI, uint256 version);
    event UploadPaidXRPLXRP(
        bytes32 indexed patientId,
        uint8   indexed kind,
        uint256 version,
        uint256 paidDrops,
        bytes32 proofHash
    );
    event UploadPaidFLR(
        bytes32 indexed patientId,
        uint8   indexed kind,
        address indexed payer,
        uint256 version,
        uint256 amountWei
    );
    event DocumentRead(bytes32 indexed patientId, uint8 indexed kind, address accessor);

    event FtsoSet(address indexed ftso);
    event FdcSet(address indexed fdc);
    event FeesUpdated(uint256 feeUSDc);
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
    // patientId => docKind => DocMeta
    mapping(bytes32 => mapping(uint8 => DocMeta)) private docs;

    // patientId => kind => version (latest paid version)
    mapping(bytes32 => mapping(uint8 => uint256)) public paidVersion;

    // Optional insurer metadata (doesn't affect permissions)
    mapping(bytes32 => InsurerInfo) public insurerInfo;

    // Payment settings
    uint256 public uploadFeeUSDc = 500;  // $5.00 in cents for XRPL
    uint256 public uploadFeeWei = 0.001 ether;  // 0.001 FLR for direct payment
    uint256 public maxOracleStaleness = 10 minutes;

    // Fee collection
    address public feeCollector;

    // Oracles
    IFDC  public fdc;
    IFTSO public ftso;

    /* ──────────────── Admin / Setup ──────────────── */
    function setFDC(address verifier) external onlyOwner {
        fdc = IFDC(verifier);
        emit FdcSet(verifier);
    }

    function setFTSO(address oracle) external onlyOwner {
        ftso = IFTSO(oracle);
        emit FtsoSet(oracle);
    }

    function setUploadFeeUSDc(uint256 feeUSDc) external onlyOwner {
        uploadFeeUSDc = feeUSDc;
        emit FeesUpdated(feeUSDc);
    }

    function setUploadFeeFLR(uint256 feeWei) external onlyOwner {
        uploadFeeWei = feeWei;
        emit FeesUpdated(feeWei);
    }

    function setFeeCollector(address collector) external onlyOwner {
        require(collector != address(0), "zero address");
        feeCollector = collector;
    }

    function setMaxOracleStaleness(uint256 seconds_) external onlyOwner {
        maxOracleStaleness = seconds_;
        emit OracleStalenessUpdated(seconds_);
    }

    function setInsurerInfo(bytes32 patientId, string calldata xrplAccount, string calldata contact) external {
        // Anyone can set insurer info - it's just metadata
        insurerInfo[patientId] = InsurerInfo(xrplAccount, contact);
    }

    /* ──────────────── MAIN UPLOAD FUNCTION ──────────────── */

    /**
     * Single upload path: XRPL payment with FDC verification + FTSO pricing
     * Anyone can upload for any patientId (no ACL checks)
     */
    function uploadDocumentXRP(
        bytes32 patientId,
        uint8   kind,                // 0=Diagnosis, 1=Referral, 2=Intake
        string  calldata hashURI,    // encrypted IPFS CID/URI
        bytes   calldata xrplProof,  // opaque proof for FDC
        bytes32 statementId,         // context binding for proof
        bytes32 proofId,             // for logging/trace
        uint256 xrplPaidDrops        // amount paid on XRPL (in drops)
    ) external {
        // 1. Verify oracles are set
        require(address(fdc) != address(0), "FDC not set");
        require(address(ftso) != address(0), "FTSO not set");

        // 2. Verify FDC attestation
        require(fdc.verify(xrplProof, statementId), "invalid XRPL payment proof");

        // 3. Check FTSO price and compute required drops
        uint256 requiredDrops = _requiredDrops();
        require(xrplPaidDrops >= requiredDrops, "XRP payment too small");

        // 4. Write document (no ACL checks)
        _writeDoc(patientId, kind, hashURI);

        // 5. Mark as paid and emit event
        DocMeta storage d = docs[patientId][kind];
        paidVersion[patientId][kind] = d.version;
        d.paymentProof = proofId;
        d.paidDrops = xrplPaidDrops;
        d.currencyHash = keccak256("XRP|native"); // XRP is native currency

        emit UploadPaidXRPLXRP(patientId, kind, d.version, xrplPaidDrops, proofId);
    }

    /**
     * Direct FLR payment upload: Insurer pays fee directly with transaction
     * Fee amount sent as msg.value, no balance management needed
     */
    function uploadDocumentFLR(
        bytes32 patientId,
        uint8   kind,                // 0=Diagnosis, 1=Referral, 2=Intake
        string  calldata hashURI     // encrypted IPFS CID/URI
    ) external payable {
        // 1. Verify sufficient payment sent
        require(msg.value >= uploadFeeWei, "insufficient FLR payment");

        // 2. Write document (no ACL checks)
        _writeDoc(patientId, kind, hashURI);

        // 3. Transfer fee to collector, refund excess
        uint256 excess = msg.value - uploadFeeWei;

        (bool success,) = payable(feeCollector).call{value: uploadFeeWei}("");
        require(success, "fee transfer failed");

        if (excess > 0) {
            (bool refundSuccess,) = payable(msg.sender).call{value: excess}("");
            require(refundSuccess, "refund failed");
        }

        // 4. Mark as paid and emit event
        DocMeta storage d = docs[patientId][kind];
        paidVersion[patientId][kind] = d.version;
        d.paymentProof = bytes32(0); // FLR marker
        d.paidDrops = 0;
        d.currencyHash = keccak256("FLR|native");

        emit UploadPaidFLR(patientId, kind, msg.sender, d.version, uploadFeeWei);
    }

    /* ──────────────── Internal helpers ──────────────── */

    function _writeDoc(bytes32 patientId, uint8 kind, string calldata hashURI) internal {
        require(kind <= uint8(DocKind.Intake), "invalid document kind");

        DocMeta storage d = docs[patientId][kind];
        d.hashURI = hashURI;
        d.version += 1;
        d.updatedAt = block.timestamp;

        emit DocumentUploaded(patientId, kind, hashURI, d.version);
    }

    function _requiredDrops() internal view returns (uint256) {
        (uint256 price, uint8 decimals, uint256 timestamp) = ftso.getXRPUSDPrice();
        require(price > 0, "oracle price=0");
        require(block.timestamp >= timestamp && block.timestamp - timestamp <= maxOracleStaleness, "price stale");

        return _requiredXrpDropsFromUSDc(uploadFeeUSDc, price, decimals);
    }

    /* ──────────────── READ Functions ──────────────── */

    function getDocument(bytes32 patientId, uint8 kind)
        external
        returns (string memory, uint256, uint256, bytes32)
    {
        require(kind <= uint8(DocKind.Intake), "invalid document kind");
        DocMeta storage d = docs[patientId][kind];
        require(paidVersion[patientId][kind] >= d.version && d.version > 0, "unpaid or empty");

        emit DocumentRead(patientId, kind, msg.sender);
        return (d.hashURI, d.version, d.updatedAt, d.paymentProof);
    }

    function getDocMeta(bytes32 patientId, uint8 kind)
        external
        view
        returns (string memory hashURI, uint256 version, uint256 updatedAt, bytes32 paymentProof, uint256 paidDrops, bytes32 currencyHash)
    {
        DocMeta storage d = docs[patientId][kind];
        return (d.hashURI, d.version, d.updatedAt, d.paymentProof, d.paidDrops, d.currencyHash);
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

    function getInsurerInfo(bytes32 patientId) external view returns (string memory xrplAccount, string memory contact) {
        InsurerInfo storage info = insurerInfo[patientId];
        return (info.xrplAccount, info.contact);
    }

    /* ──────────────── Math ──────────────── */

    function _requiredXrpDropsFromUSDc(uint256 feeUSDc, uint256 price, uint8 priceDecimals) internal pure returns (uint256) {
        // Convert USD cents to 18-decimal USD: USDc * 1e16
        uint256 usdWad = feeUSDc * 1e16;
        uint256 priceWad = _scaleDecimals(price, priceDecimals, 18);

        // required XRP (WAD) = ceil(usdWad / priceWad)
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
}