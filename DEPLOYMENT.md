# Medical Vault Deployment Guide

## Quick Start

### Decentralized Frontend Only (Recommended)
```bash
./deploy.sh --frontend-only
```

### Full Stack (Frontend + Backend)
```bash
./deploy.sh --full-stack
```

## Deployment Options

### 1. Fully Decentralized (IPFS + Blockchain)
- ✅ No servers required
- ✅ Censorship resistant
- ✅ Always available
- ✅ Zero hosting costs

**Steps:**
1. Build frontend: `cd medical-vault-ui && npm run build`
2. Deploy to IPFS: `ipfs add -r dist/`
3. Share IPFS hash with users
4. Users access via: `ipfs://[hash]` or public gateways

### 2. Hybrid (Frontend + Optional Backend)
- Frontend on CDN/hosting
- Backend for enhanced features
- Graceful degradation if backend fails

### 3. Traditional Hosting
- Standard web hosting
- Domain pointing to frontend
- Backend on separate server/service

## Environment Setup

1. Copy `.env.production.example` to `.env`
2. Fill in your configuration values
3. Deploy using the deployment script

## IPFS Deployment

Your app is deployed to IPFS at:
- **IPFS Native:** `ipfs://[hash]`
- **Public Gateway:** `https://ipfs.io/ipfs/[hash]`
- **Cloudflare:** `https://cloudflare-ipfs.com/ipfs/[hash]`

## Production Checklist

- [ ] Smart contract deployed to Flare Network
- [ ] Environment variables configured
- [ ] SSL certificate configured (if using traditional hosting)
- [ ] Backup strategy for IPFS pinning
- [ ] Monitoring setup
- [ ] Domain configured

## Support

For deployment issues, check:
1. Build logs for errors
2. Environment variable configuration
3. Network connectivity to IPFS and blockchain
4. Browser console for client-side errors
