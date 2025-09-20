// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IFlareContracts
 * @dev Interface definitions for Flare system contracts
 */

// Flare FTSO (Flare Time Series Oracle) interface
interface IFtsoRegistry {
    function getCurrentPriceWithDecimals(string memory _symbol)
        external view returns (uint256 _price, uint256 _timestamp, uint256 _decimals);

    function getCurrentPrice(string memory _symbol)
        external view returns (uint256 _price, uint256 _timestamp);
}

// Flare State Connector interface
interface IStateConnector {
    function requestAttestation(bytes calldata data) external returns (bytes32);
    function getAttestation(bytes32 id) external view returns (bytes memory);

    function verifyAttestation(
        bytes32 attestationType,
        bytes32 sourceId,
        bytes calldata requestBody,
        bytes calldata responseBody
    ) external view returns (bool);
}

// LayerCake interface for cross-chain messaging
interface ILayerCake {
    function sendXRPLTransaction(bytes calldata transaction) external returns (bytes32);
    function getXRPLAccountInfo(string calldata xrplAddress) external view returns (bytes memory);
}

// Flare Price Submitter interface
interface IPriceSubmitter {
    function submitHash(uint256 _epochId, bytes32 _hash) external;
    function revealPrice(uint256 _epochId, uint256 _price, uint256 _random) external;
}

// Flare Validator Registry interface
interface IFlareContractRegistry {
    function getContractAddressByName(string calldata _name) external view returns (address);
    function getContractAddressByHash(bytes32 _nameHash) external view returns (address);
}