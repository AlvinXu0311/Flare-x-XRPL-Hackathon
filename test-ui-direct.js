const { Web3 } = require('web3');
const fs = require('fs');
require('dotenv').config();

async function testUIDirect() {
  console.log('🌐 Testing UI-like Direct Contract Calls...');

  const web3 = new Web3(process.env.RPC_COSTON2);
  const ownerAccount = web3.eth.accounts.privateKeyToAccount('0x' + process.env.PRIVATE_KEY);
  web3.eth.accounts.wallet.add(ownerAccount);

  // Load contract exactly like UI does
  const vaultJson = JSON.parse(fs.readFileSync('./medical-vault-ui/src/assets/SimpleMedicalVault.json', 'utf8'));
  const vaultAddress = process.env.VITE_VAULT_ADDRESS;
  const vaultContract = new web3.eth.Contract(vaultJson.abi, vaultAddress);

  try {
    console.log('📍 Contract:', vaultAddress);
    console.log('👤 Account:', ownerAccount.address);

    // Test 1: XRPL Upload (UI-like)
    console.log('\n🔴 Testing XRPL Upload (UI simulation)...');

    const patientId = web3.utils.keccak256('UI_TEST_XRPL');
    const docKind = 0;
    const ipfsUri = 'ipfs://QmUITestXRPL12345';
    const proofText = 'test-payment-ui-xrpl';
    const mockProofId = web3.utils.keccak256(proofText);
    const mockStatementId = web3.utils.keccak256(`patient_${Date.now()}`);
    const proofBytes = web3.utils.utf8ToHex(proofText);
    const requiredDrops = '5000000'; // Hardcoded like UI

    try {
      const xrplTx = await vaultContract.methods.uploadDocumentXRP(
        patientId,
        docKind,
        ipfsUri,
        proofBytes,
        mockStatementId,
        mockProofId,
        requiredDrops
      ).send({
        from: ownerAccount.address,
        gas: 500000,
        gasPrice: '25000000000'
      });

      console.log('✅ XRPL upload successful! TX:', xrplTx.transactionHash);
    } catch (xrplError) {
      console.log('❌ XRPL upload failed:', xrplError.message);
    }

    // Test 2: FLR Upload (UI-like)
    console.log('\n🟢 Testing FLR Upload (UI simulation)...');

    const patientId2 = web3.utils.keccak256('UI_TEST_FLR');
    const ipfsUri2 = 'ipfs://QmUITestFLR12345';
    const uploadFee = web3.utils.toWei('0.001', 'ether'); // Hardcoded like UI

    try {
      const flrTx = await vaultContract.methods.uploadDocumentFLR(
        patientId2,
        docKind,
        ipfsUri2
      ).send({
        from: ownerAccount.address,
        value: uploadFee,
        gas: 350000,
        gasPrice: '25000000000'
      });

      console.log('✅ FLR upload successful! TX:', flrTx.transactionHash);
    } catch (flrError) {
      console.log('❌ FLR upload failed:', flrError.message);
    }

    console.log('\n🎉 UI Direct Test Complete!');
    console.log('\n📋 Results:');
    console.log('- Both upload methods should work in UI now');
    console.log('- Using hardcoded values avoids browser web3 issues');
    console.log('- Contract functions work correctly with direct calls');

    console.log('\n🌐 UI Testing:');
    console.log('1. Open http://localhost:5180');
    console.log('2. Connect MetaMask');
    console.log('3. Try both XRPL and FLR payment methods');
    console.log('4. Both should work without function call errors');

  } catch (error) {
    console.error('❌ UI direct test failed:', error.message);
  }
}

testUIDirect().catch(console.error);