// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

interface IFDC {
    function verify(bytes calldata proof, bytes32 statementId) external view returns (bool);
}

contract MockFDC is IFDC {
    bool public alwaysTrue = true;

    function setAlwaysTrue(bool v) external { alwaysTrue = v; }

    function verify(bytes calldata, bytes32) external view returns (bool) {
        return alwaysTrue; // accept everything for testing
    }
}
