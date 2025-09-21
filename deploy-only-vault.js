const { Web3 } = require('web3');
const contract = require('./build/contracts/MedicalRecordVaultXRPL.json');

async function deploy() {
  const web3 = new Web3('http://localhost:8545');
  const accounts = await web3.eth.getAccounts();

  console.log('Deploying from account:', accounts[0]);
  console.log('Account balance:', await web3.eth.getBalance(accounts[0]));

  const deployerAccount = accounts[0];
  const gasLimit = 6000000;

  try {
    console.log('Deploying MedicalRecordVaultXRPL...');

    const result = await new web3.eth.Contract(contract.abi)
      .deploy({ data: contract.bytecode })
      .send({
        from: deployerAccount,
        gas: gasLimit,
        gasPrice: '20000000000'
      });

    console.log('Contract deployed at:', result.options.address);
    console.log('Transaction hash:', result._transactionHash);

    // Test basic contract functionality
    const owner = await result.methods.owner().call();
    console.log('Contract owner:', owner);

    // Set upload fees
    const feeWei = web3.utils.toWei("0.0001", "ether");
    const feeUSDc = 500; // $5.00

    const setFeeTx = await result.methods.setUploadFees(feeWei, feeUSDc, deployerAccount).send({
      from: deployerAccount,
      gas: 100000
    });

    console.log('Upload fees set. Transaction hash:', setFeeTx.transactionHash);
    console.log('✅ Deployment and setup completed successfully!');

    return result.options.address;

  } catch (error) {
    console.error('Deployment failed:', error);
    throw error;
  }
}

deploy().catch(console.error);