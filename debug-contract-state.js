const { Web3 } = require('web3');
const fs = require('fs');
require('dotenv').config();

async function debugContractState() {
  console.log('🔍 Debugging SimpleMedicalVault state...');

  const web3 = new Web3(process.env.RPC_COSTON2);
  const vaultJson = JSON.parse(fs.readFileSync('./build/contracts/SimpleMedicalVault.json', 'utf8'));
  const contractInstance = new web3.eth.Contract(vaultJson.abi, process.env.VITE_VAULT_ADDRESS);

  console.log('Contract:', process.env.VITE_VAULT_ADDRESS);

  try {
    // Check basic contract state
    console.log('\n📋 Contract State:');

    const owner = await contractInstance.methods.owner().call();
    console.log('Owner:', owner);

    const uploadFee = await contractInstance.methods.uploadFeeUSDc().call();
    console.log('Upload fee (USD cents):', uploadFee);

    const maxStaleness = await contractInstance.methods.maxOracleStaleness().call();
    console.log('Max oracle staleness (seconds):', maxStaleness);

    // Check oracle addresses
    console.log('\n🔮 Oracle Configuration:');
    const fdcAddress = await contractInstance.methods.fdc().call();
    console.log('FDC address:', fdcAddress);

    const ftsoAddress = await contractInstance.methods.ftso().call();
    console.log('FTSO address:', ftsoAddress);

    // Test oracle functionality
    if (ftsoAddress !== '0x0000000000000000000000000000000000000000') {
      console.log('\n📊 Testing FTSO Oracle:');
      try {
        const ftsoJson = JSON.parse(fs.readFileSync('./build/contracts/MockFTSO.json', 'utf8'));
        const ftsoInstance = new web3.eth.Contract(ftsoJson.abi, ftsoAddress);

        const priceData = await ftsoInstance.methods.getXRPUSDPrice().call();
        console.log('XRP price:', priceData[0], 'with', priceData[1], 'decimals');
        console.log('Last updated:', new Date(Number(priceData[2]) * 1000).toISOString());

        // Check if price is stale
        const now = Math.floor(Date.now() / 1000);
        const priceAge = now - Number(priceData[2]);
        console.log('Price age (seconds):', priceAge);
        console.log('Is stale?', priceAge > Number(maxStaleness));

      } catch (ftsoError) {
        console.error('❌ FTSO error:', ftsoError.message);
      }
    } else {
      console.log('❌ FTSO not set');
    }

    // Test FDC
    if (fdcAddress !== '0x0000000000000000000000000000000000000000') {
      console.log('\n🔐 Testing FDC:');
      try {
        const fdcJson = JSON.parse(fs.readFileSync('./build/contracts/MockFDC.json', 'utf8'));
        const fdcInstance = new web3.eth.Contract(fdcJson.abi, fdcAddress);

        const testProof = web3.utils.asciiToHex('test-proof');
        const testStatement = web3.utils.keccak256('test-statement');

        const verifyResult = await fdcInstance.methods.verify(testProof, testStatement).call();
        console.log('FDC verify test:', verifyResult ? '✅ Pass' : '❌ Fail');

      } catch (fdcError) {
        console.error('❌ FDC error:', fdcError.message);
      }
    } else {
      console.log('❌ FDC not set');
    }

    // Test required drops calculation
    console.log('\n💰 Testing Required Drops:');
    try {
      const requiredInfo = await contractInstance.methods.requiredXrpDrops().call();
      console.log('Required drops:', requiredInfo.drops);
      console.log('Current price:', requiredInfo.price);
      console.log('Decimals:', requiredInfo.decimals);
      console.log('Timestamp:', new Date(Number(requiredInfo.timestamp) * 1000).toISOString());
    } catch (requiredError) {
      console.error('❌ Required drops error:', requiredError.message);
    }

    // Test upload simulation with minimal data
    console.log('\n🧪 Testing Upload Simulation:');
    const testMRN = 'TEST123';
    const testSalt = 'salt456';
    const patientId = web3.utils.keccak256(web3.utils.encodePacked(testMRN, testSalt));

    try {
      const mockProof = web3.utils.asciiToHex('test-proof-minimal');
      const statementId = web3.utils.keccak256('test-statement');
      const proofId = web3.utils.keccak256('test-proof-id');

      await contractInstance.methods.uploadDocumentXRP(
        patientId,
        0, // Diagnosis
        'ipfs://test',
        mockProof,
        statementId,
        proofId,
        5000000 // 5M drops
      ).call({ from: owner });

      console.log('✅ Upload simulation successful');
    } catch (uploadError) {
      console.error('❌ Upload simulation failed:', uploadError.message);

      // Check specific error conditions
      if (uploadError.message.includes('FDC not set')) {
        console.log('💡 Issue: FDC oracle not configured');
      } else if (uploadError.message.includes('FTSO not set')) {
        console.log('💡 Issue: FTSO oracle not configured');
      } else if (uploadError.message.includes('price stale')) {
        console.log('💡 Issue: Oracle price is stale');
      } else if (uploadError.message.includes('oracle price=0')) {
        console.log('💡 Issue: Oracle returning zero price');
      } else if (uploadError.message.includes('XRP payment too small')) {
        console.log('💡 Issue: Payment amount insufficient');
      } else {
        console.log('💡 Unknown upload error - check contract logic');
      }
    }

  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  }
}

debugContractState().catch(console.error);