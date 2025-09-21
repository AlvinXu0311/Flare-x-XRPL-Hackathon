const SimpleMedicalVault = artifacts.require("SimpleMedicalVault");

module.exports = function (deployer, network, accounts) {
  console.log("🚀 Deploying SimpleMedicalVault contract...");
  console.log("📍 Network:", network);
  console.log("👤 Deployer:", accounts[0]);

  deployer.deploy(SimpleMedicalVault).then(async () => {
    const vault = await SimpleMedicalVault.deployed();

    console.log("✅ SimpleMedicalVault deployed successfully!");
    console.log("📍 Contract address:", vault.address);
    console.log("👤 Contract owner:", await vault.owner());

    // Test basic functionality
    console.log("\n🧪 Testing basic functionality...");
    try {
      const diagnosisName = await vault.docKindName(0);
      const referralName = await vault.docKindName(1);
      const intakeName = await vault.docKindName(2);

      console.log("📄 Document types:");
      console.log("  0:", diagnosisName);
      console.log("  1:", referralName);
      console.log("  2:", intakeName);

      console.log("✅ Basic functionality test PASSED");
    } catch (error) {
      console.error("❌ Basic functionality test FAILED:", error.message);
    }

    // Environment update instructions
    console.log("\n📝 Environment Configuration:");
    console.log("Update your .env file with:");
    console.log(`VITE_VAULT_ADDRESS=${vault.address}`);

    console.log("\n🎉 Deployment completed successfully!");

    return vault;
  });
};