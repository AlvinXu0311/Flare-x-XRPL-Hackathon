const { ethers } = require("hardhat");
const hardhat = require("hardhat");

async function main() {
  console.log("🚀 Starting MedicalRecordToken deployment...");

  // Get the contract factory
  const MedicalRecordToken = await ethers.getContractFactory("MedicalRecordToken");

  // Get deployer address for initial owner
  const [deployer] = await ethers.getSigners();
  console.log("👤 Deployer address:", deployer.address);

  // Deploy the contract
  console.log("📝 Deploying contract...");
  const medicalRecordToken = await MedicalRecordToken.deploy(deployer.address);

  // Wait for deployment to complete
  await medicalRecordToken.waitForDeployment();

  const contractAddress = await medicalRecordToken.getAddress();

  console.log("✅ MedicalRecordToken deployed successfully!");
  console.log(`📄 Contract address: ${contractAddress}`);
  console.log(`🌐 Network: ${hardhat.network.name}`);
  console.log(`⛽ Gas used: ${medicalRecordToken.deploymentTransaction()?.gasLimit || 'N/A'}`);

  // Verify contract is working
  console.log("🔍 Verifying contract deployment...");
  const name = await medicalRecordToken.name();
  const symbol = await medicalRecordToken.symbol();

  console.log(`📋 Contract name: ${name}`);
  console.log(`🏷️  Contract symbol: ${symbol}`);

  return {
    contractAddress,
    name,
    symbol,
    network: hardhat.network.name
  };
}

// Export for programmatic use
module.exports = { main };

// Run if called directly
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("❌ Deployment failed:", error);
      process.exit(1);
    });
}