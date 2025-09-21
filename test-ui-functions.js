const { Web3 } = require('web3');
const fs = require('fs');
require('dotenv').config();

async function testUIFunctions() {
  console.log('🧪 Testing UI Function Access...');

  const web3 = new Web3(process.env.RPC_COSTON2);
  const ownerAccount = web3.eth.accounts.privateKeyToAccount('0x' + process.env.PRIVATE_KEY);
  web3.eth.accounts.wallet.add(ownerAccount);

  // Load contract from UI assets
  const vaultJson = JSON.parse(fs.readFileSync('./medical-vault-ui/src/assets/SimpleMedicalVault.json', 'utf8'));
  const vaultAddress = process.env.VITE_VAULT_ADDRESS;
  const vaultContract = new web3.eth.Contract(vaultJson.abi, vaultAddress);

  try {
    console.log('📍 Testing contract at:', vaultAddress);
    console.log('📋 Available functions in ABI:');

    // List all functions from ABI
    const functions = vaultJson.abi.filter(item => item.type === 'function').map(item => item.name);
    console.log(functions.sort());

    // Test XRPL function
    console.log('\n🔴 Testing requiredXrpDrops():');
    try {
      const result = await vaultContract.methods.requiredXrpDrops().call();
      console.log('✅ requiredXrpDrops() works:', {
        drops: result[0].toString(),
        price: result[1].toString(),
        decimals: result[2].toString(),
        timestamp: result[3].toString()
      });
    } catch (error) {
      console.log('❌ requiredXrpDrops() failed:', error.message);
    }

    // Test FLR function
    console.log('\n🟢 Testing uploadFeeWei():');
    try {
      const result = await vaultContract.methods.uploadFeeWei().call();
      console.log('✅ uploadFeeWei() works:', web3.utils.fromWei(result, 'ether'), 'FLR');
    } catch (error) {
      console.log('❌ uploadFeeWei() failed:', error.message);
    }

    // Test contract deployment status
    console.log('\n📡 Testing contract status:');
    const owner = await vaultContract.methods.owner().call();
    console.log('Contract owner:', owner);

    const fdc = await vaultContract.methods.fdc().call();
    console.log('FDC address:', fdc);

    const ftso = await vaultContract.methods.ftso().call();
    console.log('FTSO address:', ftso);

  } catch (error) {
    console.error('❌ UI function test failed:', error.message);
  }
}

testUIFunctions().catch(console.error);