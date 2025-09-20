require("dotenv").config();

module.exports = {
  // Where Truffle looks (defaults shown)
  contracts_directory: "./contracts",
  contracts_build_directory: "./build/contracts",

  networks: {
    // Local Foundry Anvil at 127.0.0.1:8545
    development: {
      host: "127.0.0.1",
      port: 8545,
      network_id: "*",
    },
    // Example: Flare Coston2 (uncomment when needed)
    // coston2: {
    //   provider: () => new (require("@truffle/hdwallet-provider"))(
    //     process.env.PRIVATE_KEY,
    //     process.env.RPC_COSTON2
    //   ),
    //   network_id: 114,
    //   gas: 8000000,
    // },
  },

  compilers: {
    solc: {
      version: "0.8.21",
      settings: { optimizer: { enabled: true, runs: 200 } },
    },
  },
};

module.exports = {
  contracts_directory: "./contracts",
  contracts_build_directory: "./build/contracts",

  networks: {
    development: {
      host: "127.0.0.1",
      port: 8545,        // Anvil default
      network_id: "*",   // match any
    },
  },

  compilers: {
    solc: {
      version: "0.8.21",
      settings: { optimizer: { enabled: true, runs: 200 } },
    },
  },
};