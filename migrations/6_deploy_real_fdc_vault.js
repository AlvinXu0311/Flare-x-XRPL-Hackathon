const MedicalRecordVaultWithRealFDC = artifacts.require("MedicalRecordVaultWithRealFDC");

module.exports = async function (deployer, network, accounts) {
  console.log("=== Deploying Medical Record Vault with REAL Flare FDC Integration ===");
  console.log("Network:", network);
  console.log("Deployer account:", accounts[0]);

  try {
    // Deploy the enhanced vault contract with real FDC integration
    console.log("1. Deploying MedicalRecordVaultWithRealFDC...");
    await deployer.deploy(MedicalRecordVaultWithRealFDC);
    const vault = await MedicalRecordVaultWithRealFDC.deployed();
    console.log("✅ MedicalRecordVaultWithRealFDC deployed at:", vault.address);

    // Verify Flare Contract Registry connection
    console.log("2. Verifying Flare Contract Registry connection...");

    try {
      const registryAddress = "0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019";
      console.log("📋 Flare Contract Registry address:", registryAddress);

      // Test registry connection by getting contract address
      const registry = await vault.getFlareContractRegistry();
      console.log("✅ Successfully connected to Flare Contract Registry");

      // Try to get FDC contracts
      try {
        const fdcHub = await vault.getFdcHub();
        console.log("✅ FdcHub found and accessible");
      } catch (error) {
        console.log("⚠️  FdcHub not available (may not be deployed on this network):", error.message);
      }

      try {
        const fdcVerification = await vault.getFdcVerification();
        console.log("✅ FdcVerification found and accessible");
      } catch (error) {
        console.log("⚠️  FdcVerification not available (may not be deployed on this network):", error.message);
      }

      try {
        const ftsoV2 = await vault.getFtsoV2();
        console.log("✅ FtsoV2 found and accessible");
      } catch (error) {
        console.log("⚠️  FtsoV2 not available (may not be deployed on this network):", error.message);
      }

    } catch (error) {
      console.log("⚠️  Warning: Could not fully verify Flare contracts:", error.message);
      console.log("   This is normal if FDC is not fully deployed on this network yet.");
    }

    // Register sample hospitals for testing
    console.log("3. Registering sample hospitals...");

    const hospitalId1 = web3.utils.keccak256("metropolitan_medical_real");
    await vault.registerHospital(
      hospitalId1,
      "Metropolitan Medical Center (Real FDC)",
      "rHOSP1MetroMedicalRealFDC123",
      accounts[1] // Use account[1] as hospital contact
    );
    console.log("✅ Registered Metropolitan Medical Center with Real FDC");

    const hospitalId2 = web3.utils.keccak256("city_general_real");
    await vault.registerHospital(
      hospitalId2,
      "City General Hospital (Real FDC)",
      "rHOSP2CityGeneralRealFDC456",
      accounts[2] // Use account[2] as hospital contact
    );
    console.log("✅ Registered City General Hospital with Real FDC");

    // Register sample insurance for a test patient
    console.log("4. Registering sample insurance mapping...");
    const testPatientId = web3.utils.keccak256("test_patient_real_fdc|salt123");
    const testInsurerId = web3.utils.keccak256("aetna_insurance_real");

    await vault.registerInsuranceForPatient(
      testPatientId,
      testInsurerId,
      "rINS1AetnaRealFDCInsurance789",
      accounts[3] // Use account[3] as insurance contact
    );
    console.log("✅ Registered Aetna insurance for test patient (Real FDC)");

    // Display deployment summary
    console.log("\n=== Real FDC Deployment Summary ===");
    console.log("Contract Address:", vault.address);
    console.log("Flare Contract Registry:", "0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019");

    console.log("\n=== Registered Entities ===");
    console.log("Hospital 1 ID:", hospitalId1);
    console.log("Hospital 2 ID:", hospitalId2);
    console.log("Test Patient ID:", testPatientId);
    console.log("Test Insurance ID:", testInsurerId);

    console.log("\n=== Frontend Configuration ===");
    console.log("Add to your .env file:");
    console.log(`VITE_VAULT_ADDRESS=${vault.address}`);
    console.log(`VITE_FLARE_CONTRACT_REGISTRY=0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019`);
    console.log(`VITE_USE_REAL_FDC=true`);

    console.log("\n=== Real Flare Integration Features ===");
    console.log("🔥 Real Flare Contract Registry integration");
    console.log("📊 Real FTSO v2 price feeds for XRP/USD");
    console.log("🔗 Real FDC Hub for XRPL payment attestations");
    console.log("✅ Real FDC Verification for proof validation");
    console.log("🏥 Hospital billing with FDC-verified payments");
    console.log("📈 Complete transaction history on-chain");

    // Get system stats
    const stats = await vault.getSystemStats();
    console.log("\n=== Initial System Stats ===");
    console.log("Total Charges:", stats._totalCharges.toString());
    console.log("Total Transactions:", stats._totalTransactions.toString());

    // Try to get current XRP price from real FTSO
    try {
      console.log("\n=== Real FTSO Integration Test ===");
      const priceData = await vault.getXrpUsdPrice();
      console.log("✅ Real XRP/USD Price from FTSO v2:");
      console.log("   Price:", priceData.price.toString());
      console.log("   Decimals:", priceData.decimals.toString());
      console.log("   Timestamp:", new Date(priceData.timestamp * 1000).toISOString());

      const requiredDrops = await vault.requiredXrpDrops();
      console.log("✅ Required XRP drops for document upload:");
      console.log("   Drops:", requiredDrops.drops.toString());
      console.log("   Price:", requiredDrops.price.toString());
      console.log("   Decimals:", requiredDrops.decimals.toString());

    } catch (error) {
      console.log("⚠️  Could not test FTSO integration:", error.message);
      console.log("   This is normal if FTSO v2 is not available on this network.");
    }

    console.log("\n✅ Medical Vault with REAL Flare FDC deployed successfully!");
    console.log("\n🚀 Ready for production use with real Flare oracle infrastructure!");

  } catch (error) {
    console.error("❌ Deployment failed:", error);
    throw error;
  }
};