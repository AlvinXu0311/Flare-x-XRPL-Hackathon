# 🏥 Medical Vault - Decentralized Medical Records

A **fully decentralized** medical records management system built on **Flare Network** with **IPFS** storage. This application ensures that medical data remains accessible even if centralized services fail.

## 🌐 **Fully Decentralized Architecture**

```
┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│   Browser Client    │    │   IPFS Network      │    │   Flare Blockchain  │
│   (Self-Contained)  │◄──►│   (Distributed)     │◄──►│   (Immutable)       │
└─────────────────────┘    └─────────────────────┘    └─────────────────────┘
           │                         │                           │
           ▼                         ▼                           ▼
┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│   Local Storage     │    │   Multiple Gateways │    │   Smart Contract    │
│   (Browser Index)   │    │   & Public Nodes    │    │   (Metadata)        │
└─────────────────────┘    └─────────────────────┘    └─────────────────────┘
```

## ✨ **Key Features**

### 🔒 **True Decentralization**
- **No Backend Required** - Runs entirely in browser
- **IPFS Storage** - Files distributed across global network
- **Blockchain Metadata** - Immutable record on Flare Network
- **Multiple Access Points** - Available via any IPFS gateway
- **Simple Interface** - Upload documents, download documents, and hospital portal

### 🛡️ **Security & Privacy**
- **Client-Side Encryption** - AES-256-GCM encryption in browser
- **Wallet Authentication** - MetaMask signature-based login
- **Zero-Knowledge Storage** - Files encrypted before leaving device
- **Access Control** - Smart contract-enforced permissions

### 🌍 **Censorship Resistant**
- **Cannot be taken down** - Distributed across thousands of nodes
- **Multiple gateways** - Accessible from anywhere
- **Permanent storage** - Content-addressed files never disappear
- **Self-sovereign** - Users own their data completely

## 🚀 **Quick Start**

### **1. Deploy Decentralized Version**
```bash
# Clone the repository
git clone https://github.com/your-org/medical-vault.git
cd Flare-x-XRPL-Hackathon

# Deploy to IPFS (fully decentralized)
./deploy.sh --frontend-only

# Your app is now accessible via:
# - ipfs://[hash]
# - https://ipfs.io/ipfs/[hash]
# - Any IPFS gateway
```

### **2. Local Development**
```bash
# Frontend (Vue.js)
cd medical-vault-ui
npm install
npm run dev

# Backend (Optional - for hybrid mode)
cd medical-vault-backend
npm install
npm run dev
```

### **3. Access Your Files Forever**
Even if this website goes down, your files remain accessible:

```bash
# Via IPFS CLI
ipfs cat [YOUR_FILE_CID] > medical_document.bin

# Via any public gateway
curl https://ipfs.io/ipfs/[YOUR_FILE_CID] > medical_document.bin

# Via IPFS Desktop (GUI)
# Download from: https://github.com/ipfs/ipfs-desktop
```

## 📦 **Deployment Options**

### **Option 1: Fully Decentralized (Recommended)**
```bash
./deploy.sh --frontend-only
```
- ✅ Zero servers required
- ✅ Censorship resistant
- ✅ Always available
- ✅ No hosting costs

### **Option 2: Hybrid Mode**
```bash
./deploy.sh --full-stack
```
- Frontend on IPFS/CDN
- Optional backend for enhanced features
- Graceful degradation if backend fails

### **Option 3: Traditional Hosting**
- Deploy frontend to Netlify, Vercel, etc.
- Deploy backend to cloud providers
- Standard web application deployment

## 🛠️ **Technology Stack**

### **Frontend**
- **Vue.js 3** - Reactive UI framework
- **TypeScript** - Type-safe development
- **Ethers.js** - Blockchain interaction
- **IPFS** - Decentralized file storage
- **Web Crypto API** - Client-side encryption

### **Backend (Optional)**
- **Node.js** - Runtime environment
- **Express** - Web framework
- **PostgreSQL** - Relational database
- **Sequelize** - ORM for database operations
- **Redis** - Caching layer

### **Blockchain**
- **Flare Network** - Smart contract platform
- **Solidity** - Smart contract language
- **MetaMask** - Wallet integration

## 📋 **Smart Contract Features**

### **Document Management**
- Upload document metadata to blockchain
- Version control for medical records
- Immutable audit trail
- Gas-efficient storage design

### **Access Control**
- Role-based permissions (Patient, Guardian, Doctor, Insurer)
- Granular access controls
- Revocable permissions
- Emergency access procedures

### **Payment Integration**
- Pay-per-upload model
- Support for multiple currencies
- Automatic fee deduction
- Transparent pricing

