# Medical Vault Upload Instructions

## Issue Resolution Summary

The transaction failures were caused by **insufficient FLR balance** for upload fees, not authorization issues.

### ✅ Current Status:
- **Authorization**: User `0x49a63AD0971D5E6e4036E3aA09f86eea592b0465` is properly registered as patient
- **Upload Permissions**: Enabled (`patientCanUpload: true`)
- **Payment Method**: FLR deduct is correctly implemented
- **Contract Setup**: Flare oracles configured properly

### ❌ The Problem:
- **Insurer Balance**: 0 FLR (needs 0.0001 FLR minimum for uploads)

## How to Fix

### Option 1: Use the UI (Recommended)

1. **Open the Medical Vault UI**: http://localhost:5180
2. **Connect your MetaMask** to the same account (`0x49a63AD0971D5E6e4036E3aA09f86eea592b0465`)
3. **Navigate to Upload Documents**
4. **Use these test values**:
   - MRN: `TEST123`
   - Salt: `salt456`
   - Document Type: Any
   - Payment Method: `FLR Deduct`
5. **The UI should show**: "Insufficient balance! Please deposit more FLR first"
6. **Add a deposit function to the UI** or proceed to Option 2

### Option 2: Manual FLR Deposit (Required First)

The user needs to deposit FLR to pay for uploads. Only the user (insurer) can deposit for themselves.

**Create this script** (`user-deposit.js`):

```javascript
const { Web3 } = require('web3');
const fs = require('fs');
require('dotenv').config();

async function userDeposit() {
  const web3 = new Web3(process.env.RPC_COSTON2);
  const contractJson = JSON.parse(fs.readFileSync('./build/contracts/MedicalRecordVaultXRPL.json', 'utf8'));

  // USER must provide their private key here
  const userPrivateKey = 'YOUR_USER_PRIVATE_KEY_HERE'; // Replace with actual user key
  const userAccount = web3.eth.accounts.privateKeyToAccount(userPrivateKey);
  web3.eth.accounts.wallet.add(userAccount);

  const contractInstance = new web3.eth.Contract(contractJson.abi, process.env.VITE_VAULT_ADDRESS);

  const testMRN = 'TEST123';
  const testSalt = 'salt456';
  const patientId = web3.utils.keccak256(web3.utils.encodePacked(testMRN, testSalt));

  // Get upload fee
  const uploadFee = await contractInstance.methods.uploadFeeWei().call();
  const depositAmount = BigInt(uploadFee) * BigInt(10); // 10x the fee for multiple uploads

  console.log('Depositing for patient:', patientId);
  console.log('Deposit amount:', web3.utils.fromWei(depositAmount, 'ether'), 'FLR');

  // User deposits for themselves
  const depositTx = await contractInstance.methods.depositFor(patientId).send({
    from: userAccount.address,
    value: depositAmount.toString(),
    gas: 200000,
    gasPrice: '25000000000'
  });

  console.log('✅ Deposit successful!', depositTx.transactionHash);
}

userDeposit().catch(console.error);
```

### Option 3: Update UI to Include Deposit Function

Add a "Deposit FLR" button to the DocumentUpload.vue that calls `depositFor()` when balance is insufficient.

## Expected Upload Flow

After depositing FLR:

1. **Open UI**: http://localhost:5180
2. **Upload Document** with:
   - MRN: `TEST123`
   - Salt: `salt456`
   - Payment: `FLR Deduct`
3. **Upload should now succeed** without double transactions

## Technical Details

### Root Cause Analysis:
- ✅ Contract `onlyUploader` modifier works correctly
- ✅ User authorization is properly set up
- ✅ Payment method selection calls the right contract method (`uploadDocumentDeduct`)
- ❌ `insurerBalances[userAddress]` was 0, causing `require(insurerBalances[insurer] >= uploadFeeWei)` to fail

### Contract Methods:
- `uploadDocumentDeduct()`: ✅ Correctly called for FLR payments
- `registerAsPatient()`: ✅ Already executed successfully
- `depositFor()`: ❌ Needs user to call with their own wallet

The upload process is working correctly - it just needs FLR balance to pay the fees.