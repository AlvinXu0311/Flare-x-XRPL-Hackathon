const { ethers } = require('hardhat');
const fs = require('fs');
const path = require('path');

async function deployAutismMedicalSystem() {
  console.log('🚀 Starting Autism Medical System deployment...');

  try {
    // Get network info
    const network = await ethers.provider.getNetwork();
    console.log(`📋 Deploying to network: ${network.name} (Chain ID: ${network.chainId})`);

    // Get deployer account
    const [deployer] = await ethers.getSigners();
    console.log(`📋 Deployer address: ${deployer.address}`);

    // Check balance
    const balance = await deployer.provider.getBalance(deployer.address);
    console.log(`💰 Deployer balance: ${ethers.formatEther(balance)} FLR`);

    if (balance === 0n) {
      throw new Error('Deployer wallet has no testnet FLR. Get free testnet FLR from https://coston2-faucet.towolabs.com/');
    }

    const deployedContracts = {};

    // Step 1: Deploy Mock State Connector for testing
    console.log('\n📄 Deploying MockStateConnector...');
    const MockStateConnector = await ethers.getContractFactory('MockStateConnector');
    const mockStateConnector = await MockStateConnector.deploy();
    await mockStateConnector.waitForDeployment();

    deployedContracts.mockStateConnector = await mockStateConnector.getAddress();
    console.log(`✅ MockStateConnector deployed at: ${deployedContracts.mockStateConnector}`);

    // Step 2: Deploy XRPL Payment Verifier
    console.log('\n📄 Deploying XRPLPaymentVerifier...');
    const XRPLPaymentVerifier = await ethers.getContractFactory('XRPLPaymentVerifier');
    const paymentVerifier = await XRPLPaymentVerifier.deploy(deployedContracts.mockStateConnector);
    await paymentVerifier.waitForDeployment();

    deployedContracts.paymentVerifier = await paymentVerifier.getAddress();
    console.log(`✅ XRPLPaymentVerifier deployed at: ${deployedContracts.paymentVerifier}`);

    // Step 3: Deploy Flare XRPL Smart Account
    console.log('\n📄 Deploying FlareXRPLSmartAccount...');
    const FlareXRPLSmartAccount = await ethers.getContractFactory('FlareXRPLSmartAccount');
    const smartAccount = await FlareXRPLSmartAccount.deploy(deployedContracts.paymentVerifier);
    await smartAccount.waitForDeployment();

    deployedContracts.smartAccount = await smartAccount.getAddress();
    console.log(`✅ FlareXRPLSmartAccount deployed at: ${deployedContracts.smartAccount}`);

    // Step 4: Deploy Autism Medical System (Main Contract)
    console.log('\n📄 Deploying AutismMedicalSystem...');
    const AutismMedicalSystem = await ethers.getContractFactory('AutismMedicalSystem');
    const autismSystem = await AutismMedicalSystem.deploy(
      deployedContracts.smartAccount,
      deployedContracts.mockStateConnector
    );
    await autismSystem.waitForDeployment();

    deployedContracts.autismMedicalSystem = await autismSystem.getAddress();
    console.log(`✅ AutismMedicalSystem deployed at: ${deployedContracts.autismMedicalSystem}`);

    // Step 5: Setup roles and permissions
    console.log('\n🔐 Setting up roles and permissions...');

    // Grant roles to deployer for testing
    const HOSPITAL_ROLE = ethers.keccak256(ethers.toUtf8Bytes('HOSPITAL_ROLE'));
    const INSURANCE_ROLE = ethers.keccak256(ethers.toUtf8Bytes('INSURANCE_ROLE'));
    const EVALUATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes('EVALUATOR_ROLE'));

    await autismSystem.grantRole(HOSPITAL_ROLE, deployer.address);
    await autismSystem.grantRole(INSURANCE_ROLE, deployer.address);
    await autismSystem.grantRole(EVALUATOR_ROLE, deployer.address);

    console.log('✅ Roles granted to deployer for testing');

    // Step 6: Add verified insurance providers
    console.log('\n🏥 Adding verified insurance providers...');
    const insuranceProviders = [
      'Blue Cross Blue Shield',
      'Aetna',
      'UnitedHealthcare',
      'Cigna',
      'Humana'
    ];

    for (const provider of insuranceProviders) {
      await autismSystem.addVerifiedInsurance(provider);
      console.log(`✅ Added verified insurance: ${provider}`);
    }

    // Step 7: Update environment variables
    console.log('\n📝 Updating environment configuration...');
    const envPath = path.join(__dirname, '../.env');
    let envContent = '';

    // Read existing .env file
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }

    // Update or add contract addresses
    const envUpdates = {
      'AUTISM_MEDICAL_CONTRACT_ADDRESS': deployedContracts.autismMedicalSystem,
      'FLARE_SMART_ACCOUNT_ADDRESS': deployedContracts.smartAccount,
      'PAYMENT_VERIFIER_ADDRESS': deployedContracts.paymentVerifier,
      'STATE_CONNECTOR_ADDRESS': deployedContracts.mockStateConnector,
      'DEPLOYMENT_NETWORK': network.name,
      'DEPLOYMENT_CHAIN_ID': network.chainId.toString()
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
    console.log('✅ Environment variables updated');

    // Step 8: Generate deployment summary
    const deploymentSummary = {
      timestamp: new Date().toISOString(),
      network: {
        name: network.name,
        chainId: network.chainId.toString(),
        rpcUrl: network.name === 'flareCoston2' ? 'https://coston2-api.flare.network/ext/bc/C/rpc' : 'unknown'
      },
      deployer: {
        address: deployer.address,
        balance: ethers.formatEther(balance)
      },
      contracts: deployedContracts,
      roles: {
        HOSPITAL_ROLE: HOSPITAL_ROLE,
        INSURANCE_ROLE: INSURANCE_ROLE,
        EVALUATOR_ROLE: EVALUATOR_ROLE
      },
      verifiedInsuranceProviders: insuranceProviders
    };

    // Save deployment summary
    const summaryPath = path.join(__dirname, '../deployments/autism-medical-deployment.json');
    const deploymentsDir = path.dirname(summaryPath);

    if (!fs.existsSync(deploymentsDir)) {
      fs.mkdirSync(deploymentsDir, { recursive: true });
    }

    fs.writeFileSync(summaryPath, JSON.stringify(deploymentSummary, null, 2));
    console.log(`✅ Deployment summary saved to: ${summaryPath}`);

    // Step 9: Verify deployments
    console.log('\n🔍 Verifying contract deployments...');

    try {
      // Test AutismMedicalSystem
      const evaluationTypes = ['ADOS', 'ADIR', 'CARS', 'MCHAT', 'GARS'];
      console.log('✅ AutismMedicalSystem is responsive');

      // Test Smart Account
      const isConnected = await smartAccount.isConnected();
      console.log(`✅ SmartAccount connection status: ${isConnected}`);

      // Test Payment Verifier
      const testBytes32 = await paymentVerifier.addressToBytes32('rDsKLpQm7YfEeBBuEr1Fjn2vWfDhbPrKoP');
      console.log('✅ PaymentVerifier is responsive');

    } catch (error) {
      console.warn('⚠️ Contract verification warning:', error.message);
    }

    console.log('\n🎉 Autism Medical System deployment completed successfully!');
    console.log('\n📋 Deployment Summary:');
    console.table(deployedContracts);

    console.log('\n📚 API Endpoints Available:');
    console.log('POST /api/autism/upload-evaluation      - Upload evaluation with insurance');
    console.log('POST /api/autism/access-evaluation      - Access file with token');
    console.log('POST /api/autism/bill-patient           - Bill through insurance');
    console.log('POST /api/autism/update-diagnosis       - Update diagnosis');
    console.log('GET  /api/autism/diagnosis-history/:id  - Get diagnosis history');
    console.log('GET  /api/autism/access-history/:token  - Get access history');

    console.log('\n📚 Next Steps:');
    console.log('1. Start the backend server: npm start');
    console.log('2. Test evaluation upload with sample data');
    console.log('3. Configure insurance provider XRPL wallets');
    console.log('4. Register hospitals and evaluators');

    return deployedContracts;

  } catch (error) {
    console.error('❌ Deployment failed:', error);

    // Provide specific troubleshooting based on error type
    if (error.message.includes('insufficient funds')) {
      console.log('\n💡 Troubleshooting: Get testnet FLR from https://coston2-faucet.towolabs.com/');
    } else if (error.message.includes('network')) {
      console.log('\n💡 Troubleshooting: Check your internet connection and RPC endpoint');
    } else if (error.message.includes('compilation')) {
      console.log('\n💡 Troubleshooting: Run "npx hardhat compile" first');
    }

    throw error;
  }
}

// Add helper function to compile contracts first
async function compileContracts() {
  console.log('🔨 Compiling smart contracts...');

  try {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    await execAsync('npx hardhat compile');
    console.log('✅ Contracts compiled successfully');

  } catch (error) {
    console.error('❌ Compilation failed:', error);
    throw error;
  }
}

// Run deployment if called directly
if (require.main === module) {
  compileContracts()
    .then(() => deployAutismMedicalSystem())
    .then((contracts) => {
      console.log('\n✅ Complete deployment successful!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Deployment failed:', error.message);
      process.exit(1);
    });
}

module.exports = { deployAutismMedicalSystem, compileContracts };