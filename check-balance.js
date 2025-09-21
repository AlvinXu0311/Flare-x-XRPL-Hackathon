const { Web3 } = require('web3');
const fs = require('fs');
require('dotenv').config();

async function checkBalance() {
  const web3 = new Web3(process.env.RPC_COSTON2);
  const contractJson = JSON.parse(fs.readFileSync('./build/contracts/MedicalRecordVaultXRPL.json', 'utf8'));
  const contractInstance = new web3.eth.Contract(contractJson.abi, process.env.VITE_VAULT_ADDRESS);

  const userAddress = '0x49a63AD0971D5E6e4036E3aA09f86eea592b0465';

  try {
    // Check upload fee
    const uploadFee = await contractInstance.methods.uploadFeeWei().call();
    console.log('Upload fee:', web3.utils.fromWei(uploadFee, 'ether'), 'FLR');

    // Check insurer balance
    const balance = await contractInstance.methods.insurerBalances(userAddress).call();
    console.log('Insurer balance:', web3.utils.fromWei(balance, 'ether'), 'FLR');

    const hasBalance = BigInt(balance) >= BigInt(uploadFee);
    console.log('Has sufficient balance?', hasBalance);

    if (!hasBalance) {
      console.log('⚠️ Need to fund balance');
      console.log('Required:', web3.utils.fromWei(uploadFee, 'ether'), 'FLR');
      console.log('Current:', web3.utils.fromWei(balance, 'ether'), 'FLR');
    } else {
      console.log('✅ Ready for upload!');
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkBalance().catch(console.error);