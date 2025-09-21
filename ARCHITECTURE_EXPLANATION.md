# Medical Vault Contract Architecture & Flare-XRPL Bridge Explanation

## 🏗️ **System Overview**

The Medical Vault system creates a **hybrid payment bridge** between **Flare Network** and **XRP Ledger (XRPL)** for medical document storage, allowing payments in both native FLR tokens and XRP through attestation.

## 📋 **Contract Architecture**

### **Core Contract: SimpleMedicalVault.sol**
```
Location: E:\EasyAHackathon\contracts\SimpleMedicalVault.sol
Deployed: 0xbaa22126E5611fC51A0218251DEbeEaCf38a6F5A (Coston2)
```

**Purpose**: Store encrypted medical documents on IPFS with dual payment verification system.

## 🌉 **Flare-XRPL Bridge Implementation**

### **Bridge Type: Attestation-Based (NOT Token Bridge)**

This is **NOT** a traditional token bridge that moves XRP to Flare. Instead, it's an **attestation bridge** that verifies XRPL payments occurred and allows equivalent services on Flare.

## 💰 **Dual Payment System**

### **Payment Method 1: XRPL Attestation** ⚡
```solidity
function uploadDocumentXRP(
    bytes32 patientId,
    uint8   kind,
    string  calldata hashURI,
    bytes   calldata xrplProof,      // ← Proof of XRPL payment
    bytes32 statementId,
    bytes32 proofId,
    uint256 xrplPaidDrops           // ← Amount paid on XRPL
) external
```

**How it works:**
1. **User pays XRP** on XRP Ledger (off-chain)
2. **FDC verifies** the XRPL payment happened (`fdc.verify()`)
3. **FTSO provides** XRP/USD price (`ftso.getXRPUSDPrice()`)
4. **Contract validates** payment amount meets $5.00 requirement
5. **Document stored** on Flare blockchain

### **Payment Method 2: Direct FLR** 🔥
```solidity
function uploadDocumentFLR(
    bytes32 patientId,
    uint8   kind,
    string  calldata hashURI
) external payable                  // ← FLR sent with transaction
```

**How it works:**
1. **User sends 0.001 FLR** directly to contract
2. **No external verification** needed - native Flare payment
3. **Document stored** immediately
4. **Fee collected** by contract owner

## 🔧 **Bridge Components**

### **1. Flare Data Connector (FDC)** 🌐
```solidity
interface IFDC {
    function verify(bytes calldata proof, bytes32 statementId) external view returns (bool);
}
```

**Real FDC**: Verifies actual XRPL transactions
**Mock FDC** (Testing): Always returns `true`

**Location**: `E:\EasyAHackathon\contracts\MockFDC.sol`

### **2. Flare Time Series Oracle (FTSO)** 📊
```solidity
interface IFTSO {
    function getXRPUSDPrice() external view returns (uint256 price, uint8 decimals, uint256 timestamp);
}
```

**Real FTSO**: Provides live XRP/USD price data
**Mock FTSO** (Testing): Configurable price ($1.00 default)

**Location**: `E:\EasyAHackathon\contracts\MockFTSO.sol`

## 📊 **Data Flow Diagram**

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   XRP Ledger    │    │  Flare Network  │    │   IPFS Storage  │
│     (XRPL)      │    │   (Coston2)     │    │   (Documents)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
    ┌────▼────┐              ┌───▼───┐               ┌───▼───┐
    │ XRP     │    Proof     │ FDC   │   Verified    │ IPFS  │
    │ Payment │ ──────────── │ Oracle│ ───────────── │ Hash  │
    │ 5M drops│              │       │               │ Store │
    └─────────┘              └───────┘               └───────┘
         │                       │
         │                  ┌────▼────┐
         │                  │ FTSO    │
         │ ◄──────────────── │ Oracle  │
         │   Price Data     │ XRP/USD │
         │                  └─────────┘
         │
    ┌────▼─────────────────────────────────────────────────────┐
    │              SimpleMedicalVault                         │
    │  ┌─────────────────────┐  ┌─────────────────────────┐   │
    │  │   XRPL Payment      │  │    FLR Payment          │   │
    │  │   Verification      │  │    Direct               │   │
    │  │   • FDC Proof       │  │    • msg.value          │   │
    │  │   • FTSO Price      │  │    • 0.001 FLR          │   │
    │  │   • $5.00 Equiv     │  │    • Immediate          │   │
    │  └─────────────────────┘  └─────────────────────────┘   │
    └──────────────────────────────────────────────────────────┘