## 🔧 **Configuration**

### **Environment Variables**
```env
# Frontend (.env)
VITE_VAULT_ADDRESS=0x6cd4FEb053E613dF60CF10f0DD1D9597051D241B
VITE_CHAIN_ID=114
VITE_RPC_URL=https://rpc-coston2.flare.network

# Backend (.env) - Optional
DATABASE_URL=postgresql://user:pass@host:5432/db
CONTRACT_ADDRESS=0x...
PRIVATE_KEY=0x...
JWT_SECRET=your-secret
```

### **Smart Contract Deployment**
```bash
# Deploy to Flare Coston2 Testnet
npx hardhat run scripts/deploy.js --network coston2

# Deploy to Flare Mainnet
npx hardhat run scripts/deploy.js --network flare
```

## 📚 **Usage Guide**

### **For Patients**
1. **Connect Wallet** - Use MetaMask or compatible wallet
2. **Upload Documents** - Encrypt and store medical records
3. **Download Documents** - Retrieve and decrypt your medical records
4. **Hospital Portal** - Access specialized hospital interface

### **For Healthcare Providers**
1. **Register** - Create provider account with credentials
2. **Request Access** - Ask patients for record permissions
3. **View Records** - Access permitted medical documents
4. **Upload Reports** - Add new medical documents

### **For Developers**
1. **Clone Repository** - Get the source code
2. **Deploy Contract** - Deploy to Flare Network
3. **Configure Environment** - Set up environment variables
4. **Customize Frontend** - Modify UI for your needs

## 🔍 **Security Considerations**

### **Client-Side Security**
- Files encrypted before upload
- Private keys never leave browser
- Secure random number generation
- Protection against XSS attacks

### **Smart Contract Security**
- Access control modifiers
- Reentrancy protection
- Integer overflow protection
- Emergency pause functionality

### **IPFS Security**
- Content addressing prevents tampering
- Encryption provides privacy
- Pinning ensures availability
- Multiple gateway redundancy

## 🆘 **Emergency Access**

If the Medical Vault website becomes unavailable:

### **Method 1: IPFS Desktop**
1. Download IPFS Desktop from GitHub
2. Install and start IPFS node
3. Access files via CID: `ipfs://[your-file-cid]`

### **Method 2: Public Gateways**
- `https://ipfs.io/ipfs/[cid]`
- `https://cloudflare-ipfs.com/ipfs/[cid]`
- `https://gateway.pinata.cloud/ipfs/[cid]`

### **Method 3: Command Line**
```bash
# Install IPFS CLI
curl -sSL https://dist.ipfs.io/go-ipfs/v0.17.0/go-ipfs_v0.17.0_linux-amd64.tar.gz | tar -xz
sudo mv go-ipfs/ipfs /usr/local/bin/

# Access your files
ipfs cat [YOUR_FILE_CID] > encrypted_document.bin
```

### **Method 4: Alternative Domains**
The application can be hosted on any domain or accessed via:
- IPFS hash directly
- Mirror sites
- Local installation

## 🤝 **Contributing**

We welcome contributions to make Medical Vault more decentralized and secure!

### **Development Setup**
```bash
# Clone repository
git clone https://github.com/your-org/medical-vault.git
cd Flare-x-XRPL-Hackathon

# Install dependencies
cd medical-vault-ui && npm install
cd ../medical-vault-backend && npm install

# Start development servers
npm run dev  # Start both frontend and backend
```

### **Contribution Guidelines**
1. Fork the repository
2. Create feature branch
3. Make your changes
4. Add tests for new features
5. Submit pull request

## 📄 **License**

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 **Important Links**

- **Live Application**: [https://medical-vault.app](https://medical-vault.app)
- **IPFS Version**: `ipfs://[deployment-hash]`
- **Smart Contract**: `0x6cd4FEb053E613dF60CF10f0DD1D9597051D241B`
- **Documentation**: [Deployment Guide](DEPLOYMENT.md)
- **Decentralization**: [Full Strategy](DECENTRALIZATION.md)

## ⚠️ **Disclaimer**

This is a demonstration project for educational purposes. For production medical applications:

- Ensure compliance with healthcare regulations (HIPAA, GDPR, etc.)
- Conduct thorough security audits
- Implement proper backup and recovery procedures
- Consider legal implications of decentralized storage

## 🆘 **Support**

- **Issues**: [GitHub Issues](https://github.com/your-org/medical-vault/issues)
- **Documentation**: Check the `/docs` folder
- **Community**: Join our Discord/Telegram
- **Email**: support@medical-vault.app

---

**🌐 Built for a decentralized future where users own their data.**