const { Web3 } = require('web3');
const fs = require('fs');
require('dotenv').config();

async function testUserWallet() {
  const web3 = new Web3(process.env.RPC_COSTON2);
  const contractJson = JSON.parse(fs.readFileSync('./build/contracts/MedicalRecordVaultXRPL.json', 'utf8'));

  const contractAddress = process.env.VITE_VAULT_ADDRESS;
  const userAddress = '0x49a63AD0971D5E6e4036E3aA09f86eea592b0465';

  console.log('🔍 Testing wallet connectivity for user:', userAddress);
  console.log('📍 Contract address:', contractAddress);

  try {
    // Check user's balance
    const balance = await web3.eth.getBalance(userAddress);
    console.log('💰 User balance:', web3.utils.fromWei(balance, 'ether'), 'C2FLR');

    if (balance == 0) {
      console.log('⚠️  No balance! Get test funds from: https://coston2-faucet.towolabs.com/');
      console.log('💡 Use this address in the faucet:', userAddress);
    }

    // Test contract interaction
    const contract = new web3.eth.Contract(contractJson.abi, contractAddress);

    // Test basic contract calls
    const owner = await contract.methods.owner().call();
    console.log('✅ Contract owner:', owner);

    const uploadFeeWei = await contract.methods.uploadFeeWei().call();
    const uploadFeeUSDc = await contract.methods.uploadFeeUSDc().call();
    console.log('✅ Upload fee (FLR):', web3.utils.fromWei(uploadFeeWei.toString(), 'ether'));
    console.log('✅ Upload fee (USD cents):', uploadFeeUSDc.toString());

    // Test if user can read from contract (no transaction needed)
    const testPatientId = web3.utils.keccak256('TEST123salt456');
    console.log('📝 Test patient ID:', testPatientId);

    try {
      // This should work without any wallet connection issues
      const roles = await contract.methods.getRoles(testPatientId).call();
      console.log('✅ Contract read test successful');
      console.log('👥 Roles for test patient:', {
        guardian: roles[0],
        psychologist: roles[1],
        insurer: roles[2]
      });
    } catch (readError) {
      console.log('ℹ️  Contract read test (may be normal for empty patient):', readError.message);
    }

    // Estimate gas for a potential upload transaction
    try {
      const mockPatientId = testPatientId;
      const mockIPFSHash = 'ipfs://QmTest123...';

      // Estimate gas without actually sending transaction
      const gasEstimate = await contract.methods.uploadDocumentDeduct(
        mockPatientId,
        0, // diagnosis
        mockIPFSHash
      ).estimateGas({
        from: userAddress
      });

      console.log('⛽ Estimated gas for upload:', gasEstimate);

      // Calculate transaction cost
      const gasPrice = await web3.eth.getGasPrice();
      const txCost = web3.utils.fromWei((BigInt(gasEstimate) * BigInt(gasPrice)).toString(), 'ether');
      console.log('💸 Estimated transaction cost:', txCost, 'C2FLR');

    } catch (gasError) {
      console.log('ℹ️  Gas estimation (may fail without setup):', gasError.message);
    }

    console.log('\n🎯 Diagnosis:');
    if (balance > 0) {
      console.log('✅ Wallet has funds - ready for transactions');
      console.log('✅ Contract is accessible');
      console.log('🔧 Proxy error is likely a frontend/MetaMask connection issue');
      console.log('');
      console.log('💡 Try these steps:');
      console.log('1. Refresh the page completely (Ctrl+F5)');
      console.log('2. Disconnect wallet in MetaMask');
      console.log('3. Reconnect wallet in the app');
      console.log('4. Make sure you\'re on Coston2 testnet');
    } else {
      console.log('❌ Wallet needs test funds first');
      console.log('🔗 Get funds: https://coston2-faucet.towolabs.com/');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testUserWallet().catch(console.error);