```

## 🔄 **Transaction Flows**

### **XRPL Payment Flow:**
1. **Off-chain**: User sends XRP payment on XRPL
2. **Proof Generation**: System creates attestation proof
3. **On-chain Verification**:
   - FDC verifies XRPL transaction occurred
   - FTSO provides current XRP/USD price
   - Contract validates payment ≥ $5.00 equivalent
4. **Document Storage**: IPFS hash stored on Flare
5. **Event Emission**: `UploadPaidXRPLXRP` event

### **FLR Payment Flow:**
1. **On-chain**: User sends 0.001 FLR with transaction
2. **Direct Validation**: Contract checks `msg.value ≥ uploadFeeWei`
3. **Document Storage**: IPFS hash stored on Flare
4. **Fee Collection**: FLR transferred to fee collector
5. **Event Emission**: `UploadPaidFLR` event

## 🎯 **Bridge Benefits**

### **For XRPL Users:**
- ✅ Pay with native XRP on XRPL
- ✅ Access Flare-based services
- ✅ No token wrapping/bridging needed
- ✅ Cryptographic proof of payment

### **For Flare Users:**
- ✅ Pay with native FLR tokens
- ✅ Direct transaction, no attestation
- ✅ Lower complexity, instant confirmation
- ✅ Perfect for dApp native users

## 🔐 **Security Model**

### **XRPL Bridge Security:**
- **FDC Attestation**: Cryptographic proof XRPL payment occurred
- **Oracle Pricing**: FTSO provides tamper-resistant price feeds
- **Staleness Protection**: Rejects old price data (10 min max)
- **Minimum Payment**: Enforces $5.00 equivalent in XRP

### **FLR Payment Security:**
- **Native Validation**: Solidity `msg.value` check
- **Immediate Settlement**: No external dependencies
- **Overflow Protection**: SafeMath operations
- **Access Control**: Owner-only configuration

## 📈 **Current Status**

### **Deployed Contracts (Coston2 Testnet):**
```
SimpleMedicalVault: 0xbaa22126E5611fC51A0218251DEbeEaCf38a6F5A
MockFDC:           0x2fA1293CCD07b99869236C931D20b32De391Ce05
MockFTSO:          0x97fE74AE376Be74dDc1B9C1E9e5097f4FD55CCA9
```

### **Payment Rates:**
- **XRPL**: 5,000,000 drops (~$5.00 at $1.00/XRP)
- **FLR**: 0.001 FLR (direct payment)

### **UI Access:**
- **Development Server**: http://localhost:5180
- **Features**: Dual payment selection, file encryption, IPFS storage

## 🚀 **Production Considerations**

### **For Mainnet Deployment:**
1. **Replace MockFDC** with real Flare Data Connector
2. **Replace MockFTSO** with real Flare Time Series Oracle
3. **Implement real XRPL** payment verification system
4. **Add governance** for fee adjustments
5. **Implement access controls** if needed

### **Bridge Limitations:**
- **One-way verification**: Only verifies XRPL→Flare services
- **No token movement**: XRP stays on XRPL, FLR stays on Flare
- **Oracle dependency**: XRPL path requires functioning oracles
- **Proof system**: Requires robust attestation infrastructure

## 🎉 **Conclusion**

This system creates a **novel attestation-based bridge** between Flare and XRPL that enables:

✅ **Cross-chain service access** without token bridging
✅ **Dual payment options** for maximum user flexibility
✅ **Cryptographic verification** of off-chain XRPL payments
✅ **Native Flare integration** for seamless dApp experience

The bridge enables XRPL users to access Flare-based services while maintaining their preferred payment method, creating a truly interoperable DeFi experience.