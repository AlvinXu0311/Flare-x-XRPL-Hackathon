const HDWalletProvider = require("@truffle/hdwallet-provider");
require("dotenv").config();

module.exports = {
  contracts_directory: "./contracts",
  contracts_build_directory: "./build/contracts",

  networks: {
    // Local Anvil / Ganache
    development: {
      host: "127.0.0.1",
      port: 8545,
      network_id: "*",
    },

    // Flare Coston2 Testnet
    coston2: {
      provider: () =>
        new HDWalletProvider({
          privateKeys: [process.env.PRIVATE_KEY],
          providerOrUrl: process.env.RPC_COSTON2 || "https://coston2-api.flare.network/ext/C/rpc",
        }),
      network_id: 114,       // Coston2 chain ID
      gas: 15000000,         // Increased to match block gas limit
      gasPrice: 25000000000, // 25 gwei
      skipDryRun: true,      // Skip dry run before migrations
      timeoutBlocks: 50,     // How many blocks before timeout
      networkCheckTimeout: 10000, // Milliseconds to timeout for network verification
      confirmations: 2,      // # of confirmations to wait between deployments
    },

    // Flare Mainnet
    flare: {
      provider: () =>
        new HDWalletProvider({
          privateKeys: [process.env.PRIVATE_KEY],
          providerOrUrl: "https://flare-api.flare.network/ext/C/rpc",
        }),
      network_id: 14,        // Flare mainnet chain ID
      gas: 8000000,
      gasPrice: 2000000000,
    }
  },

  compilers: {
    solc: {
      version: "0.8.21",
      settings: {
        optimizer: {
          enabled: true,
          runs: 200
        }
      }
    }
  },
};
