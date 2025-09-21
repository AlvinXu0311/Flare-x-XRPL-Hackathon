// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

/**
 * Interface for Flare Contract Registry
 * Registry address is the same on all Flare networks: 0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019
 */
interface IFlareContractRegistry {
    /**
     * Returns contract address for the given name, or zero address if contract does not exist.
     * @param _name             Contract name
     * @return                  Contract address
     */
    function getContractAddressByName(string calldata _name) external view returns (address);

    /**
     * Returns contract address for the given name hash, or zero address if contract does not exist.
     * @param _nameHash         Contract name hash
     * @return                  Contract address
     */
    function getContractAddressByHash(bytes32 _nameHash) external view returns (address);

    /**
     * Returns all contract names and corresponding addresses.
     * @return _names           Contract names
     * @return _addresses       Contract addresses
     */
    function getAllContracts() external view returns (string[] memory _names, address[] memory _addresses);
}

/**
 * Real Flare FDC Hub Interface
 */
interface IFdcHub {
    struct AttestationRequest {
        bytes32 attestationType;
        bytes32 sourceId;
        bytes requestBody;
        uint256 fee;
    }

    /**
     * Submit an attestation request
     * @param _request          The attestation request
     * @return                  Request ID
     */
    function requestAttestation(AttestationRequest calldata _request) external payable returns (bytes32);

    /**
     * Get attestation fee for a specific type
     * @param _attestationType  The attestation type
     * @return                  Required fee amount
     */
    function getAttestationFee(bytes32 _attestationType) external view returns (uint256);
}

/**
 * Real Flare FDC Verification Interface
 */
interface IFdcVerification {
    struct Proof {
        bytes32 merkleRoot;
        bytes32[] merkleProof;
        bytes data;
    }

    /**
     * Verify attestation proof
     * @param _proof            The proof data
     * @return                  True if verification succeeds
     */
    function verifyAttestation(Proof calldata _proof) external view returns (bool);
}