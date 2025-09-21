# Medical Vault Backend (Optional)

A **optional** backend API for the Medical Vault application. This backend is **not required** for the decentralized version but provides enhanced features for hybrid deployments.

## ⚠️ **Important Note**

The **fully decentralized** version of Medical Vault runs entirely in the browser without any backend. This backend is only needed if you want:

- Enhanced performance through caching
- Centralized user management
- Advanced analytics and reporting
- Integration with existing healthcare systems

## Features

- **Secure Document Storage**: Files encrypted and stored on IPFS
- **Blockchain Integration**: Document metadata stored on Flare Network smart contracts
- **Role-based Access Control**: Guardian, psychologist, insurer, and admin roles
- **RESTful API**: Comprehensive endpoints for all operations
- **Database Persistence**: PostgreSQL for relational data storage
- **Authentication**: JWT-based auth with wallet signature support
- **Health Monitoring**: Built-in health checks and monitoring

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 13+ (optional)
- Redis 6+ (optional)

### Installation

1. **Clone and setup**:
   ```bash
   cd medical-vault-backend
   npm install
   ```

2. **Environment Configuration**:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Database Setup** (Optional):
   ```bash
   # Run migrations
   npm run db:migrate

   # Seed data (optional)
   npm run db:seed
   ```

4. **Start Development Server**:
   ```bash
   npm run dev
   ```

## Configuration

### Required Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:pass@host:5432/db

# Blockchain
RPC_URL=https://rpc-coston2.flare.network
CONTRACT_ADDRESS=0x...
PRIVATE_KEY=0x...

# Security
JWT_SECRET=your-jwt-secret
ENCRYPTION_KEY=your-32-byte-key

# IPFS
IPFS_HOST=localhost
IPFS_PORT=5001
```

## API Endpoints

### Authentication
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login/wallet` - Login with wallet signature
- `GET /api/v1/auth/profile` - Get user profile
- `PUT /api/v1/auth/profile` - Update profile

### Documents
- `POST /api/v1/documents/upload` - Upload medical document
- `GET /api/v1/documents/:id` - Get document metadata
- `GET /api/v1/documents/:id/download` - Download document
- `GET /api/v1/documents/patient/:patientId` - List patient documents

### Patients
- `POST /api/v1/patients` - Create patient (Admin)
- `GET /api/v1/patients/:patientId` - Get patient info
- `PUT /api/v1/patients/:patientId` - Update patient
- `POST /api/v1/patients/:patientId/roles/guardian` - Set guardian

### Blockchain
- `POST /api/v1/blockchain/upload` - Upload to blockchain
- `GET /api/v1/blockchain/document/:patientId/:type` - Get from blockchain
- `POST /api/v1/blockchain/access/grant` - Grant access
- `GET /api/v1/blockchain/access/check/:patientId/:address` - Check permissions

### Health
- `GET /api/v1/health` - Basic health check
- `GET /api/v1/health/detailed` - Detailed service status

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend API   │    │   Blockchain    │
│   (Vue.js)      │◄──►│   (Node.js)     │◄──►│   (Flare)       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │                         │
                              ▼                         ▼
                       ┌─────────────┐        ┌─────────────────┐
                       │ PostgreSQL  │        │      IPFS       │
                       │ (Metadata)  │        │ (File Storage)  │
                       └─────────────┘        └─────────────────┘
```

## Security Features

- **End-to-end Encryption**: Files encrypted before IPFS storage
- **Wallet Authentication**: Secure signature-based login
- **Role-based Access**: Granular permission system
- **Audit Logging**: Complete access audit trail
- **Rate Limiting**: API protection against abuse
- **Input Validation**: Comprehensive request validation

## Development

### Scripts
```bash
npm run dev          # Start development server
npm run start        # Start production server
npm run test         # Run tests
npm run lint         # Lint code
npm run db:migrate   # Run database migrations
npm run db:seed      # Seed database
```

### Database Schema

- **Users**: Authentication and profile data
- **Patients**: Patient information and roles
- **Documents**: Document metadata and status
- **AccessLogs**: Complete audit trail

## Deployment

### Production Environment

1. **Set environment variables**:
   ```bash
   NODE_ENV=production
   DATABASE_URL=postgresql://...
   RPC_URL=https://flare-api.flare.network/ext/bc/C/rpc
   ```

2. **Build and deploy**:
   ```bash
   npm run build
   npm start
   ```

### Kubernetes Support

Health check endpoints are provided for Kubernetes:
- `/api/v1/health/ready` - Readiness probe
- `/api/v1/health/live` - Liveness probe

## Monitoring

### Logs
- Application logs: `./logs/medical-vault.log`
- Error logs: `./logs/error.log`
- Access logs: HTTP requests and responses

### Metrics
- Database connection status
- IPFS node health
- Blockchain connectivity
- API response times

## Contributing

1. Fork the repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Create Pull Request

## License

MIT License - see LICENSE file for details