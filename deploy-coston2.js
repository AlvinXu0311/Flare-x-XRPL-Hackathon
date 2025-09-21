const { Web3 } = require('web3');
const fs = require('fs');
require('dotenv').config();

async function deployToCoston2() {
  const web3 = new Web3(process.env.RPC_COSTON2);

  // Load the contract
  const contractJson = JSON.parse(fs.readFileSync('./build/contracts/MedicalRecordVaultXRPL.json', 'utf8'));

  // Create account from private key
  const account = web3.eth.accounts.privateKeyToAccount('0x' + process.env.PRIVATE_KEY);
  web3.eth.accounts.wallet.add(account);

  console.log('Deploying to Coston2 from account:', account.address);

  try {
    // Check balance
    const balance = await web3.eth.getBalance(account.address);
    console.log('Account balance:', web3.utils.fromWei(balance, 'ether'), 'C2FLR');

    if (balance == 0) {
      console.log('❌ No balance! Please add test funds from https://coston2-faucet.towolabs.com/');
      return;
    }

    // Deploy contract
    const contract = new web3.eth.Contract(contractJson.abi);
    const deployTx = contract.deploy({ data: contractJson.bytecode });

    // Estimate gas
    const gas = await deployTx.estimateGas({ from: account.address });
    console.log('Estimated gas:', gas);

    // Deploy
    const deployedContract = await deployTx.send({
      from: account.address,
      gas: Math.floor(Number(gas) * 1.2), // Add 20% buffer, convert BigInt to Number
      gasPrice: '25000000000' // 25 gwei
    });

    console.log('✅ Contract deployed successfully!');
    console.log('Contract address:', deployedContract.options.address);
    console.log('Transaction hash:', deployedContract._transactionHash);

    // Update .env file
    const envContent = fs.readFileSync('.env', 'utf8');
    const updatedEnv = envContent.replace(
      /VITE_VAULT_ADDRESS=.*/,
      `VITE_VAULT_ADDRESS=${deployedContract.options.address}`
    );
    fs.writeFileSync('.env', updatedEnv);

    console.log('✅ Updated .env file with new contract address');

    // Test basic contract function
    const owner = await deployedContract.methods.owner().call();
    console.log('Contract owner:', owner);

    return deployedContract.options.address;

  } catch (error) {
    console.error('❌ Deployment failed:', error.message);
    if (error.message.includes('insufficient funds')) {
      console.log('💡 Get test funds from: https://coston2-faucet.towolabs.com/');
    }
  }
}

deployToCoston2().catch(console.error);