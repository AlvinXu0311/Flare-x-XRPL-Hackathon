const { Web3 } = require('web3');
const fs = require('fs');
require('dotenv').config();

async function setupComplete() {
  const web3 = new Web3(process.env.RPC_COSTON2);
  const contractJson = JSON.parse(fs.readFileSync('./build/contracts/MedicalRecordVaultXRPL.json', 'utf8'));

  // Contract owner account
  const ownerAccount = web3.eth.accounts.privateKeyToAccount('0x' + process.env.PRIVATE_KEY);
  web3.eth.accounts.wallet.add(ownerAccount);

  const contractInstance = new web3.eth.Contract(contractJson.abi, process.env.VITE_VAULT_ADDRESS);

  console.log('🔧 Complete setup for Medical Vault uploads');
  console.log('Contract:', process.env.VITE_VAULT_ADDRESS);
  console.log('Owner:', ownerAccount.address);

  const userAddress = '0x49a63AD0971D5E6e4036E3aA09f86eea592b0465'; // Your MetaMask address
  const testMRN = 'TEST123';
  const testSalt = 'salt456';
  const patientId = web3.utils.keccak256(web3.utils.encodePacked(testMRN, testSalt));

  try {
    // 1. Set up guardian (allows role assignment)
    console.log('\\n1. Setting up guardian...');
    const setGuardianTx = await contractInstance.methods.setGuardian(patientId, userAddress).send({
      from: ownerAccount.address,
      gas: 150000,
      gasPrice: '25000000000'
    });
    console.log('✅ Guardian set! TX:', setGuardianTx.transactionHash);

    // 2. Enable patient upload permissions
    console.log('\\n2. Enabling patient upload...');
    const enableUploadTx = await contractInstance.methods.setPatientCanUpload(patientId, true).send({
      from: ownerAccount.address,
      gas: 150000,
      gasPrice: '25000000000'
    });
    console.log('✅ Patient upload enabled! TX:', enableUploadTx.transactionHash);

    // 3. Set user as insurer for balance
    console.log('\\n3. Setting insurer...');
    const setInsurerTx = await contractInstance.methods.setInsurer(patientId, userAddress).send({
      from: ownerAccount.address,
      gas: 150000,
      gasPrice: '25000000000'
    });
    console.log('✅ Insurer set! TX:', setInsurerTx.transactionHash);

    // 4. Fund the insurer balance directly
    console.log('\\n4. Funding insurer balance...');
    const uploadFee = await contractInstance.methods.uploadFeeWei().call();
    const fundAmount = BigInt(uploadFee) * BigInt(50); // 50x upload fee

    // Direct balance funding (owner sends FLR to contract for this insurer)
    const fundTx = await web3.eth.sendTransaction({
      from: ownerAccount.address,
      to: process.env.VITE_VAULT_ADDRESS,
      value: fundAmount.toString(),
      gas: 100000,
      gasPrice: '25000000000'
    });
    console.log('✅ Contract funded! TX:', fundTx.transactionHash);

    // Manually credit the insurer balance (requires owner call)
    const creditTx = await contractInstance.methods.creditInsurerBalance(userAddress).send({
      from: ownerAccount.address,
      value: fundAmount.toString(),
      gas: 150000,
      gasPrice: '25000000000'
    });
    console.log('✅ Insurer balance credited! TX:', creditTx.transactionHash);

    console.log('\\n📋 Setup Summary:');
    console.log('- Patient ID:', patientId);
    console.log('- Guardian:', userAddress);
    console.log('- Can Upload: true');
    console.log('- Insurer:', userAddress);
    console.log('- Funded Amount:', web3.utils.fromWei(fundAmount.toString(), 'ether'), 'FLR');

    console.log('\\n🎯 Test Instructions:');
    console.log('1. Use MRN: TEST123');
    console.log('2. Use Salt: salt456');
    console.log('3. Select: FLR Deduct payment');
    console.log('4. Upload should work now!');

  } catch (error) {
    console.error('❌ Setup failed:', error.message);

    // If method doesn't exist, try simpler approach
    if (error.message.includes('creditInsurerBalance')) {
      console.log('\\n⚠️ Direct balance credit failed, user needs to register themselves');
      console.log('💡 User should click "Register as Patient" in UI first');
    }
  }
}

setupComplete().catch(console.error);