const MockFDC = artifacts.require("MockFDC");
const Vault   = artifacts.require("MedicalRecordVaultXRPL");

module.exports = async function (deployer, network, accounts) {
  await deployer.deploy(MockFDC);
  const fdc = await MockFDC.deployed();

  const vault = await Vault.deployed();
  await vault.setFDC(fdc.address);              // must be owner
  console.log("MockFDC:", fdc.address);
  console.log("Vault.fdc:", await vault.fdc());
};
