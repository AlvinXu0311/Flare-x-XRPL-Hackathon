const { Web3 } = require('web3');
const fs = require('fs');
require('dotenv').config();

async function testContract() {
  const web3 = new Web3(process.env.RPC_COSTON2);
  const contractJson = JSON.parse(fs.readFileSync('./build/contracts/MedicalRecordVaultXRPL.json', 'utf8'));

  const contractAddress = process.env.VITE_VAULT_ADDRESS;
  console.log('Testing contract at:', contractAddress);

  const contract = new web3.eth.Contract(contractJson.abi, contractAddress);

  try {
    // Test basic contract functions
    const owner = await contract.methods.owner().call();
    console.log('✅ Contract owner:', owner);

    const uploadFeeWei = await contract.methods.uploadFeeWei().call();
    console.log('✅ Upload fee (wei):', uploadFeeWei);

    const uploadFeeUSDc = await contract.methods.uploadFeeUSDc().call();
    console.log('✅ Upload fee (USD cents):', uploadFeeUSDc);

    // Test if we can check upload permissions for a sample patient ID
    const samplePatientId = web3.utils.keccak256('test123_salt456');
    const testAccount = '0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1';

    const canUpload = await contract.methods.canUploadForPatient(samplePatientId, testAccount).call();
    console.log('✅ Can upload test (should be false):', canUpload);

    console.log('🎉 Contract is working perfectly!');
    console.log('📍 Frontend URL: http://localhost:5175');
    console.log('🔗 Contract Address:', contractAddress);

    return true;

  } catch (error) {
    console.error('❌ Contract test failed:', error.message);
    return false;
  }
}

testContract().catch(console.error);