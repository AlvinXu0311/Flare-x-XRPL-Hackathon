# XRPL Medical Records Platform

A decentralized platform for securely sharing autism evaluations (ADOS/ADI-R) between patients and hospitals using XRPL blockchain technology.

## 🎯 Project Overview

This platform enables:
- **Patients** to upload evaluation files for **free** with NFT generation
- **Hospitals** to access evaluations for **$15** via XRPL payments
- **Secure encryption** and **blockchain verification** throughout

## 🏗️ System Architecture

### Two Core User Journeys

#### 1. Patient Upload Journey (Free)
```
Patient Portal → Upload File → Encrypt → Store in AWS S3 →
Generate File Hash → Mint Evaluation NFT on XRPL →
Store Metadata in MongoDB → Return NFT Token ID
```

#### 2. Hospital Access Journey ($15 Payment)
```
Hospital Portal → Search Evaluations → Select Evaluation →
Create Payment Intent → Pay $15 via XRPL →
Verify Payment via Flare FDC → Grant Access →
Mint Access NFT → Download Encrypted File + Key
```

## 🛠️ Tech Stack

### Frontend
- **Framework**: Vue.js 3 with Composition API
- **Language**: TypeScript/JavaScript
- **Routing**: Vue Router 4
- **State Management**: Pinia
- **UI**: Custom CSS with responsive design
- **Build Tool**: Vite

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose
- **File Storage**: AWS S3 (with local fallback)
- **Encryption**: AES-256 (crypto-js)

### Blockchain
- **Primary**: XRPL (XRP Ledger) for payments & NFTs
- **Secondary**: Flare Network for payment verification via FDC
- **Integration**: XRPL.js for wallet operations

## 🚀 Quick Start

### Option 1: One-Command Startup (Recommended)

```bash
# Using Node.js launcher (cross-platform)
npm start

# Or using Bash script (Linux/macOS)
./start.sh
```

### Option 2: Manual Setup

```bash
# Install dependencies
npm run install:all

# Setup environment
npm run setup:env

# Start services
npm run dev
```

### Option 3: Docker (Production)

```bash
# Start with Docker Compose
docker-compose up -d

# Or build and start
npm run docker:build
npm run docker:up
```

## 📋 Available Scripts

### Development
- `npm start` - Start both frontend and backend
- `npm run dev` - Same as start (development mode)
- `npm run setup` - Install dependencies and setup environment

### Building
- `npm run build` - Build both frontend and backend for production
- `npm run build:frontend` - Build frontend only
- `npm run build:backend` - Build backend only

### Testing & Quality
- `npm test` - Run all tests
- `npm run lint` - Lint all code
- `npm run clean` - Clean all node_modules

### Docker
- `npm run docker:build` - Build Docker images
- `npm run docker:up` - Start with Docker Compose
- `npm run docker:down` - Stop Docker services

## 🌐 Service URLs

After starting, the platform will be available at:

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000
- **Health Check**: http://localhost:3000/api/health
- **Blockchain Status**: http://localhost:3000/api/blockchain/health

## 📡 API Endpoints

### File Management
- `POST /api/files/upload` - Upload evaluation file
- `GET /api/files/presign` - Get S3 presigned URL
- `POST /api/files/decrypt` - Decrypt file for download

### Evaluation Reports
- `GET /api/reports` - Get all evaluations (with pagination)
- `GET /api/reports/search` - Search evaluations (hospital portal)
- `GET /api/reports/:id` - Get specific evaluation
- `POST /api/reports/:id/download` - Download evaluation file

### Access & Payment
- `POST /api/access/intents` - Create $15 payment intent
- `POST /api/access/confirm` - Confirm XRPL payment
- `GET /api/access/verify` - Verify access permissions
- `GET /api/access/history` - Get access history

### Blockchain Integration
- `POST /api/blockchain/mint-nft` - Mint evaluation NFT on XRPL
- `POST /api/blockchain/verify-tx` - Verify XRPL transaction
- `GET /api/blockchain/balance` - Get wallet balance
- `POST /api/blockchain/payment` - Send XRPL payment

### Authentication
- `POST /api/auth/hospital/register` - Hospital registration
- `POST /api/auth/hospital/login` - Hospital login
- `POST /api/auth/patient/anonymous` - Anonymous patient session

### Medical Billing
- `POST /api/billing/send` - Send medical bill to patient
- `POST /api/billing/auto-pay` - Auto-pay via insurance XRPL wallet
- `GET /api/billing` - Get billing history

## 🔧 Configuration

### Environment Variables

