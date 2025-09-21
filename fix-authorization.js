const { Web3 } = require('web3');
const fs = require('fs');
require('dotenv').config();

async function fixAuthorization() {
  const web3 = new Web3(process.env.RPC_COSTON2);
  const contractJson = JSON.parse(fs.readFileSync('./build/contracts/MedicalRecordVaultXRPL.json', 'utf8'));

  // Contract owner account (for setting up insurer)
  const ownerAccount = web3.eth.accounts.privateKeyToAccount('0x' + process.env.PRIVATE_KEY);
  web3.eth.accounts.wallet.add(ownerAccount);

  const contractInstance = new web3.eth.Contract(contractJson.abi, process.env.VITE_VAULT_ADDRESS);

  console.log('🔧 Fixing authorization for Medical Vault uploads');
  console.log('Contract:', process.env.VITE_VAULT_ADDRESS);
  console.log('Owner:', ownerAccount.address);

  const userAddress = '0x49a63AD0971D5E6e4036E3aA09f86eea592b0465';
  const testMRN = 'TEST123';
  const testSalt = 'salt456';
  const patientId = web3.utils.keccak256(web3.utils.encodePacked(testMRN, testSalt));

  try {
    console.log('\n📋 Authorization Analysis:');
    console.log('Patient ID:', patientId);
    console.log('User Address:', userAddress);

    // Check current roles
    const roles = await contractInstance.methods.getRoles(patientId).call();
    console.log('\nCurrent roles:', {
      guardian: roles.guardian,
      pediatricPsychologist: roles.pediatricPsychologist,
      patient: roles.patient,
      insurer: roles.insurer,
      patientCanUpload: roles.patientCanUpload
    });

    // Check upload authorization
    const canUpload = await contractInstance.methods.canUploadForPatient(patientId, userAddress).call();
    console.log('Can user upload?', canUpload);

    if (!canUpload) {
      console.log('\n❌ User cannot upload. Required fixes:');

      // The user needs to self-register as patient
      if (roles.patient === '0x0000000000000000000000000000000000000000') {
        console.log('1. User must call registerAsPatient() themselves');
        console.log('   - This cannot be done by contract owner');
        console.log('   - User should use the UI "Register as Patient" button');
        console.log('   - Or user can call registerAsPatient() directly');
      }

      // Owner needs to set insurer for payment
      if (roles.insurer === '0x0000000000000000000000000000000000000000') {
        console.log('2. Setting insurer for payment...');
        const setInsurerTx = await contractInstance.methods.setInsurer(patientId, userAddress).send({
          from: ownerAccount.address,
          gas: 150000,
          gasPrice: '25000000000'
        });
        console.log('✅ Insurer set! TX:', setInsurerTx.transactionHash);
      } else {
        console.log('✅ Insurer already set:', roles.insurer);
      }

      // Check and fund insurer balance
      const uploadFee = await contractInstance.methods.uploadFeeWei().call();
      const currentBalance = await contractInstance.methods.insurerBalances(userAddress).call();

      console.log('\n💰 Balance Check:');
      console.log('Upload fee:', web3.utils.fromWei(uploadFee, 'ether'), 'FLR');
      console.log('Current balance:', web3.utils.fromWei(currentBalance, 'ether'), 'FLR');

      if (BigInt(currentBalance) < BigInt(uploadFee) * BigInt(10)) {
        console.log('3. Funding insurer balance...');
        const fundAmount = BigInt(uploadFee) * BigInt(20); // 20x upload fee

        const depositTx = await contractInstance.methods.depositFor(patientId).send({
          from: ownerAccount.address,
          value: fundAmount.toString(),
          gas: 200000,
          gasPrice: '25000000000'
        });
        console.log('✅ Balance funded! TX:', depositTx.transactionHash);
        console.log('Funded amount:', web3.utils.fromWei(fundAmount, 'ether'), 'FLR');
      } else {
        console.log('✅ Sufficient balance exists');
      }
    } else {
      console.log('✅ User is already authorized to upload');
    }

    console.log('\n🎯 Next Steps:');
    console.log('1. User must visit the UI and either:');
    console.log('   a) Click "Register as Patient" button first, then upload');
    console.log('   b) Try uploading - it will auto-register during upload process');
    console.log('2. Use these test values:');
    console.log('   - MRN: TEST123');
    console.log('   - Salt: salt456');
    console.log('   - Payment: FLR Deduct');
    console.log('3. If registration shows as complete, click "Upload Document Now"');

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
  }
}

fixAuthorization().catch(console.error);