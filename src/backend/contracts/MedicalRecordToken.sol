// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
/**
 * @title MedicalRecordToken
 * @dev ERC-721 token for medical record ownership and access control on Flare Costen2
 * Each token represents a medical evaluation with metadata stored on IPFS
 */
contract MedicalRecordToken is ERC721, ERC721URIStorage, Ownable {
    uint256 private _tokenIdCounter;

    struct MedicalRecord {
        bytes32 fileHash;           // SHA-256 hash of the medical file
        address patientAddress;     // Patient's wallet address
        uint256 createdAt;          // Timestamp of record creation
        string evaluationType;      // Type of evaluation (ADOS, ADI-R, etc.)
        bool isActive;              // Whether the record is still valid
        mapping(address => AccessPermission) accessPermissions; // Hospital access permissions
    }

    struct AccessPermission {
        bool hasAccess;             // Whether hospital has access
        uint256 grantedAt;          // When access was granted
        uint256 expiresAt;          // When access expires
        uint256 paymentAmount;      // Amount paid for access (in wei)
        bytes32 xrplTransactionHash; // XRPL payment transaction hash
    }

    mapping(uint256 => MedicalRecord) public medicalRecords;
    mapping(bytes32 => uint256) public fileHashToTokenId; // Quick lookup by file hash
    mapping(address => uint256[]) public patientTokens; // Patient's token IDs

    // Access costs (in wei equivalent)
    uint256 public constant ACCESS_COST = 15 ether; // $15 equivalent

    // Events
    event MedicalRecordMinted(
        uint256 indexed tokenId,
        address indexed patient,
        bytes32 fileHash,
        string evaluationType
    );

    event AccessGranted(
        uint256 indexed tokenId,
        address indexed hospital,
        uint256 expiresAt,
        bytes32 xrplTransactionHash
    );

    event AccessRevoked(
        uint256 indexed tokenId,
        address indexed hospital
    );

    constructor(address initialOwner) ERC721("Medical Record Token", "MRT") Ownable(initialOwner) {}

    /**
     * @dev Mint a new medical record token
     * @param patient The patient's address
     * @param fileHash SHA-256 hash of the medical file
     * @param uri IPFS URI containing metadata
     * @param evaluationType Type of medical evaluation
     */
    function mintMedicalRecord(
        address patient,
        bytes32 fileHash,
        string memory uri,
        string memory evaluationType
    ) public onlyOwner returns (uint256) {
        require(fileHashToTokenId[fileHash] == 0, "Medical record already exists");
        require(patient != address(0), "Invalid patient address");

        uint256 tokenId = _tokenIdCounter;
        _tokenIdCounter++;

        _safeMint(patient, tokenId);
        _setTokenURI(tokenId, uri);

        MedicalRecord storage record = medicalRecords[tokenId];
        record.fileHash = fileHash;
        record.patientAddress = patient;
        record.createdAt = block.timestamp;
        record.evaluationType = evaluationType;
        record.isActive = true;

        fileHashToTokenId[fileHash] = tokenId;
        patientTokens[patient].push(tokenId);

        emit MedicalRecordMinted(tokenId, patient, fileHash, evaluationType);

        return tokenId;
    }

    /**
     * @dev Grant access to a hospital after payment verification
     * @param tokenId Medical record token ID
     * @param hospital Hospital's address
     * @param xrplTransactionHash XRPL payment transaction hash
     * @param accessDuration Duration of access in seconds
     */
    function grantAccess(
        uint256 tokenId,
        address hospital,
        bytes32 xrplTransactionHash,
        uint256 accessDuration
    ) public onlyOwner {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        require(hospital != address(0), "Invalid hospital address");
        require(medicalRecords[tokenId].isActive, "Medical record is inactive");

        MedicalRecord storage record = medicalRecords[tokenId];
        AccessPermission storage permission = record.accessPermissions[hospital];

        permission.hasAccess = true;
        permission.grantedAt = block.timestamp;
        permission.expiresAt = block.timestamp + accessDuration;
        permission.paymentAmount = ACCESS_COST;
        permission.xrplTransactionHash = xrplTransactionHash;

        emit AccessGranted(tokenId, hospital, permission.expiresAt, xrplTransactionHash);
    }

    /**
     * @dev Check if a hospital has valid access to a medical record
     * @param tokenId Medical record token ID
     * @param hospital Hospital's address
     */
    function hasValidAccess(uint256 tokenId, address hospital) public view returns (bool) {
        if (_ownerOf(tokenId) == address(0) || !medicalRecords[tokenId].isActive) {
            return false;
        }

        AccessPermission storage permission = medicalRecords[tokenId].accessPermissions[hospital];
        return permission.hasAccess && block.timestamp < permission.expiresAt;
    }

    /**
     * @dev Get medical record details
     * @param tokenId Medical record token ID
     */
    function getMedicalRecord(uint256 tokenId) public view returns (
        bytes32 fileHash,
        address patientAddress,
        uint256 createdAt,
        string memory evaluationType,
        bool isActive
    ) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");

        MedicalRecord storage record = medicalRecords[tokenId];
        return (
            record.fileHash,
            record.patientAddress,
            record.createdAt,
            record.evaluationType,
            record.isActive
        );
    }

    /**
     * @dev Get access permission details for a hospital
     * @param tokenId Medical record token ID
     * @param hospital Hospital's address
     */
    function getAccessPermission(uint256 tokenId, address hospital) public view returns (
        bool hasAccess,
        uint256 grantedAt,
        uint256 expiresAt,
        uint256 paymentAmount,
        bytes32 xrplTransactionHash
    ) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");

        AccessPermission storage permission = medicalRecords[tokenId].accessPermissions[hospital];
        return (
            permission.hasAccess,
            permission.grantedAt,
            permission.expiresAt,
            permission.paymentAmount,
            permission.xrplTransactionHash
        );
    }

    /**
     * @dev Get all token IDs owned by a patient
     * @param patient Patient's address
     */
    function getPatientTokens(address patient) public view returns (uint256[] memory) {
        return patientTokens[patient];
    }

    /**
     * @dev Revoke access for a hospital
     * @param tokenId Medical record token ID
     * @param hospital Hospital's address
     */
    function revokeAccess(uint256 tokenId, address hospital) public {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        require(
            msg.sender == owner() || msg.sender == medicalRecords[tokenId].patientAddress,
            "Not authorized"
        );

        medicalRecords[tokenId].accessPermissions[hospital].hasAccess = false;
        medicalRecords[tokenId].accessPermissions[hospital].expiresAt = block.timestamp;

        emit AccessRevoked(tokenId, hospital);
    }

    /**
     * @dev Deactivate a medical record
     * @param tokenId Medical record token ID
     */
    function deactivateRecord(uint256 tokenId) public {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        require(
            msg.sender == owner() || msg.sender == medicalRecords[tokenId].patientAddress,
            "Not authorized"
        );

        medicalRecords[tokenId].isActive = false;
    }

    // Override required by Solidity
    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC721URIStorage) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}