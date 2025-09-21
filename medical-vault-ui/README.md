# Medical Vault UI

A Vue.js frontend application for the Medical Record Vault smart contract on the Flare Network (Coston2 testnet).

## Features

- **MetaMask Integration**: Connect your wallet and switch to Coston2 network
- **Network Verification**: Automatically detects and prompts to switch to Coston2 (Chain ID 114)
- **Document Retrieval**: Fetch medical document metadata using MRN and salt
- **Document Types**: Support for Diagnosis, Referral, and Intake documents
- **IPFS Integration**: Convert IPFS hashes to viewable gateway URLs
- **Payment Tracking**: Display payment information (FLR, USD, XRP)
- **Error Handling**: Comprehensive error messages and loading states

## Setup

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Configure Environment**:
   Set the contract address in `.env`:
   ```
   VITE_VAULT_ADDRESS=0x... # Your deployed contract address
   VITE_COSTON2_RPC=https://rpc-coston2.flare.network
   VITE_COSTON2_CHAIN_ID=114
   ```

3. **Run Development Server**:
   ```bash
   npm run dev
   ```

## Usage

1. **Connect Wallet**: Click "Connect MetaMask" and approve the connection
2. **Switch Network**: If not on Coston2, click "Switch to Coston2"
3. **Enter Details**:
   - Medical Record Number (MRN)
   - Salt value (used for privacy)
   - Document type (Diagnosis/Referral/Intake)
4. **Fetch Document**: Click "Fetch Document" to retrieve metadata
5. **View Document**: If available, click "View Document" to open the IPFS link

## Document Types

- **Diagnosis (0)**: Diagnosis Letter
- **Referral (1)**: Referral documents
- **Intake (2)**: Intake forms

## Privacy & Security

- Patient IDs are generated using `keccak256(MRN|salt)` for privacy
- Documents are stored off-chain (IPFS) with only metadata on-chain
- All document content should be encrypted before upload

## Network Configuration

- **Network**: Coston2 (Flare Testnet)
- **Chain ID**: 114
- **RPC URL**: https://rpc-coston2.flare.network
- **Currency**: C2FLR (Coston2 Flare)
- **Explorer**: https://coston2.flare.network/

## Smart Contract Interface

The application interacts with the `MedicalRecordVaultXRPL` contract using the following key functions:

- `getDocMeta(patientId, kind)`: Fetch document metadata
- `getRoles(patientId)`: Get guardian, psychologist, and insurer addresses
- `hasRead(patientId, address)`: Check read permissions

## Development

Built with:
- Vue 3 with Composition API
- TypeScript
- Ethers.js for blockchain interaction
- Vite for build tooling

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Type-Check, Compile and Minify for Production

```sh
npm run build
```

### Run Unit Tests with [Vitest](https://vitest.dev/)

```sh
npm run test:unit
```

### Lint with [ESLint](https://eslint.org/)

```sh
npm run lint
```
