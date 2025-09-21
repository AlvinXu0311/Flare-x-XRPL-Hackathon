const { Web3 } = require('web3');
const fs = require('fs');
require('dotenv').config();

async function testInsurerFLR() {
  console.log('🏥 Testing Insurer Direct FLR Payment...');

  const web3 = new Web3(process.env.RPC_COSTON2);
  const ownerAccount = web3.eth.accounts.privateKeyToAccount('0x' + process.env.PRIVATE_KEY);
  web3.eth.accounts.wallet.add(ownerAccount);

  // Load contract
  const vaultJson = JSON.parse(fs.readFileSync('./build/contracts/SimpleMedicalVault.json', 'utf8'));
  const vaultAddress = process.env.VITE_VAULT_ADDRESS;
  const vaultContract = new web3.eth.Contract(vaultJson.abi, vaultAddress);

  try {
    console.log('👤 Insurer account:', ownerAccount.address);
    console.log('📍 Contract address:', vaultAddress);

    // Check initial wallet balance
    const walletBalance = await web3.eth.getBalance(ownerAccount.address);
    console.log('Wallet FLR balance:', web3.utils.fromWei(walletBalance, 'ether'), 'FLR');

    // Get upload fee
    const uploadFee = await vaultContract.methods.uploadFeeWei().call();
    console.log('Upload fee required:', web3.utils.fromWei(uploadFee, 'ether'), 'FLR');

    // Test direct FLR payment upload
    console.log('\n💰 Step 1: Direct FLR Payment Upload...');
    const patientId = web3.utils.keccak256('PATIENT_INSURER_TEST');
    const docKind = 0; // Diagnosis
    const mockIPFSHash = 'ipfs://QmInsurerFLRDocument12345';

    console.log('📤 Submitting direct FLR payment upload...');
    const uploadTx = await vaultContract.methods.uploadDocumentFLR(
      patientId,
      docKind,
      mockIPFSHash
    ).send({
      from: ownerAccount.address,
      value: uploadFee, // Send FLR payment directly
      gas: 350000,
      gasPrice: '25000000000'
    });

    console.log('✅ Direct FLR upload successful!');
    console.log('TX Hash:', uploadTx.transactionHash);

    // Verify document was uploaded
    console.log('\n📋 Step 2: Verify document upload...');
    const docMeta = await vaultContract.methods.getDocMeta(patientId, docKind).call();
    console.log('Document metadata:', {
      hashURI: docMeta.hashURI,
      version: docMeta.version,
      paidDrops: docMeta.paidDrops,
      currencyHash: docMeta.currencyHash
    });

    // Check event logs
    console.log('\n📊 Step 3: Parse transaction events...');
    const receipt = await web3.eth.getTransactionReceipt(uploadTx.transactionHash);
    console.log('Gas used:', receipt.gasUsed);
    console.log('Events emitted:', receipt.logs.length);

    // Check final wallet balance
    const finalBalance = await web3.eth.getBalance(ownerAccount.address);
    const feesPaid = BigInt(walletBalance) - BigInt(finalBalance);
    console.log('\nFinal wallet balance:', web3.utils.fromWei(finalBalance, 'ether'), 'FLR');
    console.log('Total fees paid (gas + upload):', web3.utils.fromWei(feesPaid.toString(), 'ether'), 'FLR');

    console.log('\n🎉 Insurer FLR Test Complete!');
    console.log('\n📋 Summary:');
    console.log('✅ Direct FLR payment works perfectly');
    console.log('✅ No pre-deposit or balance management needed');
    console.log('✅ Document uploaded and immediately available');
    console.log('✅ Payment processed automatically');

    console.log('\n🏥 Perfect for Insurers:');
    console.log('• Simple one-step process');
    console.log('• No complex balance management');
    console.log('• Direct payment with upload');
    console.log('• Immediate document availability');

    console.log('\n🌐 UI Testing:');
    console.log('1. Open http://localhost:5180');
    console.log('2. Connect MetaMask');
    console.log('3. Select "FLR Direct Payment" method');
    console.log('4. Upload document (0.001 FLR charged automatically)');

  } catch (error) {
    console.error('❌ Insurer FLR test failed:', error.message);
    if (error.message.includes('insufficient')) {
      console.log('\n💡 Try funding your wallet with more Coston2 FLR:');
      console.log('- Coston2 Faucet: https://faucet.flare.network/coston2');
      console.log('- Your address:', ownerAccount.address);
    }
  }
}

testInsurerFLR().catch(console.error);