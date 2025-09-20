require("dotenv").config();
const HDWalletProvider = require("@truffle/hdwallet-provider");

const {
  PRIVATE_KEY,      // test key (0x-prefixed)
  ANVIL_RPC,        // e.g. http://127.0.0.1:8545
  COSTON2_RPC,      // e.g. https://coston2-api.flare.network/ext/bc/C/rpc
  SONGBIRD_RPC,     // e.g. https://songbird-api.flare.network/ext/bc/C/rpc
  FLARE_RPC         // e.g. https://flare-api.flare.network/ext/bc/C/rpc
} = process.env;

// Helper: normalize key to 0x-prefixed
const PK = PRIVATE_KEY?.startsWith("0x") ? PRIVATE_KEY : (PRIVATE_KEY ? `0x${PRIVATE_KEY}` : undefined);

module.exports = {
  networks: {
    // Plain local node (Anvil/Ganache/Hardhat) w/o HDWalletProvider
    development: {
      host: "127.0.0.1",
      port: 8545,
      network_id: "*",
    },

    // Anvil via HDWalletProvider (uses PRIVATE_KEY)
    anvil: {
      provider: () =>
        new HDWalletProvider({
          privateKeys: [PK],
          providerOrUrl: ANVIL_RPC || "http://127.0.0.1:8545",
          // chainId: 31337, // optional, uncomment if you want to pin it
        }),
      network_id: "*",
      gas: 8_000_000,
      // Set to 0 only if you start anvil with --gas-price 0
      gasPrice: 1e9, // 1 gwei default on anvil
    },

    // Flare testnet (Coston2)
    flare_coston2: {
      provider: () =>
        new HDWalletProvider({
          privateKeys: [PK],
          providerOrUrl: COSTON2_RPC,
        }),
      network_id: 114,
      gas: 8_000_000,
      gasPrice: 25e9,
      confirmations: 1,
      timeoutBlocks: 200,
      skipDryRun: true,
    },

    // Staging (Songbird)
    flare_songbird: {
      provider: () =>
        new HDWalletProvider({
          privateKeys: [PK],
          providerOrUrl: SONGBIRD_RPC,
        }),
      network_id: 19,
      gas: 8_000_000,
      gasPrice: 25e9,
      confirmations: 2,
      timeoutBlocks: 200,
      skipDryRun: true,
    },

    // Flare mainnet
    flare_mainnet: {
      provider: () =>
        new HDWalletProvider({
          privateKeys: [PK],
          providerOrUrl: FLARE_RPC,
        }),
      network_id: 14,
      gas: 8_000_000,
      gasPrice: 25e9,
      confirmations: 2,
      timeoutBlocks: 200,
      skipDryRun: true,
    },
  },

  compilers: {
    solc: {
      version: "0.8.21",
      settings: { optimizer: { enabled: true, runs: 200 } },
    },
  },

  db: { enabled: false },
};
