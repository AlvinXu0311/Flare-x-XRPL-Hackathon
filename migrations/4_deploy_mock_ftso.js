const MockFTSO = artifacts.require("MockFTSO");
const Vault    = artifacts.require("MedicalRecordVaultXRPL");

module.exports = async function (deployer) {
  await deployer.deploy(MockFTSO);
  const ftso = await MockFTSO.deployed();

  // get the vault already deployed in migration #1
  const vault = await Vault.deployed();

  // link the vault to this FTSO (must be called by owner)
  await vault.setFTSO(ftso.address);

  console.log("✅ MockFTSO deployed at:", ftso.address);
  console.log("✅ Vault now points to FTSO:", await vault.ftso());
};
