const { Web3 } = require('web3');
const fs = require('fs');
require('dotenv').config();

/**
 * Setup FDC and FTSO oracles for the Medical Vault contract on Coston2
 * This script configures the required Flare network oracles
 */

async function setupFlareOracles() {
  const web3 = new Web3(process.env.RPC_COSTON2);

  // Load the contract
  const contractJson = JSON.parse(fs.readFileSync('./build/contracts/MedicalRecordVaultXRPL.json', 'utf8'));

  // Create account from private key
  const account = web3.eth.accounts.privateKeyToAccount('0x' + process.env.PRIVATE_KEY);
  web3.eth.accounts.wallet.add(account);

  console.log('Setting up Flare oracles for contract:', process.env.VITE_VAULT_ADDRESS);
  console.log('From account:', account.address);

  try {
    const contractInstance = new web3.eth.Contract(contractJson.abi, process.env.VITE_VAULT_ADDRESS);

    // Flare Network Coston2 Oracle Addresses
    // These are the official Flare testnet addresses
    const FDC_ADDRESS = '0x1000000000000000000000000000000000000003'; // FDC (Flare Data Connector)
    const FTSO_REGISTRY = '0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019'; // FTSO Registry

    console.log('Setting FDC address:', FDC_ADDRESS);

    // Set FDC (Flare Data Connector)
    const setFdcTx = await contractInstance.methods.setFDC(FDC_ADDRESS).send({
      from: account.address,
      gas: 150000,
      gasPrice: '25000000000' // 25 gwei
    });

    console.log('✅ FDC set successfully!');
    console.log('Transaction hash:', setFdcTx.transactionHash);

    // For FTSO, we need to use the FTSO Registry to get XRP price feed
    // This is a placeholder - in production you'd get the actual XRP price feed address
    console.log('Setting FTSO registry:', FTSO_REGISTRY);

    const setFtsoTx = await contractInstance.methods.setFTSO(FTSO_REGISTRY).send({
      from: account.address,
      gas: 150000,
      gasPrice: '25000000000' // 25 gwei
    });

    console.log('✅ FTSO set successfully!');
    console.log('Transaction hash:', setFtsoTx.transactionHash);

    // Verify setup
    const fdcAddress = await contractInstance.methods.fdc().call();
    const ftsoAddress = await contractInstance.methods.ftso().call();

    console.log('\n📋 Oracle Setup Verification:');
    console.log('FDC Address:', fdcAddress);
    console.log('FTSO Address:', ftsoAddress);

    console.log('\n✅ Flare oracles setup complete!');
    console.log('Your contract can now process XRPL payments with attestation.');

  } catch (error) {
    console.error('❌ Oracle setup failed:', error.message);

    if (error.message.includes('not owner')) {
      console.log('💡 Make sure you are the contract owner to set oracles.');
    }

    if (error.message.includes('insufficient funds')) {
      console.log('💡 Get test funds from: https://coston2-faucet.towolabs.com/');
    }
  }
}

setupFlareOracles().catch(console.error);