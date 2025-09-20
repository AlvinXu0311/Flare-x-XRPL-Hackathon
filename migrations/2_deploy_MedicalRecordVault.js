const Vault = artifacts.require("MedicalRecordVaultXRPL"); // must match your contract name

module.exports = async function (deployer) {
  await deployer.deploy(Vault);
  const vault = await Vault.deployed();
  console.log("Vault deployed at:", vault.address);

  // Optional defaults (no .env): set fees collector and amounts
  // Only run this if your contract has setUploadFees(uint256,uint256,address)
  try {
    const feeWei  = web3.utils.toWei("0.0001", "ether");
    const feeUSDc = 500; // $5.00
    const accounts = await web3.eth.getAccounts();
    await vault.setUploadFees(feeWei, feeUSDc, accounts[0]);
    console.log("Upload fees set:", { feeWei, feeUSDc, collector: accounts[0] });
  } catch (e) {
    // If your contract doesn't have setUploadFees, this will be skipped.
    console.log("Skipped setUploadFees:", e.message);
  }
};
