const { ethers } = require('hardhat');

async function main() {
  console.log('🚀 Deploying Simple Autism Medical System...');

  const [deployer] = await ethers.getSigners();
  console.log('Deployer:', deployer.address);

  const balance = await deployer.provider.getBalance(deployer.address);
  console.log('Balance:', ethers.formatEther(balance), 'FLR');

  const AutismMedicalSystemSimple = await ethers.getContractFactory('AutismMedicalSystemSimple');
  const autismSystem = await AutismMedicalSystemSimple.deploy();
  await autismSystem.waitForDeployment();

  const address = await autismSystem.getAddress();
  console.log('✅ AutismMedicalSystemSimple deployed to:', address);

  // Test basic functionality
  console.log('\n🔍 Testing basic functionality...');

  try {
    // Test getting evaluation types
    const types = await autismSystem.getEvaluationTypes();
    console.log('✅ Evaluation types:', types);

    // Test role granting
    const HOSPITAL_ROLE = ethers.keccak256(ethers.toUtf8Bytes('HOSPITAL_ROLE'));
    await autismSystem.grantRole(HOSPITAL_ROLE, deployer.address);
    console.log('✅ Hospital role granted');

    // Test adding insurance
    await autismSystem.addVerifiedInsurance('Test Insurance');
    console.log('✅ Insurance provider added');

    console.log('\n🎉 Deployment and basic testing successful!');
    console.log('Contract address:', address);

  } catch (error) {
    console.error('❌ Testing failed:', error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });