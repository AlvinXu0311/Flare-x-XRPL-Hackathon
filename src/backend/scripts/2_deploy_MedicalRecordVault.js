// migrations/2_deploy_MedicalRecordVault.js
require("dotenv").config();

// ⚠️ Make sure this name matches the Solidity `contract` name.
// If your file defines `contract MedicalRecordVault { ... }` then
// change the line below to artifacts.require("MedicalRecordVault");
const Vault = artifacts.require("MedicalRecordVault");

module.exports = async function (deployer, network, accounts) {
  // 1) Deploy the vault (no constructor args)
  await deployer.deploy(Vault);
  const vault = await Vault.deployed();

  // 2) Optional: initial configuration
  // - feeCollector: who receives the upload fees (defaults to deployer[0])
  // - uploadFeeWei: per-upload fee in wei (defaults 0.0001 ether)
  // - fdcAddress: address of an on-chain verifier (MockFDC or real). Leave empty to skip.

  const feeCollector = process.env.FEE_COLLECTOR || accounts[0];
  const uploadFeeWei =
    process.env.UPLOAD_FEE_WEI || web3.utils.toWei("0.0001", "ether");
  const fdcAddress = process.env.FDC_ADDRESS || ""; // e.g. "0xabc..."; leave blank to skip

  // setUploadFee(uint256 feeWei, address collector)
  await vault.setUploadFee(uploadFeeWei, feeCollector);

  if (fdcAddress && fdcAddress !== "" && fdcAddress !== "0x0000000000000000000000000000000000000000") {
    await vault.setFDC(fdcAddress);
  }

  console.log("Vault deployed at:", vault.address);
  console.log("Fee collector:", feeCollector);
  console.log("Upload fee (wei):", uploadFeeWei);
  if (fdcAddress) console.log("FDC verifier set to:", fdcAddress);
};
