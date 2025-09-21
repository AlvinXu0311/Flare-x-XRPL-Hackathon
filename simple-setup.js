const { Web3 } = require('web3');
const fs = require('fs');
require('dotenv').config();

async function simpleSetup() {
  const web3 = new Web3(process.env.RPC_COSTON2);
  const contractJson = JSON.parse(fs.readFileSync('./build/contracts/MedicalRecordVaultXRPL.json', 'utf8'));

  // Contract owner account
  const ownerAccount = web3.eth.accounts.privateKeyToAccount('0x' + process.env.PRIVATE_KEY);
  web3.eth.accounts.wallet.add(ownerAccount);

  const contractInstance = new web3.eth.Contract(contractJson.abi, process.env.VITE_VAULT_ADDRESS);

  console.log('Contract address:', process.env.VITE_VAULT_ADDRESS);
  console.log('Owner address:', ownerAccount.address);

  const userAddress = '0x49a63AD0971D5E6e4036E3aA09f86eea592b0465';
  const testMRN = 'TEST123';
  const testSalt = 'salt456';
  const patientId = web3.utils.keccak256(web3.utils.encodePacked(testMRN, testSalt));

  try {
    console.log('\\n1. Checking upload fee...');
    const uploadFee = await contractInstance.methods.uploadFeeWei().call();
    console.log('Upload fee:', web3.utils.fromWei(uploadFee, 'ether'), 'FLR');

    console.log('\\n2. Setting insurer for patient...');
    const setInsurerTx = await contractInstance.methods.setInsurer(patientId, userAddress).send({
      from: ownerAccount.address,
      gas: 200000,
      gasPrice: '25000000000'
    });
    console.log('✅ Insurer set! TX:', setInsurerTx.transactionHash);

    console.log('\\n3. Depositing FLR for uploads...');
    const depositAmount = BigInt(uploadFee) * BigInt(20); // 20x the fee

    const depositTx = await contractInstance.methods.depositFor(patientId).send({
      from: ownerAccount.address,
      value: depositAmount.toString(),
      gas: 200000,
      gasPrice: '25000000000'
    });
    console.log('✅ FLR deposited! TX:', depositTx.transactionHash);
    console.log('Deposited amount:', web3.utils.fromWei(depositAmount, 'ether'), 'FLR');

    console.log('\\n✅ Setup complete!');
    console.log('\\n🎯 Use these values in UI:');
    console.log('- MRN: TEST123');
    console.log('- Salt: salt456');
    console.log('- Payment: FLR Deduct');
    console.log('- The user can now register as patient during upload');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

simpleSetup().catch(console.error);