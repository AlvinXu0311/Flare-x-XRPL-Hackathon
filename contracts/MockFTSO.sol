// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

/// Match your vault's interface
interface IFTSO {
    /// Returns (XRP price in USD with `decimals`, decimals, timestamp)
    function getXRPUSDPrice() external view returns (
        uint256 price,
        uint8   decimals,
        uint256 timestamp
    );
}

/// Simple configurable mock for UI / integration testing
contract MockFTSO is IFTSO {
    uint256 private _price;     // e.g. 1e18 => $1.00 when decimals = 18
    uint8   private _decimals;  // decimals of `_price`
    uint256 private _timestamp; // last update time

    event PriceUpdated(uint256 price, uint8 decimals, uint256 timestamp);

    constructor() {
        // sensible defaults: $1.00 with 18 decimals, "now" timestamp
        _price     = 1e18;
        _decimals  = 18;
        _timestamp = block.timestamp;
        emit PriceUpdated(_price, _decimals, _timestamp);
    }

    function getXRPUSDPrice() external view override returns (
        uint256 price,
        uint8   decimals,
        uint256 timestamp
    ) {
        return (_price, _decimals, _timestamp);
    }

    /// Set price and decimals; timestamp = now
    function setPrice(uint256 price_, uint8 decimals_) external {
        _price = price_;
        _decimals = decimals_;
        _timestamp = block.timestamp;
        emit PriceUpdated(_price, _decimals, _timestamp);
    }

    /// Set price, decimals, and explicit timestamp (useful to test staleness)
    function setPriceAndTimestamp(uint256 price_, uint8 decimals_, uint256 timestamp_) external {
        _price = price_;
        _decimals = decimals_;
        _timestamp = timestamp_;
        emit PriceUpdated(_price, _decimals, _timestamp);
    }

    /// Convenience: bump timestamp forward (seconds)
    function bumpTime(uint256 secondsForward) external {
        _timestamp += secondsForward;
        emit PriceUpdated(_price, _decimals, _timestamp);
    }
}
