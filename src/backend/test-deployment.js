const HardhatDeployer = require('./utils/hardhatDeployer');

async function testDeployment() {
  try {
    console.log('🧪 Testing contract deployment...');

    const deployer = new HardhatDeployer();
    const privateKey = '66b8d15eea4d643a0307943b3ea8665bef496f4cc5248bc5649c1751d65e1ede';

    console.log('📋 Using test private key: 66b8d15...1751d65e1ede');

    const result = await deployer.deployContract(privateKey);

    console.log('✅ Deployment test completed');
    console.log('📄 Result:', JSON.stringify(result, null, 2));

  } catch (error) {
    console.error('❌ Deployment test failed:', error.message);
    console.error('📋 Full error:', error);
  }
}

testDeployment();