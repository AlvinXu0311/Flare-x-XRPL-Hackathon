const MedicalRecordVaultWithBilling = artifacts.require("MedicalRecordVaultWithBilling");
const MockFDC = artifacts.require("MockFDC");
const MockFTSO = artifacts.require("MockFTSO");

module.exports = async function (deployer, network, accounts) {
  console.log("=== Deploying Enhanced Medical Record Vault with Billing ===");
  console.log("Network:", network);
  console.log("Deployer account:", accounts[0]);

  try {
    // Deploy the enhanced vault contract
    console.log("1. Deploying MedicalRecordVaultWithBilling...");
    await deployer.deploy(MedicalRecordVaultWithBilling);
    const vault = await MedicalRecordVaultWithBilling.deployed();
    console.log("✅ MedicalRecordVaultWithBilling deployed at:", vault.address);

    // Get existing FDC and FTSO contracts if they exist
    let fdc, ftso;

    try {
      fdc = await MockFDC.deployed();
      console.log("✅ Using existing MockFDC at:", fdc.address);
    } catch (error) {
      console.log("2. MockFDC not found, deploying new one...");
      await deployer.deploy(MockFDC);
      fdc = await MockFDC.deployed();
      console.log("✅ MockFDC deployed at:", fdc.address);
    }

    try {
      ftso = await MockFTSO.deployed();
      console.log("✅ Using existing MockFTSO at:", ftso.address);
    } catch (error) {
      console.log("3. MockFTSO not found, deploying new one...");
      await deployer.deploy(MockFTSO);
      ftso = await MockFTSO.deployed();
      console.log("✅ MockFTSO deployed at:", ftso.address);
    }

    // Configure the vault with FDC and FTSO
    console.log("4. Configuring vault with oracles...");
    await vault.setFDC(fdc.address);
    await vault.setFTSO(ftso.address);
    console.log("✅ Vault configured with FDC and FTSO");

    // Register sample hospitals for testing
    console.log("5. Registering sample hospitals...");

    const hospitalId1 = web3.utils.keccak256("metropolitan_medical");
    await vault.registerHospital(
      hospitalId1,
      "Metropolitan Medical Center",
      "rHOSP1MetroMedicalCenter123ABC",
      accounts[1] // Use account[1] as hospital contact
    );
    console.log("✅ Registered Metropolitan Medical Center");

    const hospitalId2 = web3.utils.keccak256("city_general");
    await vault.registerHospital(
      hospitalId2,
      "City General Hospital",
      "rHOSP2CityGeneralHospital456DEF",
      accounts[2] // Use account[2] as hospital contact
    );
    console.log("✅ Registered City General Hospital");

    // Register sample insurance for a test patient
    console.log("6. Registering sample insurance mapping...");
    const testPatientId = web3.utils.keccak256("test_patient_123|salt456");
    const testInsurerId = web3.utils.keccak256("aetna_insurance");

    await vault.registerInsuranceForPatient(
      testPatientId,
      testInsurerId,
      "rINS1AetnaInsuranceCompany789GHI",
      accounts[3] // Use account[3] as insurance contact
    );
    console.log("✅ Registered Aetna insurance for test patient");

    // Display contract addresses for frontend configuration
    console.log("\n=== Deployment Summary ===");
    console.log("MedicalRecordVaultWithBilling:", vault.address);
    console.log("MockFDC:", fdc.address);
    console.log("MockFTSO:", ftso.address);

    console.log("\n=== Registered Entities ===");
    console.log("Hospital 1 ID:", hospitalId1);
    console.log("Hospital 2 ID:", hospitalId2);
    console.log("Test Patient ID:", testPatientId);
    console.log("Test Insurance ID:", testInsurerId);

    console.log("\n=== Frontend Configuration ===");
    console.log("Add to your .env file:");
    console.log(`VITE_VAULT_ADDRESS=${vault.address}`);
    console.log(`VITE_FDC_ADDRESS=${fdc.address}`);
    console.log(`VITE_FTSO_ADDRESS=${ftso.address}`);

    // Get system stats
    const stats = await vault.getSystemStats();
    console.log("\n=== Initial System Stats ===");
    console.log("Total Charges:", stats._totalCharges.toString());
    console.log("Total Transactions:", stats._totalTransactions.toString());
    console.log("Registered Hospitals:", stats._registeredHospitals.toString());
    console.log("Active Insurers:", stats._activeInsurers.toString());

    console.log("\n✅ Enhanced Medical Vault with Billing deployed successfully!");

  } catch (error) {
    console.error("❌ Deployment failed:", error);
    throw error;
  }
};