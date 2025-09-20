const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

async function deployV2Contracts() {
  console.log('🚀 Starting deployment of V2 contracts...');

  // Configuration
  const rpcUrl = process.env.FLARE_RPC_URL || 'https://coston2-api.flare.network/ext/C/rpc';
  const privateKey = process.env.FLARE_PRIVATE_KEY;
  const platformWallet = process.env.PLATFORM_WALLET_ADDRESS;
  const xrplDestination = process.env.PLATFORM_WALLET_ADDRESS; // Same for now

  if (!privateKey) {
    throw new Error('FLARE_PRIVATE_KEY environment variable is required');
  }

  if (!platformWallet) {
    throw new Error('PLATFORM_WALLET_ADDRESS environment variable is required');
  }

  // Initialize provider and signer
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const signer = new ethers.Wallet(privateKey, provider);

  console.log(`📋 Deployer address: ${signer.address}`);

  // Check balance
  const balance = await provider.getBalance(signer.address);
  console.log(`💰 Deployer balance: ${ethers.formatEther(balance)} FLR`);

  if (balance === 0n) {
    throw new Error('Deployer wallet has no testnet FLR. Get free testnet FLR from https://coston2-faucet.towolabs.com/');
  }

  const deployedContracts = {};

  try {
    // 1. Deploy Mock State Connector (for testing)
    console.log('\n📄 Deploying MockStateConnector...');
    const MockStateConnectorFactory = await ethers.getContractFactory('MockStateConnector', signer);
    const mockStateConnector = await MockStateConnectorFactory.deploy();
    await mockStateConnector.waitForDeployment();

    deployedContracts.mockStateConnector = await mockStateConnector.getAddress();
    console.log(`✅ MockStateConnector deployed at: ${deployedContracts.mockStateConnector}`);

    // 2. Deploy XRPL Payment Verifier
    console.log('\n📄 Deploying XRPLPaymentVerifier...');
    const XRPLPaymentVerifierFactory = await ethers.getContractFactory('XRPLPaymentVerifier', signer);
    const paymentVerifier = await XRPLPaymentVerifierFactory.deploy(deployedContracts.mockStateConnector);
    await paymentVerifier.waitForDeployment();

    deployedContracts.paymentVerifier = await paymentVerifier.getAddress();
    console.log(`✅ XRPLPaymentVerifier deployed at: ${deployedContracts.paymentVerifier}`);

    // 3. Deploy MedicalRecordTokenV2
    console.log('\n📄 Deploying MedicalRecordTokenV2...');
    const MedicalRecordTokenV2Factory = await ethers.getContractFactory('MedicalRecordTokenV2', signer);
    const medicalTokenV2 = await MedicalRecordTokenV2Factory.deploy(
      signer.address, // initialOwner
      deployedContracts.mockStateConnector, // stateConnector
      platformWallet, // platformWallet
      xrplDestination // xrplDestinationAddress
    );
    await medicalTokenV2.waitForDeployment();

    deployedContracts.medicalTokenV2 = await medicalTokenV2.getAddress();
    console.log(`✅ MedicalRecordTokenV2 deployed at: ${deployedContracts.medicalTokenV2}`);

    // 4. Deploy Medical Registry
    console.log('\n📄 Deploying MedicalRegistry...');
    const MedicalRegistryFactory = await ethers.getContractFactory('MedicalRegistry', signer);
    const medicalRegistry = await MedicalRegistryFactory.deploy(
      deployedContracts.medicalTokenV2, // medicalToken
      deployedContracts.paymentVerifier, // paymentVerifier
      platformWallet, // platformWallet
      signer.address // initialOwner
    );
    await medicalRegistry.waitForDeployment();

    deployedContracts.medicalRegistry = await medicalRegistry.getAddress();
    console.log(`✅ MedicalRegistry deployed at: ${deployedContracts.medicalRegistry}`);

    // 5. Update environment configuration
    console.log('\n📝 Updating environment configuration...');
    const envPath = path.join(__dirname, '../.env');
    let envContent = '';

    // Read existing .env file
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }

    // Update or add V2 contract addresses
    const envUpdates = {
      'MEDICAL_TOKEN_V2_ADDRESS': deployedContracts.medicalTokenV2,
      'MEDICAL_REGISTRY_ADDRESS': deployedContracts.medicalRegistry,
      'PAYMENT_VERIFIER_ADDRESS': deployedContracts.paymentVerifier,
      'STATE_CONNECTOR_ADDRESS': deployedContracts.mockStateConnector
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

    // 6. Generate deployment summary
    const deploymentSummary = {
      timestamp: new Date().toISOString(),
      network: 'Flare Coston2 Testnet',
      rpcUrl,
      deployerAddress: signer.address,
      deployerBalance: ethers.formatEther(balance),
      contracts: deployedContracts,
      configuration: {
        platformWallet,
        xrplDestination
      }
    };

    // Save deployment summary
    const summaryPath = path.join(__dirname, '../deployments/v2-deployment.json');
    const deploymentsDir = path.dirname(summaryPath);

    if (!fs.existsSync(deploymentsDir)) {
      fs.mkdirSync(deploymentsDir, { recursive: true });
    }

    fs.writeFileSync(summaryPath, JSON.stringify(deploymentSummary, null, 2));
    console.log(`✅ Deployment summary saved to: ${summaryPath}`);

    // 7. Verify contract interactions
    console.log('\n🔍 Verifying contract interactions...');

    try {
      // Test MedicalTokenV2
      const networkInfo = await medicalTokenV2.getNetworkInfo();
      console.log('✅ MedicalTokenV2 is responsive');

      // Test Registry
      const totalEvaluations = await medicalRegistry.getTotalListedEvaluations();
      console.log(`✅ Registry responsive - Total evaluations: ${totalEvaluations}`);

      // Test Payment Verifier
      const testAddress = await paymentVerifier.addressToBytes32('rDsKLpQm7YfEeBBuEr1Fjn2vWfDhbPrKoP');
      console.log('✅ Payment Verifier responsive');

    } catch (error) {
      console.warn('⚠️ Contract verification warning:', error.message);
    }

    console.log('\n🎉 V2 Contracts deployment completed successfully!');
    console.log('\n📋 Deployment Summary:');
    console.table(deployedContracts);

    console.log('\n📚 Next Steps:');
    console.log('1. Update your application to use the new contract addresses');
    console.log('2. Test the enhanced functionality with on-chain verification');
    console.log('3. Register hospitals using the new registry system');
    console.log('4. Test trustless access purchase flow');

    return deployedContracts;

  } catch (error) {
    console.error('❌ Deployment failed:', error);
    throw error;
  }
}

// Run deployment if called directly
if (require.main === module) {
  deployV2Contracts()
    .then((contracts) => {
      console.log('\n✅ Deployment successful!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Deployment failed:', error);
      process.exit(1);
    });
}

module.exports = { deployV2Contracts };