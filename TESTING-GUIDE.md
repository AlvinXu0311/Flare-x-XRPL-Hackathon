# 🧪 Medical Vault XRPL Upload Testing Guide

## 🌐 Access the Application
**URL:** http://localhost:5176

## 📋 Prerequisites
1. **MetaMask Installed** in your browser
2. **Coston2 Testnet** configured in MetaMask
3. **Test Funds** in your wallet (get from faucet if needed)

### ⚙️ MetaMask Setup for Coston2:
- **Network Name:** Coston2
- **RPC URL:** `https://coston2-api.flare.network/ext/bc/C/rpc`
- **Chain ID:** 114
- **Symbol:** C2FLR
- **Block Explorer:** `https://coston2-explorer.flare.network/`

## 🔍 Step-by-Step XRPL Upload Test

### 1. Connect Wallet
1. Open http://localhost:5176
2. Click **"Connect Wallet"**
3. Approve MetaMask connection
4. Ensure you're on **Coston2 testnet**

### 2. Fill Patient Information
**Navigate to "Upload Medical Document" tab**

**Patient Details:**
- **MRN:** `TEST123` (or any number you choose)
- **Salt:** Click **"Generate Random Salt"** or enter: `salt456`
- **Document Type:** Select `Diagnosis Letter`

**📝 Note:** `patientId = keccak256("TEST123" + "salt456")`

### 3. Upload File
- **Select File:** Choose any small test file (PDF, image, text)
- **Encryption Password:** Enter: `mypassword123`
  - ⚠️ **Remember this!** You'll need it to decrypt later

### 4. Choose XRPL Payment Method
- **Select:** `XRPL Payment (with proof)`
- **XRPL Payment Proof:** Enter any text like: `mock_payment_proof_12345`
- **Attested USD Amount:** Enter: `500` (represents $5.00 in cents)

### 5. Submit Upload
1. Click **"Upload Document"**
2. **MetaMask will prompt** for transaction approval
3. **Approve the transaction**
4. Wait for confirmation

## 📊 What Happens During Upload:

### 🔄 Process Flow:
1. **File Encryption:** Your file is encrypted with your password + salt
2. **IPFS Upload:** Encrypted file → IPFS → Gets hash like `QmXxx...`
3. **Smart Contract Call:** Stores metadata mapping:
   ```
   records[patientId].docs[0] = {
     hashURI: "ipfs://QmXxx...",
     version: 1,
     updatedAt: timestamp,
     paymentProof: keccak256("mock_payment_proof_12345"),
     paidUSDc: 500,
     currencyHash: keccak256("USD|mock_issuer")
   }
   ```

### 🗃️ Storage Structure:
```
Blockchain: patientId → docType → Metadata
IPFS: QmXxx... → Encrypted file content
```

## ✅ Success Indicators:
- **Green Success Message** with IPFS hash and transaction hash
- **Transaction Hash** you can verify on Coston2 explorer
- **Version Number** (starts at 1, increments with each upload)

## 🔍 Testing Document Retrieval:

### Navigate to "Download Medical Document" tab:
1. **Enter Same Details:**
   - **MRN:** `TEST123`
   - **Salt:** `salt456` (same as upload)
   - **Document Type:** `Diagnosis Letter`

2. **Search Document**
3. **Enter Decryption Password:** `mypassword123`
4. **Download & Decrypt**

## 🚨 Troubleshooting:

### Proxy Error Solutions:
- **Disconnect wallet** in MetaMask
- **Reconnect wallet**
- **Refresh page**
- **Try again**

### Common Issues:
- **"Insufficient funds"** → Get test funds from Coston2 faucet
- **"Transaction failed"** → Check network (must be Coston2)
- **"Execution reverted"** → Verify all inputs are correct

## 📈 Expected Results:

### Successful Upload Shows:
- ✅ **IPFS Hash:** `QmABC123...`
- ✅ **Transaction Hash:** `0xdef456...`
- ✅ **Version:** `1`
- ✅ **Green success message**

### Browser Console Should Show:
```
XRPL Upload parameters: {
  patientId: "0x789...",
  docKind: 0,
  ipfsUri: "ipfs://QmXxx...",
  attestedUSDc: 500,
  proofLength: 21
}
```

## 🔗 Contract Address:
**Current Contract:** `0x41CbeDC5310aE446C7Cc060F31402Cfcb8EB10D0`

---

**🎯 This test validates:**
- ✅ Wallet connectivity
- ✅ File encryption & IPFS upload
- ✅ XRPL payment proof handling
- ✅ Smart contract integration
- ✅ Document mapping to patient ID
- ✅ End-to-end upload workflow