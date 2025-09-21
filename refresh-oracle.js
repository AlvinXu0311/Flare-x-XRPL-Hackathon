const { Web3 } = require('web3');
const fs = require('fs');
require('dotenv').config();

async function refreshOracle() {
  console.log('🔄 Refreshing MockFTSO timestamp...');

  const web3 = new Web3(process.env.RPC_COSTON2);
  const ownerAccount = web3.eth.accounts.privateKeyToAccount('0x' + process.env.PRIVATE_KEY);
  web3.eth.accounts.wallet.add(ownerAccount);

  // Get FTSO address from vault
  const vaultJson = JSON.parse(fs.readFileSync('./build/contracts/SimpleMedicalVault.json', 'utf8'));
  const vaultInstance = new web3.eth.Contract(vaultJson.abi, process.env.VITE_VAULT_ADDRESS);

  try {
    const ftsoAddress = await vaultInstance.methods.ftso().call();
    console.log('FTSO address:', ftsoAddress);

    // Update MockFTSO timestamp
    const ftsoJson = JSON.parse(fs.readFileSync('./build/contracts/MockFTSO.json', 'utf8'));
    const ftsoInstance = new web3.eth.Contract(ftsoJson.abi, ftsoAddress);

    console.log('Setting fresh timestamp...');
    const currentTime = Math.floor(Date.now() / 1000);

    const updateTx = await ftsoInstance.methods.setTimestamp(currentTime).send({
      from: ownerAccount.address,
      gas: 100000,
      gasPrice: '25000000000'
    });

    console.log('✅ Oracle refreshed! TX:', updateTx.transactionHash);

    // Verify the update
    const priceData = await ftsoInstance.methods.getXRPUSDPrice().call();
    console.log('New timestamp:', new Date(Number(priceData[2]) * 1000).toISOString());

    // Test upload simulation now
    console.log('\n🧪 Testing upload after refresh...');
    const testMRN = 'TEST123';
    const testSalt = 'salt456';
    const patientId = web3.utils.keccak256(web3.utils.encodePacked(testMRN, testSalt));

    const mockProof = web3.utils.asciiToHex('test-proof-fresh');
    const statementId = web3.utils.keccak256('test-statement-fresh');
    const proofId = web3.utils.keccak256('test-proof-id-fresh');

    await vaultInstance.methods.uploadDocumentXRP(
      patientId,
      0, // Diagnosis
      'ipfs://test-fresh',
      mockProof,
      statementId,
      proofId,
      5000000 // 5M drops
    ).call({ from: ownerAccount.address });

    console.log('✅ Upload simulation now works!');
    console.log('\n🎯 UI should work now - oracle price is fresh');

  } catch (error) {
    console.error('❌ Error refreshing oracle:', error.message);
  }
}

refreshOracle().catch(console.error);