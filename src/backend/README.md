# XRPL Medical Records Platform

A simple, secure medical records platform built on XRPL with real NFT minting capabilities.

## 🚀 Quick Start

```bash
# Make sure you're in the backend directory
cd backend

# Run the startup script
./start.sh
```

That's it! The script will:
- Check dependencies
- Generate XRPL wallet if needed
- Install packages
- Start the server

## 📋 Features

- ✅ **Real XRPL NFT Minting** - Creates actual NFTs on XRPL testnet
- 🔐 **File Encryption** - AES-256-GCM encryption for all files
- 🏥 **Hospital Access** - Token-based file discovery for hospitals
- 📁 **Local/S3 Storage** - Flexible storage options
- 🧪 **Comprehensive Tests** - Full test suite included

## 🔧 Configuration

### Required (Automatic)
- **XRPL Wallet** - Auto-generated on first run
- **File Storage** - Local storage by default

### Optional
- **AWS S3** - For cloud storage
- **MongoDB** - For database (uses local files by default)
- **Flare Network** - For advanced cross-chain features

## 📊 API Endpoints

### File Operations
- `POST /api/files/upload` - Upload medical file (creates NFT)
- `POST /api/files/decrypt` - Decrypt and download file
- `GET /api/files/info/:evaluationId` - Get file information

### Hospital Discovery
- `GET /api/files/hospital/registry` - Browse available records
- `POST /api/files/hospital/discover` - Find file by evaluation ID
- `POST /api/files/hospital/verify-file` - Verify file integrity

### Health Check
- `GET /api/files/health` - Check service status

## 🧪 Testing

```bash
# Run all tests
npm test

# Test file upload
curl -X POST \
  -F "file=@test.pdf" \
  -F 'patientInfo={"firstName":"John","lastName":"Doe","dateOfBirth":"1990-01-01","evaluationType":"routine"}' \
  http://localhost:3000/api/files/upload
```

## 💰 Funding Your Wallet

To enable real NFT minting:

1. **Check your wallet address** (shown when starting server)
2. **Visit XRPL Testnet Faucet**: https://xrpl.org/xrp-testnet-faucet.html
3. **Send 1000 XRP** to your address
4. **Restart server** - NFTs will now mint on XRPL!

## 🏥 For Hospitals

Use the public registry to discover medical records:

```bash
# Browse all available records
curl http://localhost:3000/api/files/hospital/registry

# Request access to specific evaluation
curl -X POST http://localhost:3000/api/files/hospital/discover \
  -H "Content-Type: application/json" \
  -d '{"hospitalAddress":"0xYourAddress","evaluationId":"uuid-here"}'
```

## 📁 Project Structure

```
backend/
├── start.sh              # Simple startup script
├── server.js             # Main server file
├── services/
│   ├── encryptionService.js   # File encryption
│   ├── xrplService.js         # XRPL NFT minting
│   └── flareRegistryService.js # Cross-chain features
├── routes/
│   ├── files.js           # File upload/download APIs
│   └── ...
├── tests/
│   └── encryptionService.test.js # Test suite
└── data/                  # Local storage (auto-created)
```

## 🔒 Security

- **AES-256-GCM** encryption for all files
- **SHA256** file integrity hashing
- **XRPL NFT** ownership verification
- **Token-based** hospital access control
- **No patient PII** exposed in public APIs

## 🌍 Open Source

This platform is designed to be:
- **Interoperable** - Standard APIs for any healthcare system
- **Decentralized** - Built on XRPL blockchain
- **Extensible** - Easy to add new features
- **Transparent** - Open source for community review

## 🆘 Troubleshooting

### Common Issues

**NFT shows "DEMO_NFT"**
- Fund your XRPL wallet with testnet XRP

**Server won't start**
- Run `./start.sh` - it handles dependencies

**File upload fails**
- Check server logs for specific errors
- Ensure disk space available

**XRPL connection issues**
- Check internet connection
- Verify wallet seed in .env file

## 📞 Support

- Check server health: `curl http://localhost:3000/api/files/health`
- View logs: Server output shows detailed status
- Test connectivity: XRPL and services status in health endpoint

## 🎯 Next Steps

1. **Test basic upload** with the provided scripts
2. **Fund wallet** for real NFT minting
3. **Integrate with frontend** using the API endpoints
4. **Add hospitals** to the registry system
5. **Deploy to production** when ready

The platform is ready to use out of the box! 🎉