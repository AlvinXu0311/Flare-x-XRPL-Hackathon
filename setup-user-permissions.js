const { Web3 } = require('web3');
const fs = require('fs');
require('dotenv').config();

/**
 * Setup user permissions and FLR balance for Medical Vault uploads
 */

async function setupUserPermissions() {
  const web3 = new Web3(process.env.RPC_COSTON2);

  // Load the contract
  const contractJson = JSON.parse(fs.readFileSync('./build/contracts/MedicalRecordVaultXRPL.json', 'utf8'));

  // Create account from private key (contract owner)
  const ownerAccount = web3.eth.accounts.privateKeyToAccount('0x' + process.env.PRIVATE_KEY);
  web3.eth.accounts.wallet.add(ownerAccount);

  console.log('Setting up user permissions for contract:', process.env.VITE_VAULT_ADDRESS);
  console.log('Contract owner:', ownerAccount.address);

  // Get user's MetaMask address (you'll need to replace this with actual user address)
  const USER_ADDRESS = '0x49a63AD0971D5E6e4036E3aA09f86eea592b0465'; // Replace with your MetaMask address
  console.log('Setting up for user:', USER_ADDRESS);

  try {
    const contractInstance = new web3.eth.Contract(contractJson.abi, process.env.VITE_VAULT_ADDRESS);

    // Example patient ID (hash of MRN + salt)
    const testMRN = 'TEST123';
    const testSalt = 'salt456';
    const patientId = web3.utils.keccak256(web3.utils.encodePacked(testMRN, testSalt));

    console.log('\\n📋 Test Patient Setup:');
    console.log('MRN:', testMRN);
    console.log('Salt:', testSalt);
    console.log('Patient ID:', patientId);

    // 1. Register user as patient (allows them to upload)
    console.log('\\n1. Registering user as patient...');

    const registerTx = await contractInstance.methods.registerAsPatient(patientId).send({
      from: ownerAccount.address,
      gas: 200000,
      gasPrice: '25000000000' // 25 gwei
    });

    console.log('✅ User registered as patient!');
    console.log('Transaction hash:', registerTx.transactionHash);

    // 2. Set user as insurer for this patient (for FLR deduct)
    console.log('\\n2. Setting user as insurer...');

    const setInsurerTx = await contractInstance.methods.setInsurer(patientId, USER_ADDRESS).send({
      from: ownerAccount.address,
      gas: 150000,
      gasPrice: '25000000000'
    });

    console.log('✅ User set as insurer!');
    console.log('Transaction hash:', setInsurerTx.transactionHash);

    // 3. Deposit FLR for upload fees
    console.log('\\n3. Depositing FLR for upload fees...');

    const uploadFee = await contractInstance.methods.uploadFeeWei().call();
    const depositAmount = web3.utils.toBN(uploadFee).mul(web3.utils.toBN('10')); // 10x the fee

    console.log('Upload fee:', web3.utils.fromWei(uploadFee, 'ether'), 'FLR');
    console.log('Depositing:', web3.utils.fromWei(depositAmount, 'ether'), 'FLR');

    const depositTx = await contractInstance.methods.depositFor(patientId).send({
      from: ownerAccount.address,
      value: depositAmount.toString(),
      gas: 200000,
      gasPrice: '25000000000'
    });

    console.log('✅ FLR deposited for uploads!');
    console.log('Transaction hash:', depositTx.transactionHash);

    // 4. Verify setup
    console.log('\\n📋 Setup Verification:');

    const canUpload = await contractInstance.methods.canUploadForPatient(patientId, USER_ADDRESS).call();
    const insurerAddress = await contractInstance.methods.insurerOf(patientId).call();
    const insurerBalance = await contractInstance.methods.insurerBalances(USER_ADDRESS).call();

    console.log('Can upload:', canUpload);
    console.log('Insurer address:', insurerAddress);
    console.log('Insurer balance:', web3.utils.fromWei(insurerBalance, 'ether'), 'FLR');

    console.log('\\n✅ User setup complete!');
    console.log('User can now upload documents using FLR deduct method');
    console.log('\\n🎯 Test with these values in UI:');
    console.log('- MRN:', testMRN);
    console.log('- Salt:', testSalt);
    console.log('- Payment Method: FLR Deduct');

  } catch (error) {
    console.error('❌ Setup failed:', error.message);

    if (error.message.includes('not owner')) {
      console.log('💡 Make sure you are the contract owner.');
    }

    if (error.message.includes('insufficient funds')) {
      console.log('💡 Get test funds from: https://coston2-faucet.towolabs.com/');
    }
  }
}

setupUserPermissions().catch(console.error);