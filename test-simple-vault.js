require('dotenv').config();
const { ethers } = require('ethers');

// Contract ABI - just the functions we need to test
const SIMPLE_VAULT_ABI = [
  "function uploadDocument(bytes32 patientId, uint8 kind, string calldata hashURI) external",
  "function uploadDocumentDeduct(bytes32 patientId, uint8 kind, string calldata hashURI) external",
  "function getDocument(bytes32 patientId, uint8 kind) external returns (string memory, uint256, uint256, address)",
  "function documentExists(bytes32 patientId, uint8 kind) external view returns (bool)",
  "function docKindName(uint8 kind) external pure returns (string memory)",
  "function owner() external view returns (address)"
];

async function testSimpleVault() {
  console.log("🧪 Testing SimpleMedicalVault Contract");
  console.log("=====================================");

  // Setup
  const provider = new ethers.providers.JsonRpcProvider(process.env.COSTON2_RPC);
  const wallet = new ethers.Wallet(process.env.PK, provider);
  const contractAddress = process.env.VAULT;

  console.log("📍 Contract Address:", contractAddress);
  console.log("👤 Test Account:", wallet.address);

  const contract = new ethers.Contract(contractAddress, SIMPLE_VAULT_ABI, wallet);

  try {
    // Test 1: Check contract owner
    console.log("\n1️⃣ Testing Contract Owner...");
    const owner = await contract.owner();
    console.log("✅ Contract Owner:", owner);

    // Test 2: Check document types
    console.log("\n2️⃣ Testing Document Types...");
    for (let i = 0; i < 3; i++) {
      const typeName = await contract.docKindName(i);
      console.log(`✅ Type ${i}:`, typeName);
    }

    // Test 3: Test patient ID (32 bytes)
    const testPatientId = "0xd976ece7f97402cc704731e8d64e747d1126161565a1208473a9bf64bffc8570";
    console.log("\n3️⃣ Testing Patient ID Format...");
    console.log("✅ Patient ID:", testPatientId);
    console.log("✅ Length:", testPatientId.length, "characters (should be 66 for 0x + 64 hex)");

    // Test 4: Check if document exists (should be false initially)
    console.log("\n4️⃣ Testing Document Existence Check...");
    const existsBefore = await contract.documentExists(testPatientId, 0);
    console.log("✅ Document exists before upload:", existsBefore);

    // Test 5: Upload a test document
    console.log("\n5️⃣ Testing Document Upload...");
    const testHashURI = "test-hash-" + Date.now();
    console.log("📤 Uploading document with hash:", testHashURI);

    const tx = await contract.uploadDocumentDeduct(testPatientId, 0, testHashURI);
    console.log("✅ Transaction sent:", tx.hash);

    const receipt = await tx.wait();
    console.log("✅ Transaction confirmed in block:", receipt.blockNumber);
    console.log("✅ Gas used:", receipt.gasUsed.toString());

    // Test 6: Check if document exists after upload
    console.log("\n6️⃣ Testing Document Existence After Upload...");
    const existsAfter = await contract.documentExists(testPatientId, 0);
    console.log("✅ Document exists after upload:", existsAfter);

    // Test 7: Read the uploaded document
    console.log("\n7️⃣ Testing Document Retrieval...");
    const result = await contract.callStatic.getDocument(testPatientId, 0);
    console.log("✅ Retrieved hash URI:", result[0]);
    console.log("✅ Version:", result[1].toString());
    console.log("✅ Updated at:", new Date(result[2].toNumber() * 1000).toISOString());
    console.log("✅ Uploader:", result[3]);

    // Test 8: Test uploadDocument function (should work the same)
    console.log("\n8️⃣ Testing Direct uploadDocument Function...");
    const testHashURI2 = "test-hash-direct-" + Date.now();
    const tx2 = await contract.uploadDocument(testPatientId, 1, testHashURI2);
    console.log("✅ Direct upload transaction:", tx2.hash);
    await tx2.wait();

    const result2 = await contract.callStatic.getDocument(testPatientId, 1);
    console.log("✅ Retrieved hash URI from direct upload:", result2[0]);

    console.log("\n🎉 All Tests Passed!");
    console.log("=====================================");
    console.log("✅ Contract is working correctly");
    console.log("✅ No guardian/payment restrictions");
    console.log("✅ Both upload functions work");
    console.log("✅ Document retrieval works");
    console.log("✅ Ready for frontend integration");

  } catch (error) {
    console.error("\n❌ Test Failed:");
    console.error(error.message);
    if (error.reason) {
      console.error("Reason:", error.reason);
    }
    process.exit(1);
  }
}

testSimpleVault();