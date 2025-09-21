// setup.js
require("dotenv").config();
const { ethers } = require("ethers");
const vaultJson = require("./medical-vault-ui/src/abi/MedicalRecordVaultXRPL.json");

// --- load env vars ---
const RPC   = process.env.RPC || "https://coston2-api.flare.network/ext/C/rpc";
const PK    = process.env.PK;
const VAULT = process.env.VAULT;

if (!PK || !VAULT) {
  throw new Error("Set PK and VAULT env vars");
}

// --- ethers v5 provider + wallet ---
const provider = new ethers.providers.JsonRpcProvider(RPC);
const wallet   = new ethers.Wallet(PK, provider);
const vault    = new ethers.Contract(VAULT, vaultJson.abi, wallet);

async function main() {
  console.log("Connected with:", wallet.address);
  console.log("Vault at:", VAULT);

  // Example: set mock FDC + FTSO (replace with your deployed mock addresses)
  const fdcAddr  = process.env.FDC || "0x0000000000000000000000000000000000000000";
  const ftsoAddr = process.env.FTSO || "0x0000000000000000000000000000000000000000";

  if (fdcAddr !== "0x0000000000000000000000000000000000000000") {
    let tx = await vault.setFDC(fdcAddr);
    console.log("setFDC tx:", tx.hash);
    await tx.wait();
  }

  if (ftsoAddr !== "0x0000000000000000000000000000000000000000") {
    let tx = await vault.setFTSO(ftsoAddr);
    console.log("setFTSO tx:", tx.hash);
    await tx.wait();
  }

  console.log("✅ Setup finished");
}

main().catch((err) => {
  console.error("Setup error:", err);
});
