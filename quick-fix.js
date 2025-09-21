const { Web3 } = require('web3');
const fs = require('fs');
require('dotenv').config();

async function quickFix() {
  const web3 = new Web3(process.env.RPC_COSTON2);
  const contractJson = JSON.parse(fs.readFileSync('./build/contracts/MedicalRecordVaultXRPL.json', 'utf8'));
  const ownerAccount = web3.eth.accounts.privateKeyToAccount('0x' + process.env.PRIVATE_KEY);
  web3.eth.accounts.wallet.add(ownerAccount);

  const contractInstance = new web3.eth.Contract(contractJson.abi, process.env.VITE_VAULT_ADDRESS);

  const userAddress = '0x49a63AD0971D5E6e4036E3aA09f86eea592b0465';
  const testMRN = 'TEST123';
  const testSalt = 'salt456';
  const patientId = web3.utils.keccak256(web3.utils.encodePacked(testMRN, testSalt));

  console.log('🔧 Quick setup for FLR deduct upload');

  try {
    // Just deposit FLR directly to contract for the specific patient
    const uploadFee = await contractInstance.methods.uploadFeeWei().call();
    const depositAmount = BigInt(uploadFee) * BigInt(10);

    console.log('Upload fee:', web3.utils.fromWei(uploadFee, 'ether'), 'FLR');

    // Check current insurer balance
    try {
      const currentBalance = await contractInstance.methods.insurerBalances(userAddress).call();
      console.log('Current balance:', web3.utils.fromWei(currentBalance, 'ether'), 'FLR');

      if (BigInt(currentBalance) >= BigInt(uploadFee)) {
        console.log('✅ Sufficient balance already exists!');
        console.log('\\n🎯 Ready to test:');
        console.log('- Select FLR Deduct in UI');
        console.log('- Use MRN: TEST123, Salt: salt456');
        return;
      }
    } catch (e) {
      console.log('Balance check failed, will try to fund...');
    }

    // Send FLR to the user's insurer balance
    console.log('💰 Sending FLR directly to owner...');

    // Owner needs to have FLR first
    const ownerBalance = await web3.eth.getBalance(ownerAccount.address);
    console.log('Owner balance:', web3.utils.fromWei(ownerBalance, 'ether'), 'C2FLR');

    if (BigInt(ownerBalance) < depositAmount) {
      console.log('❌ Owner needs more C2FLR from faucet!');
      console.log('💡 Get C2FLR from: https://coston2-faucet.towolabs.com/');
      return;
    }

    // Owner should manually fund their account as insurer, then user registers
    console.log('\\n📋 Manual steps needed:');
    console.log('1. In UI, select FLR Deduct payment');
    console.log('2. Enter MRN: TEST123, Salt: salt456');
    console.log('3. Click upload - it will register user as patient');
    console.log('4. User needs to manually deposit FLR or owner needs to set up escrow');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

quickFix().catch(console.error);