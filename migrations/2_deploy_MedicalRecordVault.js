// migrations/2_deploy_MedicalRecordVault.js
const MedicalRecordVaultXRPL = artifacts.require("MedicalRecordVaultXRPL");

module.exports = async function (deployer) {
  await deployer.deploy(MedicalRecordVaultXRPL);
  const inst = await MedicalRecordVaultXRPL.deployed();
  console.log("✅ MedicalRecordVaultXRPL deployed at:", inst.address);
};