#### Backend (`.env`)
```env
# Server Configuration
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# Database
MONGODB_URI=mongodb://localhost:27017/xrpl-medical-records

# XRPL Blockchain
XRPL_NETWORK=wss://s.altnet.rippletest.net:51233
XRPL_TESTNET=true
PLATFORM_WALLET_SEED=your-wallet-seed

# Flare Network
FLARE_FDC_URL=https://fdc-api.flare.network
FLARE_API_KEY=your-api-key

# AWS S3
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
S3_BUCKET_NAME=xrpl-medical-records

# Security
JWT_SECRET=your-super-secure-jwt-secret
```

#### Frontend (`.env`)
```env
VITE_API_URL=http://localhost:3000
VITE_APP_NAME=XRPL Medical Records Platform
VITE_ENABLE_DEMO_MODE=true
```

## 🔐 Security Features

- **File Encryption**: AES-256-GCM encryption before storage
- **NFT Access Control**: Blockchain-based permission system
- **Dual Verification**: XRPL + Flare FDC payment validation
- **JWT Authentication**: Secure hospital & patient sessions
- **Input Validation**: Comprehensive request sanitization
- **Rate Limiting**: API protection against abuse

## 📊 Features

### Patient Portal
- ✅ Drag-and-drop file upload
- ✅ Patient information form
- ✅ File encryption and NFT minting
- ✅ Progress tracking
- ✅ NFT Token ID for sharing

### Hospital Portal
- ✅ Advanced evaluation search
- ✅ $15 XRPL payment system
- ✅ Access history tracking
- ✅ Secure file downloads
- ✅ 30-day access expiry

### Blockchain Integration
- ✅ XRPL NFT minting for evaluations
- ✅ Payment verification via Flare FDC
- ✅ Access NFT for hospital permissions
- ✅ Real-time transaction monitoring

## 🐛 Troubleshooting

### Common Issues

1. **Services won't start**
   ```bash
   # Kill existing processes
   pkill -f "node"
   pkill -f "npm"

   # Restart
   npm start
   ```

2. **MongoDB connection failed**
   ```bash
   # Install and start MongoDB
   brew install mongodb-community  # macOS
   sudo systemctl start mongod     # Linux

   # Or use Docker
   docker run -d -p 27017:27017 mongo
   ```

3. **Port already in use**
   ```bash
   # Find and kill process on port
   lsof -ti :3000 | xargs kill -9  # Backend
   lsof -ti :5173 | xargs kill -9  # Frontend
   ```

4. **XRPL connection issues**
   - Check your internet connection
   - Verify XRPL testnet is accessible
   - Check firewall settings

### Logs

View real-time logs:
```bash
# Both services
tail -f backend.log frontend.log

# Individual services
tail -f backend.log
tail -f frontend.log
```

## 📝 Development

### Project Structure
```
xrpl-medical-platform/
├── frontend/                 # Vue.js frontend
│   ├── src/
│   │   ├── views/           # Page components
│   │   ├── router/          # Vue Router config
│   │   ├── services/        # API services
│   │   └── utils/           # Utility functions
├── backend/                 # Node.js backend
│   ├── models/              # MongoDB models
│   ├── routes/              # API routes
│   ├── services/            # Business logic
│   └── uploads/             # Local file storage
├── scripts/                 # Utility scripts
├── docker/                  # Docker configuration
├── start.js                 # Node.js launcher
├── start.sh                 # Bash launcher
└── docker-compose.yml       # Docker services
```

### Adding New Features

1. **Backend API**: Add routes in `backend/routes/`
2. **Frontend Pages**: Add components in `frontend/src/views/`
3. **Database Models**: Add schemas in `backend/models/`
4. **Services**: Add business logic in `backend/services/`

## 🚀 Deployment

### Production Deployment

1. **Environment Setup**
   ```bash
   # Production environment
   NODE_ENV=production
   MONGODB_URI=mongodb://your-production-db
   AWS_ACCESS_KEY_ID=your-production-key
   ```

2. **Build Application**
   ```bash
   npm run build
   ```

3. **Deploy with Docker**
   ```bash
   docker-compose -f docker-compose.yml up -d
   ```

### Cloud Providers

- **AWS**: Use ECS/Fargate with RDS MongoDB
- **Google Cloud**: Use Cloud Run with MongoDB Atlas
- **Azure**: Use Container Instances with Cosmos DB
- **Railway/Render**: Direct deployment support

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/new-feature`
3. Commit changes: `git commit -am 'Add new feature'`
4. Push to branch: `git push origin feature/new-feature`
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: Check this README and inline code comments
- **Issues**: Report bugs and feature requests on GitHub
- **Community**: Join our Discord/Telegram for discussions

## 🎉 Acknowledgments

- XRPL Foundation for blockchain infrastructure
- Flare Network for payment verification
- Vue.js and Node.js communities
- Contributors and beta testers

---

**🚀 Ready to revolutionize medical record sharing with blockchain technology!**