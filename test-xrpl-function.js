const { Web3 } = require('web3');
const fs = require('fs');
require('dotenv').config();

async function testXRPLFunction() {
  const web3 = new Web3(process.env.RPC_COSTON2);
  const contractJson = JSON.parse(fs.readFileSync('./build/contracts/MedicalRecordVaultXRPL.json', 'utf8'));

  const contractAddress = process.env.VITE_VAULT_ADDRESS;
  console.log('Testing XRPL functions on contract:', contractAddress);

  const contract = new web3.eth.Contract(contractJson.abi, contractAddress);

  try {
    // Check if XRPL upload function exists
    const methods = contract.methods;
    const hasXRPLFunction = typeof methods.uploadDocumentWithXRPLAnyCurrency === 'function';

    console.log('✅ Contract ABI loaded successfully');
    console.log('📋 Available methods:');

    const methodNames = Object.keys(methods).filter(name =>
      name.includes('upload') || name.includes('XRPL') || name.includes('Document')
    );

    methodNames.forEach(method => {
      console.log(`  - ${method}`);
    });

    console.log('\n🔍 XRPL Function Check:');
    console.log('uploadDocumentWithXRPLAnyCurrency exists:', hasXRPLFunction);

    if (hasXRPLFunction) {
      console.log('✅ XRPL upload function is available!');
    } else {
      console.log('❌ XRPL upload function not found in contract');
      console.log('📝 Available upload methods:');
      Object.keys(methods).filter(name => name.includes('upload')).forEach(method => {
        console.log(`  - ${method}`);
      });
    }

    // Test uploadFeeUSDc
    try {
      const feeUSDc = await contract.methods.uploadFeeUSDc().call();
      console.log('✅ Upload fee (USD cents):', feeUSDc);
    } catch (err) {
      console.log('ℹ️ uploadFeeUSDc not available (older contract version)');
    }

    return hasXRPLFunction;

  } catch (error) {
    console.error('❌ Contract test failed:', error.message);
    return false;
  }
}

testXRPLFunction().then(hasXRPL => {
  if (hasXRPL) {
    console.log('\n🎉 Ready for XRPL testing!');
  } else {
    console.log('\n⚠️ Contract may not support XRPL uploads. Use FLR deduct method instead.');
  }
}).catch(console.error);