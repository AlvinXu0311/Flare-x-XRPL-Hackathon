const { ethers } = require("hardhat");
require('dotenv').config();

async function main() {
    console.log("🚀 Deploying SimpleMedicalVault contract...");

    // Get the contract factory
    const SimpleMedicalVault = await ethers.getContractFactory("SimpleMedicalVault");

    // Get deployer account
    const [deployer] = await ethers.getSigners();
    console.log("📍 Deploying contracts with account:", deployer.address);

    // Check balance
    const balance = await deployer.getBalance();
    console.log("💰 Account balance:", ethers.utils.formatEther(balance), "FLR");

    // Deploy the contract
    console.log("📦 Deploying SimpleMedicalVault...");
    const vault = await SimpleMedicalVault.deploy();

    // Wait for deployment
    await vault.deployed();

    console.log("✅ SimpleMedicalVault deployed successfully!");
    console.log("📍 Contract address:", vault.address);
    console.log("🔗 Transaction hash:", vault.deployTransaction.hash);
    console.log("⛽ Gas used:", vault.deployTransaction.gasLimit.toString());

    // Verify deployment
    console.log("\n🔍 Verifying deployment...");
    const owner = await vault.owner();
    console.log("👤 Contract owner:", owner);
    console.log("🆔 Deployer address:", deployer.address);
    console.log("✅ Owner verification:", owner === deployer.address ? "PASSED" : "FAILED");

    // Test basic functionality
    console.log("\n🧪 Testing basic functionality...");

    try {
        // Test document kind names
        const diagnosisName = await vault.docKindName(0);
        const referralName = await vault.docKindName(1);
        const intakeName = await vault.docKindName(2);

        console.log("📄 Document types:");
        console.log("  0:", diagnosisName);
        console.log("  1:", referralName);
        console.log("  2:", intakeName);

        // Test document check (should not exist)
        const testPatientId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test|patient|123"));
        const exists = await vault.documentExists(testPatientId, 0);
        console.log("📋 Test document exists:", exists);

        console.log("✅ Basic functionality test PASSED");

    } catch (error) {
        console.error("❌ Basic functionality test FAILED:", error.message);
    }

    // Generate environment update instructions
    console.log("\n📝 Environment Configuration:");
    console.log("Update your .env file with:");
    console.log(`VITE_VAULT_ADDRESS=${vault.address}`);

    // Generate frontend configuration
    console.log("\n🔧 Frontend Configuration:");
    console.log("Update medical-vault-ui/.env with:");
    console.log(`VITE_VAULT_ADDRESS=${vault.address}`);

    // Show explorer links
    const network = await ethers.provider.getNetwork();
    console.log(`\n🌐 Network: ${network.name} (Chain ID: ${network.chainId})`);

    if (network.chainId === 114) { // Coston2
        console.log("🔍 View on Coston2 Explorer:");
        console.log(`   https://coston2-explorer.flare.network/address/${vault.address}`);
        console.log(`   https://coston2-explorer.flare.network/tx/${vault.deployTransaction.hash}`);
    }

    console.log("\n🎉 Deployment completed successfully!");

    return {
        contractAddress: vault.address,
        transactionHash: vault.deployTransaction.hash,
        owner: owner,
        network: network.name,
        chainId: network.chainId
    };
}

// Handle script execution
if (require.main === module) {
    main()
        .then((result) => {
            console.log("\n📊 Deployment Summary:");
            console.log(JSON.stringify(result, null, 2));
            process.exit(0);
        })
        .catch((error) => {
            console.error("\n❌ Deployment failed:");
            console.error(error);
            process.exit(1);
        });
}

module.exports = main;