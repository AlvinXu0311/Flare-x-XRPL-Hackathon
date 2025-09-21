const { Web3 } = require('web3');
const fs = require('fs');
require('dotenv').config();

async function decodeTransaction() {
  const web3 = new Web3(process.env.RPC_COSTON2);
  const vaultJson = JSON.parse(fs.readFileSync('./build/contracts/SimpleMedicalVault.json', 'utf8'));
  const contractInstance = new web3.eth.Contract(vaultJson.abi, process.env.VITE_VAULT_ADDRESS);

  // The successful transaction hash from the previous check
  const txHash = '0xf2dd856112577b9b4c37c503c2b463c668ab317c78dce6a8702554b3290c73ef';

  console.log('🔍 Decoding transaction:', txHash);

  try {
    const receipt = await web3.eth.getTransactionReceipt(txHash);
    const transaction = await web3.eth.getTransaction(txHash);

    console.log('\n📋 Transaction Details:');
    console.log('From:', transaction.from);
    console.log('To:', transaction.to);
    console.log('Gas Used:', receipt.gasUsed);
    console.log('Status:', receipt.status ? '✅ Success' : '❌ Failed');
    console.log('Block:', receipt.blockNumber);

    console.log('\n📝 Events Decoded:');

    if (receipt.logs && receipt.logs.length > 0) {
      for (let i = 0; i < receipt.logs.length; i++) {
        const log = receipt.logs[i];
        try {
          const decoded = contractInstance.decodeEventABI(log);
          if (decoded) {
            console.log(`\nEvent ${i + 1}: ${decoded.event}`);
            console.log('Data:', decoded.returnValues);
          } else {
            // Try manual decoding for our contract events
            if (log.topics[0] === '0x06f6b1bfeb5b4ec123686e3e99b88f31ea983f9a90ad9ba8bf10f0fb29b47af4') {
              console.log(`\nEvent ${i + 1}: DocumentUploaded`);
              console.log('Raw data:', log.data);
              console.log('Topics:', log.topics);
            } else if (log.topics[0] === '0x2bd495210f90c5947db19e2ed93f400539ce2f52b0211c7a52870d200104be05') {
              console.log(`\nEvent ${i + 1}: UploadPaidXRPLXRP`);
              console.log('Raw data:', log.data);
              console.log('Topics:', log.topics);
            } else {
              console.log(`\nEvent ${i + 1}: Unknown event`);
              console.log('Topic:', log.topics[0]);
              console.log('Data length:', log.data.length);
            }
          }
        } catch (decodeError) {
          console.log(`\nEvent ${i + 1}: Could not decode`);
          console.log('Topic:', log.topics[0]);
          console.log('Data:', log.data.substring(0, 50) + '...');
        }
      }
    } else {
      console.log('No events found in transaction');
    }

    // Try to decode the function call
    console.log('\n🔧 Function Call:');
    try {
      const functionData = transaction.input;
      const functionSignature = functionData.substring(0, 10);

      console.log('Function signature:', functionSignature);

      if (functionSignature === '0xb510f669') {
        console.log('Function: uploadDocumentXRP()');
        console.log('Input data length:', functionData.length);
      } else {
        console.log('Unknown function call');
      }
    } catch (funcError) {
      console.log('Could not decode function call:', funcError.message);
    }

    console.log('\n🌐 Explorer Link:');
    console.log(`https://coston2-explorer.flare.network/tx/${txHash}`);

  } catch (error) {
    console.error('❌ Error decoding transaction:', error.message);
  }
}

decodeTransaction().catch(console.error);