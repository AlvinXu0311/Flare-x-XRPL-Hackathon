require("dotenv").config();
const HDWalletProvider = require("@truffle/hdwallet-provider");

const { PRIVATE_KEY, COSTON2_RPC } = process.env;

module.exports = {
  networks: {
    // Local development (Ganache, Anvil, Hardhat node, etc.)
    development: {
      host: "127.0.0.1",
      port: 8545,
      network_id: "*",
    },

    // Flare Coston2 testnet
    flare_coston2: {
      provider: () =>
        new HDWalletProvider({
          privateKeys: [PRIVATE_KEY],
          providerOrUrl: COSTON2_RPC,
        }),
      network_id: 114,          // Coston2 network id
      gas: 6000000,             // 6 million gas per tx (safe default)
      gasPrice: 30000000000,    // 30 gwei
      confirmations: 2,         // wait for 2 blocks
      timeoutBlocks: 200,       // timeout if not mined
      skipDryRun: true,         // skip test dry run
    },
  },

  compilers: {
    solc: {
      version: "0.8.21",   // match your pragma
      settings: {
        optimizer: {
          enabled: true,
          runs: 200,
        },
      },
    },
  },

  db: {
    enabled: false,
  },
};
