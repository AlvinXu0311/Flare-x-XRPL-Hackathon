// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

/**
 * MedicalRecordVaultXRPL (Flare EVM)
 * ----------------------------------
 * - Stores ONLY pointers (hash/CID/URI) to off-chain encrypted docs.
 * - Per patientId (bytes32): owner sets parent and insurer.
 * - Parent (or owner) grants READ and/or UPLOAD permissions to parties.
 * - Upload CHARGES insurer ONCE per version:
 *      A) Flare-deduct mode (contract subtracts from insurer deposit)
 *      B) XRPL+FDC mode (verify attested XRPL payment, then mark paid)
 * - Reads are FREE; UI shows UploadPaid event / stored proofHash as proof.
 *
 * SECURITY:
 * - Never store PII on-chain. Derive patientId off-chain (e.g., keccak256(MRN|salt)).
 * - hashURI must point to encrypted content (IPFS/S3).
 */

interface IFDC {
    function verify(bytes calldata proof, bytes32 statementId) external view returns (bool);
}

contract MedicalRecordVaultXRPL {
    /* ──────────────── Types ──────────────── */
    enum DocKind { Diagnosis, Referral, Intake } // 0,1,2

    struct DocMeta {
        string  hashURI;        // encrypted pointer
        uint256 version;        // increments per upload
        uint256 updatedAt;      // unix timestamp
        bytes32 paymentProof;   // XRPL tx hash / attestation id; 0x0 for Flare-deduct
    }

    struct RecordSet {
        mapping(uint8 => DocMeta) docs; // one DocMeta per kind
        address parent;                 // guardian who grants permissions
    }

    /* ──────────────── Events ──────────────── */
    event ParentSet(bytes32 indexed patientId, address indexed parent);
    event InsurerSet(bytes32 indexed patientId, address indexed insurer);

    event ReadAccessGranted(bytes32 indexed patientId, address indexed who, bool allowed);
    event UploadAccessGranted(bytes32 indexed patientId, address indexed who, bool allowed);

    event UploadPaid(
        bytes32 indexed patientId,
        uint8   indexed kind,
        address indexed insurer,
        uint256 version,
        uint256 amountWei,
        bytes32 proofHash
    );

    event DocumentUploaded(bytes32 indexed patientId, uint8 indexed kind, string hashURI, uint256 version);
    event DocumentRead(bytes32 indexed patientId, uint8 indexed kind, address accessor);

    event Deposit(bytes32 indexed patientId, address indexed insurer, uint256 amount);
    event Withdraw(address indexed to, uint256 amount);

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
    mapping(bytes32 => mapping(address => bool)) public canUpload; // upload ACL

    // Billing (Flare-deduct mode)
    mapping(address => uint256) public insurerBalances; // deposits by insurer
    uint256 public uploadFeeWei = 0.0001 ether;
    address public feeCollector;

    // Was latest version paid?
    // patientId => kind => versionPaid
    mapping(bytes32 => mapping(uint8 => uint256)) public paidVersion;

    // Optional FDC verifier (for XRPL+FDC path)
    IFDC public fdc;

    /* ──────────────── Modifiers ──────────────── */
    modifier onlyParentOrOwner(bytes32 patientId) {
        require(msg.sender == records[patientId].parent || msg.sender == owner, "not parent/owner");
        _;
    }
    modifier onlyUploader(bytes32 patientId) {
        require(
            msg.sender == owner ||
            msg.sender == records[patientId].parent ||
            canUpload[patientId][msg.sender],
            "not uploader"
        );
        _;
    }
    modifier onlyReader(bytes32 patientId) {
        require(
            msg.sender == owner ||
            msg.sender == records[patientId].parent ||
            canRead[patientId][msg.sender],
            "not allowed"
        );
        _;
    }

    /* ──────────────── Admin / Setup ──────────────── */
    function setParent(bytes32 patientId, address parent) external onlyOwner {
        require(parent != address(0), "parent zero");
        records[patientId].parent = parent;
        emit ParentSet(patientId, parent);
    }

    function setInsurer(bytes32 patientId, address insurer) external onlyOwner {
        require(insurer != address(0), "insurer zero");
        insurerOf[patientId] = insurer;
        emit InsurerSet(patientId, insurer);
    }

    function grantRead(bytes32 patientId, address who, bool allowed) external onlyParentOrOwner(patientId) {
        require(who != address(0), "zero");
        canRead[patientId][who] = allowed;
        emit ReadAccessGranted(patientId, who, allowed);
    }

    function grantUpload(bytes32 patientId, address who, bool allowed) external onlyParentOrOwner(patientId) {
        require(who != address(0), "zero");
        canUpload[patientId][who] = allowed;
        emit UploadAccessGranted(patientId, who, allowed);
    }

    function setUploadFee(uint256 feeWei, address collector) external onlyOwner {
        require(collector != address(0), "collector zero");
        uploadFeeWei = feeWei;
        feeCollector = collector;
    }

    function setFDC(address verifier) external onlyOwner {
        fdc = IFDC(verifier);
    }

    /* ──────────────── Funding (Flare-deduct) ──────────────── */
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

    /// Flare-deduct mode: contract deducts fee from insurer deposit.
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

        paidVersion[patientId][kind] = records[patientId].docs[kind].version;
        records[patientId].docs[kind].paymentProof = bytes32(0); // marker for Flare-deduct

        emit UploadPaid(patientId, kind, insurer, paidVersion[patientId][kind], uploadFeeWei, bytes32(0));
    }

    /// XRPL + FDC mode: verify attested payment, then mark paid (no Flare deduction).
    function uploadDocumentWithXRPLProof(
        bytes32 patientId,
        uint8   kind,
        string calldata hashURI,
        bytes  calldata xrplProof,
        bytes32 statementId,
        bytes32 proofId
    ) external onlyUploader(patientId) {
        require(address(fdc) != address(0), "FDC not set");
        require(fdc.verify(xrplProof, statementId), "invalid payment proof");

        _writeDoc(patientId, kind, hashURI);

        paidVersion[patientId][kind] = records[patientId].docs[kind].version;
        records[patientId].docs[kind].paymentProof = proofId;

        emit UploadPaid(patientId, kind, insurerOf[patientId], paidVersion[patientId][kind], 0, proofId);
    }

    /// Internal write: increments version and stores URI/timestamp.
    function _writeDoc(bytes32 patientId, uint8 kind, string calldata hashURI) internal {
        require(records[patientId].parent != address(0), "parent not set");
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
        returns (string memory hashURI, uint256 version, uint256 updatedAt, bytes32 paymentProof)
    {
        require(kind <= uint8(DocKind.Intake), "bad kind");
        DocMeta storage d = records[patientId].docs[kind];
        require(paidVersion[patientId][kind] >= d.version && d.version > 0, "unpaid or empty");

        emit DocumentRead(patientId, kind, msg.sender);
        return (d.hashURI, d.version, d.updatedAt, d.paymentProof);
    }

    /* ──────────────── Small views (split to avoid deep stack) ──────────────── */

    /// Thin meta (no roles/paidVersion) — safe for UI
    function getDocMeta(bytes32 patientId, uint8 kind)
        external
        view
        returns (string memory hashURI, uint256 version, uint256 updatedAt, bytes32 paymentProof)
    {
        DocMeta storage d = records[patientId].docs[kind];
        return (d.hashURI, d.version, d.updatedAt, d.paymentProof);
    }

    /// Roles (parent, insurer)
    function getRoles(bytes32 patientId)
        external
        view
        returns (address parent, address insurer)
    {
        return (records[patientId].parent, insurerOf[patientId]);
    }

    /// Which version is marked paid for this kind?
    function getPaidVersion(bytes32 patientId, uint8 kind)
        external
        view
        returns (uint256)
    {
        return paidVersion[patientId][kind];
    }

    /// Helpers for UI
    function hasRead(bytes32 patientId, address who) external view returns (bool) {
        return (who == owner || who == records[patientId].parent || canRead[patientId][who]);
    }

    function hasUpload(bytes32 patientId, address who) external view returns (bool) {
        return (who == owner || who == records[patientId].parent || canUpload[patientId][who]);
    }

    receive() external payable {}
}
