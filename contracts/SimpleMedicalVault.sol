// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

/**
 * SimpleMedicalVault - No restrictions, no payments, no guardian checks
 * - Anyone can upload/read documents
 * - No payment requirements
 * - No role-based access control
 * - Simple document storage with versioning
 */
contract SimpleMedicalVault {

    /* ─────────────── Types ─────────────── */
    enum DocKind { Diagnosis, Referral, Intake } // 0,1,2

    struct DocMeta {
        string  hashURI;        // encrypted pointer
        uint256 version;        // increments on each upload
        uint256 updatedAt;      // unix timestamp
        address uploader;       // who uploaded it
    }

    struct RecordSet {
        mapping(uint8 => DocMeta) docs; // one DocMeta per kind
        address guardian;               // optional metadata
        address pediatricPsychologist;  // optional metadata
        address insurer;                // optional metadata
    }

    /* ─────────────── Events ─────────────── */
    event DocumentUploaded(bytes32 indexed patientId, uint8 indexed kind, string hashURI, uint256 version, address uploader);
    event DocumentRead(bytes32 indexed patientId, uint8 indexed kind, address accessor);

    // Role events (optional metadata only)
    event GuardianSet(bytes32 indexed patientId, address indexed guardian);
    event PsychologistSet(bytes32 indexed patientId, address indexed psychologist);
    event InsurerSet(bytes32 indexed patientId, address indexed insurer);

    /* ─────────────── Ownership (optional) ─────────────── */
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
    mapping(bytes32 => RecordSet) private records;

    /* ─────────────── UPLOAD (No restrictions) ─────────────── */

    /// Upload document - anyone can upload, no payment required
    function uploadDocument(
        bytes32 patientId,
        uint8   kind,        // 0/1/2
        string calldata hashURI
    ) external {
        require(kind <= uint8(DocKind.Intake), "invalid document kind");

        DocMeta storage d = records[patientId].docs[kind];
        d.hashURI = hashURI;
        d.version += 1;
        d.updatedAt = block.timestamp;
        d.uploader = msg.sender;

        emit DocumentUploaded(patientId, kind, hashURI, d.version, msg.sender);
    }

    /// Alias for backward compatibility
    function uploadDocumentDeduct(
        bytes32 patientId,
        uint8   kind,
        string calldata hashURI
    ) external {
        require(kind <= uint8(DocKind.Intake), "invalid document kind");

        DocMeta storage d = records[patientId].docs[kind];
        d.hashURI = hashURI;
        d.version += 1;
        d.updatedAt = block.timestamp;
        d.uploader = msg.sender;

        emit DocumentUploaded(patientId, kind, hashURI, d.version, msg.sender);
    }

    /* ─────────────── READ (No restrictions) ─────────────── */

    /// Anyone can read any document
    function getDocument(bytes32 patientId, uint8 kind)
        external
        returns (string memory, uint256, uint256, address)
    {
        require(kind <= uint8(DocKind.Intake), "invalid document kind");
        DocMeta storage d = records[patientId].docs[kind];
        require(d.version > 0, "document not found");

        emit DocumentRead(patientId, kind, msg.sender);
        return (d.hashURI, d.version, d.updatedAt, d.uploader);
    }

    /// Get document metadata without emitting read event
    function getDocMeta(bytes32 patientId, uint8 kind)
        external
        view
        returns (string memory hashURI, uint256 version, uint256 updatedAt, address uploader)
    {
        require(kind <= uint8(DocKind.Intake), "invalid document kind");
        DocMeta storage d = records[patientId].docs[kind];
        return (d.hashURI, d.version, d.updatedAt, d.uploader);
    }

    /* ─────────────── Optional Role Management ─────────────── */

    /// Set guardian (optional metadata only)
    function setGuardian(bytes32 patientId, address guardian_) external onlyOwner {
        records[patientId].guardian = guardian_;
        emit GuardianSet(patientId, guardian_);
    }

    /// Set pediatric psychologist (optional metadata only)
    function setPediatricPsychologist(bytes32 patientId, address psychologist) external onlyOwner {
        records[patientId].pediatricPsychologist = psychologist;
        emit PsychologistSet(patientId, psychologist);
    }

    /// Set insurer (optional metadata only)
    function setInsurer(bytes32 patientId, address insurer) external onlyOwner {
        records[patientId].insurer = insurer;
        emit InsurerSet(patientId, insurer);
    }

    /// Get roles for a patient
    function getRoles(bytes32 patientId)
        external
        view
        returns (address guardian, address pediatricPsychologist, address insurer)
    {
        return (
            records[patientId].guardian,
            records[patientId].pediatricPsychologist,
            records[patientId].insurer
        );
    }

    /* ─────────────── Utility Functions ─────────────── */

    /// Human-readable document kind names
    function docKindName(uint8 kind) public pure returns (string memory) {
        if (kind == uint8(DocKind.Diagnosis)) return "Diagnosis Letter";
        if (kind == uint8(DocKind.Referral))  return "Referral";
        if (kind == uint8(DocKind.Intake))    return "Intake";
        revert("invalid document kind");
    }

    /// Get document count for a patient (for a specific kind)
    function getDocumentVersion(bytes32 patientId, uint8 kind) external view returns (uint256) {
        require(kind <= uint8(DocKind.Intake), "invalid document kind");
        return records[patientId].docs[kind].version;
    }

    /// Check if document exists
    function documentExists(bytes32 patientId, uint8 kind) external view returns (bool) {
        require(kind <= uint8(DocKind.Intake), "invalid document kind");
        return records[patientId].docs[kind].version > 0;
    }
}