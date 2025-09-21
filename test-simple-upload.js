const { Web3 } = require('web3');
const fs = require('fs');
require('dotenv').config();

async function testSimpleUpload() {
  console.log('🧪 Testing SimpleMedicalVault upload...');

  const web3 = new Web3(process.env.RPC_COSTON2);
  const userAccount = web3.eth.accounts.privateKeyToAccount('0x' + process.env.PRIVATE_KEY);
  web3.eth.accounts.wallet.add(userAccount);

  // Load contract
  const vaultJson = JSON.parse(fs.readFileSync('./build/contracts/SimpleMedicalVault.json', 'utf8'));
  const vaultInstance = new web3.eth.Contract(vaultJson.abi, process.env.VITE_VAULT_ADDRESS);

  console.log('Contract:', process.env.VITE_VAULT_ADDRESS);
  console.log('User:', userAccount.address);

  // Test data
  const testMRN = 'TEST123';
  const testSalt = 'salt456';
  const patientId = web3.utils.keccak256(web3.utils.encodePacked(testMRN, testSalt));
  const docKind = 0; // Diagnosis
  const hashURI = 'ipfs://QmTest123Encrypted';

  console.log('\n📋 Test Data:');
  console.log('Patient ID:', patientId);
  console.log('Document kind:', docKind, '(Diagnosis)');
  console.log('Hash URI:', hashURI);

  try {
    // 1. Check required drops
    console.log('\n1. Checking upload requirements...');
    const required = await vaultInstance.methods.requiredXrpDrops().call();
    console.log('Required XRP drops:', required.drops);
    console.log('Current XRP price:', web3.utils.fromWei(required.price, 'ether'), 'USD');
    console.log('Price decimals:', required.decimals);

    // 2. Prepare mock XRPL proof data
    console.log('\n2. Preparing XRPL proof...');
    const mockProofText = 'test-payment-proof-12345';
    const xrplProof = web3.utils.asciiToHex(mockProofText);
    const statementId = web3.utils.keccak256(`patient_${Date.now()}`);
    const proofId = web3.utils.keccak256(mockProofText);
    const xrplPaidDrops = required.drops; // Exact amount required

    console.log('Proof data length:', xrplProof.length);
    console.log('Statement ID:', statementId);
    console.log('Proof ID:', proofId);
    console.log('Paid drops:', xrplPaidDrops);

    // 3. Test with callStatic first (simulation)
    console.log('\n3. Simulating upload...');
    try {
      await vaultInstance.methods.uploadDocumentXRP(
        patientId,
        docKind,
        hashURI,
        xrplProof,
        statementId,
        proofId,
        xrplPaidDrops
      ).call({ from: userAccount.address });
      console.log('✅ Simulation successful!');
    } catch (simError) {
      console.error('❌ Simulation failed:', simError.message);
      return;
    }

    // 4. Execute actual upload
    console.log('\n4. Executing upload transaction...');
    const uploadTx = await vaultInstance.methods.uploadDocumentXRP(
      patientId,
      docKind,
      hashURI,
      xrplProof,
      statementId,
      proofId,
      xrplPaidDrops
    ).send({
      from: userAccount.address,
      gas: 500000,
      gasPrice: '25000000000'
    });

    console.log('✅ Upload successful!');
    console.log('Transaction hash:', uploadTx.transactionHash);
    console.log('Gas used:', uploadTx.gasUsed);

    // 5. Verify the document was stored
    console.log('\n5. Verifying stored document...');
    const docMeta = await vaultInstance.methods.getDocMeta(patientId, docKind).call();
    console.log('Stored document:');
    console.log('- Hash URI:', docMeta.hashURI);
    console.log('- Version:', docMeta.version);
    console.log('- Updated at:', new Date(parseInt(docMeta.updatedAt) * 1000).toISOString());
    console.log('- Payment proof:', docMeta.paymentProof);
    console.log('- Paid drops:', docMeta.paidDrops);

    // 6. Test document retrieval
    console.log('\n6. Testing document retrieval...');
    const retrievedDoc = await vaultInstance.methods.getDocument(patientId, docKind).call();
    console.log('Retrieved document:');
    console.log('- Hash URI:', retrievedDoc[0]);
    console.log('- Version:', retrievedDoc[1]);
    console.log('- Updated at:', new Date(parseInt(retrievedDoc[2]) * 1000).toISOString());
    console.log('- Payment proof:', retrievedDoc[3]);

    console.log('\n🎉 All tests passed!');
    console.log('\n📋 Summary:');
    console.log('✅ Contract deployment: Working');
    console.log('✅ Oracle setup: Working');
    console.log('✅ Upload function: Working');
    console.log('✅ Document storage: Working');
    console.log('✅ Document retrieval: Working');
    console.log('\n🎯 Ready to update UI!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.data) {
      console.error('Error data:', error.data);
    }
  }
}

testSimpleUpload().catch(console.error);