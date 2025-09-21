// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

/**
 * MockFTSO - Configurable XRP/USD price oracle for testing
 * For production, use real FTSO contract from Flare
 */
contract MockFTSO {
    uint256 public price = 1000000000000000000; // $1.00 with 18 decimals (default)
    uint8 public decimals = 18;
    uint256 public lastUpdated;

    constructor() {
        lastUpdated = block.timestamp;
    }

    function getXRPUSDPrice() external view returns (uint256, uint8, uint256) {
        return (price, decimals, lastUpdated);
    }

    // Admin functions for testing
    function setPrice(uint256 _price, uint8 _decimals) external {
        price = _price;
        decimals = _decimals;
        lastUpdated = block.timestamp;
    }

    function setTimestamp(uint256 _timestamp) external {
        lastUpdated = _timestamp;
    }
}