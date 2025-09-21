require('dotenv').config();
const { ethers } = require('ethers');

// Quick test to verify transaction hash display
async function testTransactionHashDisplay() {
  console.log("🧪 Testing Transaction Hash Display Fix");
  console.log("======================================");

  const provider = new ethers.providers.JsonRpcProvider(process.env.COSTON2_RPC);
  const wallet = new ethers.Wallet(process.env.PK, provider);
  const contractAddress = process.env.VAULT;

  const SIMPLE_VAULT_ABI = [
    "function uploadDocument(bytes32 patientId, uint8 kind, string calldata hashURI) external"
  ];

  const contract = new ethers.Contract(contractAddress, SIMPLE_VAULT_ABI, wallet);

  try {
    console.log("📍 Contract:", contractAddress);
    console.log("👤 Account:", wallet.address);

    const testPatientId = "0xd976ece7f97402cc704731e8d64e747d1126161565a1208473a9bf64bffc8570";
    const testURI = `test-txhash-${Date.now()}|metadata:filename=test.txt`;

    console.log("\n📤 Uploading test document...");

    // Send transaction
    const tx = await contract.uploadDocument(testPatientId, 0, testURI);
    console.log("✅ Transaction sent:", tx.hash);
    console.log("📝 Transaction object structure:");
    console.log("   - hash:", tx.hash);
    console.log("   - nonce:", tx.nonce);
    console.log("   - gasLimit:", tx.gasLimit.toString());

    // Wait for confirmation
    const receipt = await tx.wait();
    console.log("\n✅ Transaction confirmed!");
    console.log("📋 Receipt structure:");
    console.log("   - transactionHash:", receipt.transactionHash);
    console.log("   - blockNumber:", receipt.blockNumber);
    console.log("   - gasUsed:", receipt.gasUsed.toString());
    console.log("   - hash property:", receipt.hash || "undefined");

    console.log("\n🔍 What the UI should show:");
    console.log("===========================");
    console.log("✅ Transaction Hash:", receipt.transactionHash);
    console.log("✅ Block Number:", receipt.blockNumber);
    console.log("✅ Gas Used:", receipt.gasUsed.toString());

    console.log("\n💡 Fix Summary:");
    console.log("===============");
    console.log("❌ Before: Using receipt.hash (undefined)");
    console.log("✅ After:  Using receipt.transactionHash");
    console.log("🎨 Added:  Enhanced CSS styling for transaction hash");

  } catch (error) {
    console.error("❌ Test failed:", error.message);
  }
}

testTransactionHashDisplay();