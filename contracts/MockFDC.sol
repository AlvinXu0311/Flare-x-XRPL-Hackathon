// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

/**
 * MockFDC - Always returns true for testing
 * For production, use real FDC contract from Flare
 */
contract MockFDC {
    function verify(bytes calldata proof, bytes32 statementId) external pure returns (bool) {
        // Always return true for testing - any proof passes
        return true;
    }
}