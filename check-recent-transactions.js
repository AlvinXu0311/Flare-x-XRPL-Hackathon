const { Web3 } = require('web3');
const fs = require('fs');
require('dotenv').config();

async function checkRecentTransactions() {
  console.log('🔍 Checking recent transactions for SimpleMedicalVault...');

  const web3 = new Web3(process.env.RPC_COSTON2);
  const contractAddress = process.env.VITE_VAULT_ADDRESS;

  console.log('Contract address:', contractAddress);
  console.log('Checking last 100 blocks for transactions...\n');

  try {
    // Get current block number
    const currentBlock = await web3.eth.getBlockNumber();
    console.log('Current block:', currentBlock);

    // Check last 100 blocks for transactions to our contract
    const fromBlock = Math.max(0, Number(currentBlock) - 100);

    console.log(`Scanning blocks ${fromBlock} to ${currentBlock}...\n`);

    // Get all transactions to the contract address
    const transactions = [];

    for (let blockNum = Number(currentBlock); blockNum >= fromBlock; blockNum--) {
      try {
        const block = await web3.eth.getBlock(blockNum, true);
        if (block && block.transactions) {
          const contractTxs = block.transactions.filter(tx =>
            tx.to && tx.to.toLowerCase() === contractAddress.toLowerCase()
          );

          for (const tx of contractTxs) {
            const receipt = await web3.eth.getTransactionReceipt(tx.hash);
            transactions.push({
              hash: tx.hash,
              blockNumber: blockNum,
              from: tx.from,
              to: tx.to,
              value: tx.value,
              gasUsed: receipt.gasUsed,
              status: receipt.status,
              timestamp: new Date(Number(block.timestamp) * 1000).toISOString(),
              input: tx.input.substring(0, 10) // Function selector
            });
          }
        }
      } catch (blockError) {
        // Skip blocks that might not exist
      }
    }

    if (transactions.length === 0) {
      console.log('❌ No transactions found to the contract in the last 100 blocks');
      console.log('\n💡 Try these steps:');
      console.log('1. Make sure the contract address is correct');
      console.log('2. Try uploading a document in the UI');
      console.log('3. Check if MetaMask is connected to Coston2 testnet');
      return;
    }

    console.log(`✅ Found ${transactions.length} transaction(s):\n`);

    // Sort by block number (newest first)
    transactions.sort((a, b) => b.blockNumber - a.blockNumber);

    transactions.forEach((tx, index) => {
      console.log(`📋 Transaction ${index + 1}:`);
      console.log(`  Hash: ${tx.hash}`);
      console.log(`  Block: ${tx.blockNumber}`);
      console.log(`  From: ${tx.from}`);
      console.log(`  Status: ${tx.status ? '✅ Success' : '❌ Failed'}`);
      console.log(`  Gas Used: ${tx.gasUsed}`);
      console.log(`  Timestamp: ${tx.timestamp}`);
      console.log(`  Function: ${tx.input}`);
      console.log(`  Explorer: https://coston2-explorer.flare.network/tx/${tx.hash}`);
      console.log('');
    });

    // Get latest successful transaction details
    const successfulTxs = transactions.filter(tx => tx.status);
    if (successfulTxs.length > 0) {
      const latestTx = successfulTxs[0];
      console.log('🎯 Latest successful transaction details:');

      // Get full transaction receipt with logs
      const fullReceipt = await web3.eth.getTransactionReceipt(latestTx.hash);

      console.log(`  Hash: ${latestTx.hash}`);
      console.log(`  Gas Used: ${fullReceipt.gasUsed}`);
      console.log(`  Logs Count: ${fullReceipt.logs.length}`);

      if (fullReceipt.logs.length > 0) {
        console.log('  Events emitted:');
        fullReceipt.logs.forEach((log, i) => {
          console.log(`    Log ${i}: ${log.topics[0]} (${log.data.length} bytes data)`);
        });
      }
    }

  } catch (error) {
    console.error('❌ Error checking transactions:', error.message);
  }
}

checkRecentTransactions().catch(console.error);