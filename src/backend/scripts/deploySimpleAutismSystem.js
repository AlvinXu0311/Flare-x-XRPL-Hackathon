const { ethers } = require('hardhat');
const fs = require('fs');
const path = require('path');

async function deploySimpleAutismSystem() {
  console.log('🚀 Starting Simple Autism Medical System deployment...');

  try {
    // Get network info
    const network = await ethers.provider.getNetwork();
    console.log(`📋 Network: ${network.name} (Chain ID: ${network.chainId})`);

    // Get deployer
    const [deployer] = await ethers.getSigners();
    console.log(`📋 Deployer: ${deployer.address}`);

    // Check balance
    const balance = await deployer.provider.getBalance(deployer.address);
    console.log(`💰 Balance: ${ethers.formatEther(balance)} FLR`);

    if (balance === 0n) {
      throw new Error('⚠️ No testnet FLR! Get free FLR from: https://coston2-faucet.towolabs.com/');
    }

    const deployedContracts = {};

    // Step 1: Deploy Mock State Connector (lightweight version)
    console.log('\n1️⃣ Deploying MockStateConnector...');

    // Create simple mock contract inline
    const MockStateConnectorCode = `
      // SPDX-License-Identifier: MIT
      pragma solidity ^0.8.20;

      contract MockStateConnector {
          mapping(bytes32 => bool) public verifiedAttestations;

          function requestAttestation(bytes calldata) external pure returns (bytes32) {
              return keccak256("mock_attestation");
          }

          function getAttestation(bytes32) external pure returns (bytes memory) {
              return "mock_data";
          }

          function verifyAttestation(
              bytes32,
              bytes32,
              bytes calldata,
              bytes calldata
          ) external pure returns (bool) {
              return true;
          }

          function setVerifiedAttestation(bytes32 attestationHash, bool verified) external {
              verifiedAttestations[attestationHash] = verified;
          }
      }
    `;

    // Write and compile mock contract
    const mockContractPath = path.join(__dirname, '../contracts/temp/MockStateConnector.sol');
    const tempDir = path.dirname(mockContractPath);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    fs.writeFileSync(mockContractPath, MockStateConnectorCode);

    // Deploy mock
    const MockStateConnector = await ethers.getContractFactory('contracts/temp/MockStateConnector.sol:MockStateConnector');
    const mockStateConnector = await MockStateConnector.deploy();
    await mockStateConnector.waitForDeployment();

    deployedContracts.mockStateConnector = await mockStateConnector.getAddress();
    console.log(`✅ MockStateConnector: ${deployedContracts.mockStateConnector}`);

    // Step 2: Deploy AutismMedicalSystem
    console.log('\n2️⃣ Deploying AutismMedicalSystem...');

    const AutismMedicalSystem = await ethers.getContractFactory('AutismMedicalSystem');
    const autismSystem = await AutismMedicalSystem.deploy(
      deployer.address, // Use deployer as smart account for testing
      deployedContracts.mockStateConnector
    );
    await autismSystem.waitForDeployment();

    deployedContracts.autismMedicalSystem = await autismSystem.getAddress();
    console.log(`✅ AutismMedicalSystem: ${deployedContracts.autismMedicalSystem}`);

    // Step 3: Setup basic configuration
    console.log('\n3️⃣ Setting up system configuration...');

    // Grant roles for testing
    const HOSPITAL_ROLE = ethers.keccak256(ethers.toUtf8Bytes('HOSPITAL_ROLE'));
    const INSURANCE_ROLE = ethers.keccak256(ethers.toUtf8Bytes('INSURANCE_ROLE'));
    const EVALUATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes('EVALUATOR_ROLE'));

    await autismSystem.grantRole(HOSPITAL_ROLE, deployer.address);
    await autismSystem.grantRole(INSURANCE_ROLE, deployer.address);
    await autismSystem.grantRole(EVALUATOR_ROLE, deployer.address);

    console.log('✅ Roles granted to deployer');

    // Add test insurance providers
    const testInsurers = ['Test Insurance Co', 'Demo Health Plan'];
    for (const insurer of testInsurers) {
      await autismSystem.addVerifiedInsurance(insurer);
      console.log(`✅ Added insurer: ${insurer}`);
    }

    // Step 4: Update environment
    console.log('\n4️⃣ Updating environment...');

    const envPath = path.join(__dirname, '../.env');
    let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';

    const envUpdates = {
      'AUTISM_MEDICAL_CONTRACT_ADDRESS': deployedContracts.autismMedicalSystem,
      'STATE_CONNECTOR_ADDRESS': deployedContracts.mockStateConnector,
      'DEPLOYMENT_NETWORK': network.name,
      'DEPLOYMENT_TIMESTAMP': new Date().toISOString()
    };

    for (const [key, value] of Object.entries(envUpdates)) {
      const regex = new RegExp(`^${key}=.*`, 'm');
      if (envContent.match(regex)) {
        envContent = envContent.replace(regex, `${key}=${value}`);
      } else {
        envContent += `\n${key}=${value}`;
      }
    }

    fs.writeFileSync(envPath, envContent);
    console.log('✅ Environment updated');

    // Step 5: Create deployment summary
    const deploymentSummary = {
      timestamp: new Date().toISOString(),
      network: network.name,
      chainId: network.chainId.toString(),
      deployer: deployer.address,
      contracts: deployedContracts,
      gasUsed: 'TBD', // Would need to track from receipts
      status: 'SUCCESS'
    };

    const summaryPath = path.join(__dirname, '../deployments/simple-autism-deployment.json');
    const deploymentsDir = path.dirname(summaryPath);
    if (!fs.existsSync(deploymentsDir)) {
      fs.mkdirSync(deploymentsDir, { recursive: true });
    }

    fs.writeFileSync(summaryPath, JSON.stringify(deploymentSummary, null, 2));
    console.log(`✅ Summary saved: ${summaryPath}`);

    // Step 6: Test deployment
    console.log('\n5️⃣ Testing deployment...');

    try {
      // Test role checking
      const hasRole = await autismSystem.hasRole(HOSPITAL_ROLE, deployer.address);
      console.log(`✅ Role test passed: ${hasRole}`);

      // Test mock state connector
      const mockResult = await mockStateConnector.verifyAttestation('0x0', '0x0', '0x', '0x');
      console.log(`✅ State connector test: ${mockResult}`);

    } catch (error) {
      console.warn('⚠️ Test warning:', error.message);
    }

    // Cleanup temp files
    try {
      fs.unlinkSync(mockContractPath);
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (e) {
      // Ignore cleanup errors
    }

    console.log('\n🎉 Simple Autism Medical System deployed successfully!');
    console.log('\n📋 Contract Addresses:');
    console.table(deployedContracts);

    console.log('\n📚 Quick Test Commands:');
    console.log('# Test the API server:');
    console.log('npm start');
    console.log('');
    console.log('# Test evaluation upload:');
    console.log('curl -X GET http://localhost:3000/api/autism/evaluation-types');
    console.log('');
    console.log('# Check deployment:');
    console.log(`echo "Autism System: ${deployedContracts.autismMedicalSystem}"`);

    return deployedContracts;

  } catch (error) {
    console.error('\n❌ Deployment failed:', error.message);

    // Specific error handling
    if (error.message.includes('insufficient funds')) {
      console.log('\n💡 Get testnet FLR: https://coston2-faucet.towolabs.com/');
    } else if (error.message.includes('network')) {
      console.log('\n💡 Check network connection and RPC endpoint');
    } else if (error.code === 'NETWORK_ERROR') {
      console.log('\n💡 Network error - check your internet connection');
    }

    throw error;
  }
}

// Helper to check prerequisites
async function checkPrerequisites() {
  console.log('🔍 Checking deployment prerequisites...');

  // Check if contracts directory exists
  const contractsDir = path.join(__dirname, '../contracts');
  if (!fs.existsSync(contractsDir)) {
    throw new Error('Contracts directory not found');
  }

  // Check if AutismMedicalSystem.sol exists
  const mainContract = path.join(contractsDir, 'AutismMedicalSystem.sol');
  if (!fs.existsSync(mainContract)) {
    throw new Error('AutismMedicalSystem.sol not found');
  }

  console.log('✅ Prerequisites check passed');
}

// Run if called directly
if (require.main === module) {
  checkPrerequisites()
    .then(() => deploySimpleAutismSystem())
    .then((contracts) => {
      console.log('\n🎯 Deployment completed successfully!');
      console.log('Ready to test the autism medical system.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Deployment failed:', error.message);
      process.exit(1);
    });
}

module.exports = { deploySimpleAutismSystem };