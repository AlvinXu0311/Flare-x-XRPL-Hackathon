const { Web3 } = require('web3');
const fs = require('fs');
require('dotenv').config();

async function deploySimpleVault() {
  console.log('🚀 Deploying SimpleMedicalVault with MockFDC/MockFTSO...');

  const web3 = new Web3(process.env.RPC_COSTON2);
  const ownerAccount = web3.eth.accounts.privateKeyToAccount('0x' + process.env.PRIVATE_KEY);
  web3.eth.accounts.wallet.add(ownerAccount);

  console.log('Owner address:', ownerAccount.address);
  console.log('RPC:', process.env.RPC_COSTON2);

  // Load compiled contracts
  const vaultJson = JSON.parse(fs.readFileSync('./build/contracts/SimpleMedicalVault.json', 'utf8'));
  const fdcJson = JSON.parse(fs.readFileSync('./build/contracts/MockFDC.json', 'utf8'));
  const ftsoJson = JSON.parse(fs.readFileSync('./build/contracts/MockFTSO.json', 'utf8'));

  try {
    // 1. Deploy MockFDC
    console.log('\n1. Deploying MockFDC...');
    const fdcContract = new web3.eth.Contract(fdcJson.abi);
    const fdcDeploy = fdcContract.deploy({
      data: fdcJson.bytecode
    });

    const fdcTx = await fdcDeploy.send({
      from: ownerAccount.address,
      gas: 1000000,
      gasPrice: '25000000000'
    });
    console.log('✅ MockFDC deployed at:', fdcTx.options.address);

    // 2. Deploy MockFTSO
    console.log('\n2. Deploying MockFTSO...');
    const ftsoContract = new web3.eth.Contract(ftsoJson.abi);
    const ftsoDeploy = ftsoContract.deploy({
      data: ftsoJson.bytecode
    });

    const ftsoTx = await ftsoDeploy.send({
      from: ownerAccount.address,
      gas: 1000000,
      gasPrice: '25000000000'
    });
    console.log('✅ MockFTSO deployed at:', ftsoTx.options.address);

    // 3. Deploy SimpleMedicalVault
    console.log('\n3. Deploying SimpleMedicalVault...');
    const vaultContract = new web3.eth.Contract(vaultJson.abi);
    const vaultDeploy = vaultContract.deploy({
      data: vaultJson.bytecode
    });

    const vaultTx = await vaultDeploy.send({
      from: ownerAccount.address,
      gas: 3000000,
      gasPrice: '25000000000'
    });
    console.log('✅ SimpleMedicalVault deployed at:', vaultTx.options.address);

    // 4. Configure vault with mock oracles
    console.log('\n4. Configuring vault...');
    const vaultInstance = new web3.eth.Contract(vaultJson.abi, vaultTx.options.address);

    // Set FDC
    const setFdcTx = await vaultInstance.methods.setFDC(fdcTx.options.address).send({
      from: ownerAccount.address,
      gas: 150000,
      gasPrice: '25000000000'
    });
    console.log('✅ FDC set! TX:', setFdcTx.transactionHash);

    // Set FTSO
    const setFtsoTx = await vaultInstance.methods.setFTSO(ftsoTx.options.address).send({
      from: ownerAccount.address,
      gas: 150000,
      gasPrice: '25000000000'
    });
    console.log('✅ FTSO set! TX:', setFtsoTx.transactionHash);

    // Set upload fee ($5.00 = 500 cents)
    const setFeeTx = await vaultInstance.methods.setUploadFeeUSDc(500).send({
      from: ownerAccount.address,
      gas: 150000,
      gasPrice: '25000000000'
    });
    console.log('✅ Upload fee set! TX:', setFeeTx.transactionHash);

    // Set staleness to 10 minutes
    const setStaleTx = await vaultInstance.methods.setMaxOracleStaleness(600).send({
      from: ownerAccount.address,
      gas: 150000,
      gasPrice: '25000000000'
    });
    console.log('✅ Oracle staleness set! TX:', setStaleTx.transactionHash);

    // 5. Test oracle functionality
    console.log('\n5. Testing oracle setup...');
    const requiredDrops = await vaultInstance.methods.requiredXrpDrops().call();
    console.log('Required XRP drops for $5.00:', requiredDrops.drops);
    console.log('Current XRP price:', web3.utils.fromWei(requiredDrops.price, 'ether'), 'USD');

    console.log('\n🎉 Deployment complete!');
    console.log('\n📋 Contract Addresses:');
    console.log('SimpleMedicalVault:', vaultTx.options.address);
    console.log('MockFDC:', fdcTx.options.address);
    console.log('MockFTSO:', ftsoTx.options.address);

    console.log('\n🔧 Update your .env file:');
    console.log(`VITE_VAULT_ADDRESS=${vaultTx.options.address}`);

    console.log('\n🎯 Ready for testing:');
    console.log('- Any user can upload documents (no ACL)');
    console.log('- Upload function: uploadDocumentXRP()');
    console.log('- MockFDC will accept any proof');
    console.log('- MockFTSO returns $1.00 XRP price');
    console.log('- Required drops for $5.00 upload:', requiredDrops.drops);

  } catch (error) {
    console.error('❌ Deployment failed:', error.message);
  }
}

deploySimpleVault().catch(console.error);