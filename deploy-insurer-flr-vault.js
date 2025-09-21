const { Web3 } = require('web3');
const fs = require('fs');
require('dotenv').config();

async function deployInsurerFLRVault() {
  console.log('🏥 Deploying Insurer FLR Medical Vault...');

  const web3 = new Web3(process.env.RPC_COSTON2);
  const ownerAccount = web3.eth.accounts.privateKeyToAccount('0x' + process.env.PRIVATE_KEY);
  web3.eth.accounts.wallet.add(ownerAccount);

  console.log('Owner address:', ownerAccount.address);
  console.log('RPC:', process.env.RPC_COSTON2);

  // Load compiled contract
  const vaultJson = JSON.parse(fs.readFileSync('./build/contracts/SimpleMedicalVault.json', 'utf8'));

  try {
    // Use existing mock oracles (already deployed)
    const fdcAddress = '0x2fA1293CCD07b99869236C931D20b32De391Ce05';
    const ftsoAddress = '0x97fE74AE376Be74dDc1B9C1E9e5097f4FD55CCA9';

    console.log('Using existing MockFDC:', fdcAddress);
    console.log('Using existing MockFTSO:', ftsoAddress);

    // Deploy new SimpleMedicalVault with insurer FLR payment
    console.log('\n🏗️ Deploying Insurer FLR SimpleMedicalVault...');
    const vaultContract = new web3.eth.Contract(vaultJson.abi);
    const vaultDeploy = vaultContract.deploy({
      data: vaultJson.bytecode
    });

    const vaultTx = await vaultDeploy.send({
      from: ownerAccount.address,
      gas: 3500000,
      gasPrice: '25000000000'
    });
    console.log('✅ Insurer FLR vault deployed at:', vaultTx.options.address);

    // Configure vault with existing oracles
    console.log('\n⚙️ Configuring vault...');
    const vaultInstance = new web3.eth.Contract(vaultJson.abi, vaultTx.options.address);

    // Set FDC
    const setFdcTx = await vaultInstance.methods.setFDC(fdcAddress).send({
      from: ownerAccount.address,
      gas: 150000,
      gasPrice: '25000000000'
    });
    console.log('✅ FDC configured! TX:', setFdcTx.transactionHash);

    // Set FTSO
    const setFtsoTx = await vaultInstance.methods.setFTSO(ftsoAddress).send({
      from: ownerAccount.address,
      gas: 150000,
      gasPrice: '25000000000'
    });
    console.log('✅ FTSO configured! TX:', setFtsoTx.transactionHash);

    // Set XRPL upload fee ($5.00 = 500 cents)
    const setXrplFeeTx = await vaultInstance.methods.setUploadFeeUSDc(500).send({
      from: ownerAccount.address,
      gas: 150000,
      gasPrice: '25000000000'
    });
    console.log('✅ XRPL fee set! TX:', setXrplFeeTx.transactionHash);

    // Set FLR upload fee (0.001 FLR)
    const flrFee = web3.utils.toWei('0.001', 'ether');
    const setFlrFeeTx = await vaultInstance.methods.setUploadFeeFLR(flrFee).send({
      from: ownerAccount.address,
      gas: 150000,
      gasPrice: '25000000000'
    });
    console.log('✅ FLR fee set! TX:', setFlrFeeTx.transactionHash);

    // Set staleness to 10 minutes
    const setStaleTx = await vaultInstance.methods.setMaxOracleStaleness(600).send({
      from: ownerAccount.address,
      gas: 150000,
      gasPrice: '25000000000'
    });
    console.log('✅ Oracle staleness set! TX:', setStaleTx.transactionHash);

    // Test both payment methods
    console.log('\n🧪 Testing both payment methods...');

    // Test XRPL path
    try {
      const requiredDrops = await vaultInstance.methods.requiredXrpDrops().call();
      console.log('✅ XRPL path: Required drops =', requiredDrops.drops);
      console.log('  XRP price:', web3.utils.fromWei(requiredDrops.price, 'ether'), 'USD');
    } catch (xrplError) {
      console.log('❌ XRPL path failed:', xrplError.message);
    }

    // Test FLR path
    try {
      const flrFeeWei = await vaultInstance.methods.uploadFeeWei().call();
      console.log('✅ FLR path: Fee =', web3.utils.fromWei(flrFeeWei, 'ether'), 'FLR');
    } catch (flrError) {
      console.log('❌ FLR path failed:', flrError.message);
    }

    console.log('\n🎉 Insurer FLR deployment complete!');
    console.log('\n📋 Contract Addresses:');
    console.log('InsurerFLRVault:    ', vaultTx.options.address);
    console.log('MockFDC (reused):   ', fdcAddress);
    console.log('MockFTSO (reused):  ', ftsoAddress);

    console.log('\n🔧 Update your .env file:');
    console.log(`VITE_VAULT_ADDRESS=${vaultTx.options.address}`);

    console.log('\n💰 Payment Methods Available:');
    console.log('1. XRPL: uploadDocumentXRP() - 5,000,000 drops (~$5.00)');
    console.log('2. FLR:  uploadDocumentFLR() - 0.001 FLR (direct payment)');

    console.log('\n🏥 Insurer Flow:');
    console.log('1. Insurer checks patient needs document upload');
    console.log('2. Insurer calls uploadDocumentFLR() with 0.001 FLR payment');
    console.log('3. Contract stores document and processes payment automatically');
    console.log('4. Document immediately available for patient/authorized parties');

    console.log('\n🎯 Next Steps:');
    console.log('1. Update .env with new contract address');
    console.log('2. Update UI to support direct FLR payment (no deposit needed)');
    console.log('3. Test insurer → upload → immediate availability flow');

  } catch (error) {
    console.error('❌ Deployment failed:', error.message);
  }
}

deployInsurerFLRVault().catch(console.error);