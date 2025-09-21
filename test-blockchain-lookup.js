require('dotenv').config();
const { ethers } = require('ethers');

// Contract ABI
const SIMPLE_VAULT_ABI = [
  "function uploadDocument(bytes32 patientId, uint8 kind, string calldata hashURI) external",
  "function getDocument(bytes32 patientId, uint8 kind) external returns (string memory, uint256, uint256, address)",
  "function documentExists(bytes32 patientId, uint8 kind) external view returns (bool)",
  "function docKindName(uint8 kind) external pure returns (string memory)",
  "event DocumentUploaded(bytes32 indexed patientId, uint8 indexed kind, string hashURI, uint256 version, address uploader)"
];

async function demonstrateBlockchainLookup() {
  console.log("🔍 Testing Blockchain Document Lookup Features");
  console.log("==============================================");

  // Setup
  const provider = new ethers.providers.JsonRpcProvider(process.env.COSTON2_RPC);
  const wallet = new ethers.Wallet(process.env.PK, provider);
  const contractAddress = process.env.VAULT;

  console.log("📍 Contract Address:", contractAddress);
  console.log("👤 Test Account:", wallet.address);

  const contract = new ethers.Contract(contractAddress, SIMPLE_VAULT_ABI, wallet);

  try {
    // Test scenario: Upload some test documents to demonstrate lookup features
    const testPatientId = "0xd976ece7f97402cc704731e8d64e747d1126161565a1208473a9bf64bffc8570";

    console.log("\n📤 Uploading test documents for lookup demonstration...");

    // Upload different document types
    const documents = [
      { type: 0, name: "Diagnosis", uri: `diagnosis-${Date.now()}|metadata:filename=diagnosis.pdf` },
      { type: 1, name: "Referral", uri: `referral-${Date.now()}|metadata:filename=referral.doc` },
      { type: 2, name: "Intake", uri: `intake-${Date.now()}|metadata:filename=intake.txt` }
    ];

    const txHashes = [];

    for (const doc of documents) {
      console.log(`📄 Uploading ${doc.name} document...`);
      const tx = await contract.uploadDocument(testPatientId, doc.type, doc.uri);
      console.log(`✅ ${doc.name} transaction: ${tx.hash}`);

      const receipt = await tx.wait();
      console.log(`✅ ${doc.name} confirmed in block: ${receipt.blockNumber}`);

      txHashes.push(tx.hash);
    }

    console.log("\n🔍 Demonstrating Blockchain Lookup Methods:");
    console.log("============================================");

    // Method 1: Patient ID Lookup
    console.log("\n1️⃣ Patient ID Lookup:");
    console.log("Patient ID:", testPatientId);

    for (let docType = 0; docType < 3; docType++) {
      const exists = await contract.documentExists(testPatientId, docType);
      if (exists) {
        const result = await contract.callStatic.getDocument(testPatientId, docType);
        const [hashURI, version, updatedAt, uploader] = result;
        const typeName = await contract.docKindName(docType);

        console.log(`  📄 ${typeName}:`);
        console.log(`    - Hash URI: ${hashURI}`);
        console.log(`    - Version: ${version.toString()}`);
        console.log(`    - Updated: ${new Date(updatedAt.toNumber() * 1000).toISOString()}`);
        console.log(`    - Uploader: ${uploader}`);
      }
    }

    // Method 2: Transaction Hash Lookup
    console.log("\n2️⃣ Transaction Hash Lookup:");

    for (let i = 0; i < txHashes.length; i++) {
      const txHash = txHashes[i];
      console.log(`\nTransaction ${i + 1}: ${txHash}`);

      // Get transaction receipt
      const receipt = await provider.getTransactionReceipt(txHash);
      console.log(`  📦 Block Number: ${receipt.blockNumber}`);
      console.log(`  ⛽ Gas Used: ${receipt.gasUsed.toString()}`);
      console.log(`  👤 From: ${receipt.from}`);

      // Look for DocumentUploaded events
      const uploadEventTopic = ethers.utils.id("DocumentUploaded(bytes32,uint8,string,uint256,address)");
      const relevantLogs = receipt.logs.filter(log =>
        log.address.toLowerCase() === contractAddress.toLowerCase() &&
        log.topics[0] === uploadEventTopic
      );

      if (relevantLogs.length > 0) {
        const iface = new ethers.utils.Interface([
          "event DocumentUploaded(bytes32 indexed patientId, uint8 indexed kind, string hashURI, uint256 version, address uploader)"
        ]);

        for (const log of relevantLogs) {
          const decoded = iface.parseLog(log);
          const { patientId, kind, hashURI, version, uploader } = decoded.args;
          const typeName = await contract.docKindName(kind);

          console.log(`  📄 Document Upload Event:`);
          console.log(`    - Type: ${typeName} (${kind})`);
          console.log(`    - Patient ID: ${patientId}`);
          console.log(`    - Hash URI: ${hashURI}`);
          console.log(`    - Version: ${version.toString()}`);
          console.log(`    - Uploader: ${uploader}`);
        }
      }
    }

    console.log("\n🎯 Frontend Usage Instructions:");
    console.log("===============================");
    console.log("To test the enhanced download page:");
    console.log("");
    console.log("1. Open http://localhost:5173/");
    console.log("2. Go to 'View Documents' tab");
    console.log("3. Try these lookup methods:");
    console.log("");
    console.log("📋 Patient ID Lookup:");
    console.log(`   MRN: test-patient-123`);
    console.log(`   Salt: demo-salt-456`);
    console.log(`   (This generates Patient ID: ${testPatientId})`);
    console.log("");
    console.log("🔗 Transaction Hash Lookup:");
    for (let i = 0; i < txHashes.length; i++) {
      console.log(`   Tx ${i + 1}: ${txHashes[i]}`);
    }
    console.log("");
    console.log("✅ The enhanced download page will show:");
    console.log("   - Document metadata from blockchain");
    console.log("   - Version information");
    console.log("   - Uploader addresses");
    console.log("   - Block numbers and gas usage");
    console.log("   - Transaction details");

  } catch (error) {
    console.error("\n❌ Test Failed:");
    console.error(error.message);
    process.exit(1);
  }
}

demonstrateBlockchainLookup();