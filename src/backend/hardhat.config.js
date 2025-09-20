require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    hardhat: {
      // Built-in test network
    },
    flareCoston2: {
      url: "https://coston2-api.flare.network/ext/bc/C/rpc",
      chainId: 114,
      accounts: ["66b8d15eea4d643a0307943b3ea8665bef496f4cc5248bc5649c1751d65e1ede"], // Populated with deployment key
      gas: 2100000,
      gasPrice: 25000000000, // 25 Gwei minimum required by Flare Coston2
    }
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  }
};