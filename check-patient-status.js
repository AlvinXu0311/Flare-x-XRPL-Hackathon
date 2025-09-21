const { Web3 } = require('web3');
const fs = require('fs');
require('dotenv').config();

async function checkPatientStatus() {
  const web3 = new Web3(process.env.RPC_COSTON2);
  const contractJson = JSON.parse(fs.readFileSync('./build/contracts/MedicalRecordVaultXRPL.json', 'utf8'));
  const contractInstance = new web3.eth.Contract(contractJson.abi, process.env.VITE_VAULT_ADDRESS);

  const testMRN = 'TEST123';
  const testSalt = 'salt456';
  const patientId = web3.utils.keccak256(web3.utils.encodePacked(testMRN, testSalt));
  const userAddress = '0x49a63AD0971D5E6e4036E3aA09f86eea592b0465';

  console.log('Checking patient status for:', patientId);

  try {
    // Check if patient exists
    const patientRecord = await contractInstance.methods.records(patientId).call();
    console.log('Patient record:', patientRecord);

    // Check upload permissions
    const canUpload = await contractInstance.methods.canUploadForPatient(patientId, userAddress).call();
    console.log('Can upload:', canUpload);

    // Check insurer
    const insurerAddress = await contractInstance.methods.insurerOf(patientId).call();
    console.log('Insurer address:', insurerAddress);

    if (insurerAddress !== '0x0000000000000000000000000000000000000000') {
      const balance = await contractInstance.methods.insurerBalances(insurerAddress).call();
      console.log('Insurer balance:', web3.utils.fromWei(balance, 'ether'), 'FLR');
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkPatientStatus().catch(console.error);