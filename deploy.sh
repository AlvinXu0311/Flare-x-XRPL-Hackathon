#!/bin/bash

# Medical Vault Deployment Script
# This script deploys the decentralized Medical Vault application

set -e

echo "🏥 Medical Vault Deployment Script"
echo "=================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
FRONTEND_DIR="medical-vault-ui"
BACKEND_DIR="medical-vault-backend"
DIST_DIR="dist"
BUILD_DIR="build"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if required tools are installed
check_dependencies() {
    print_status "Checking dependencies..."

    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js 18+ and try again."
        exit 1
    fi

    # Check npm
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed. Please install npm and try again."
        exit 1
    fi

    # Check if IPFS CLI is available (optional)
    if command -v ipfs &> /dev/null; then
        print_success "IPFS CLI found - will be used for deployment"
        IPFS_AVAILABLE=true
    else
        print_warning "IPFS CLI not found - will deploy to traditional hosting only"
        IPFS_AVAILABLE=false
    fi

    print_success "Dependencies check passed"
}

# Deploy frontend only (decentralized mode)
deploy_frontend_only() {
    print_status "Deploying frontend in decentralized mode..."

    cd "$FRONTEND_DIR"

    # Install dependencies
    print_status "Installing frontend dependencies..."
    npm install

    # Build the application
    print_status "Building frontend application..."
    npm run build

    # Check if build was successful
    if [ ! -d "$DIST_DIR" ]; then
        print_error "Build failed - dist directory not found"
        exit 1
    fi

    print_success "Frontend built successfully"

    # Deploy to IPFS if available
    if [ "$IPFS_AVAILABLE" = true ]; then
        deploy_to_ipfs
    fi

    # Deploy to traditional hosting
    deploy_to_hosting

    cd ..
}

# Deploy to IPFS network
deploy_to_ipfs() {
    print_status "Deploying to IPFS network..."

    # Add to IPFS
    IPFS_HASH=$(ipfs add -r -Q "$DIST_DIR")

    if [ $? -eq 0 ]; then
        print_success "Successfully deployed to IPFS!"
        echo ""
        echo "🌐 IPFS Deployment URLs:"
        echo "   - ipfs://$IPFS_HASH"
        echo "   - https://ipfs.io/ipfs/$IPFS_HASH"
        echo "   - https://gateway.pinata.cloud/ipfs/$IPFS_HASH"
        echo "   - https://cloudflare-ipfs.com/ipfs/$IPFS_HASH"
        echo ""

        # Pin to local node
        ipfs pin add "$IPFS_HASH" 2>/dev/null || print_warning "Could not pin to local IPFS node"

        # Create a shareable link file
        echo "ipfs://$IPFS_HASH" > "../IPFS_DEPLOYMENT.txt"
        echo "https://ipfs.io/ipfs/$IPFS_HASH" >> "../IPFS_DEPLOYMENT.txt"

        print_success "IPFS deployment complete - URLs saved to IPFS_DEPLOYMENT.txt"
    else
        print_error "IPFS deployment failed"
    fi
}

# Deploy to traditional hosting (Netlify, Vercel, etc.)
deploy_to_hosting() {
    print_status "Preparing for traditional hosting deployment..."

    # Create deployment package
    cd "$DIST_DIR"
    tar -czf "../medical-vault-frontend.tar.gz" .
    cd ..

    print_success "Frontend package created: medical-vault-frontend.tar.gz"

    echo ""
    echo "📦 Traditional Hosting Deployment:"
    echo "   1. Upload medical-vault-frontend.tar.gz to your hosting provider"
    echo "   2. Extract the contents to your web root directory"
    echo "   3. Configure your domain to point to the extracted files"
    echo ""
    echo "🔧 Recommended Hosting Providers:"
    echo "   - Netlify: drag and drop the dist/ folder"
    echo "   - Vercel: connect your GitHub repository"
    echo "   - GitHub Pages: push dist/ contents to gh-pages branch"
    echo "   - Cloudflare Pages: connect your repository"
    echo ""
}

# Deploy backend (optional for hybrid mode)
deploy_backend() {
    print_status "Deploying backend API server..."

    cd "$BACKEND_DIR"

    # Install dependencies
    print_status "Installing backend dependencies..."
    npm install --production

    # Run linting
    print_status "Running code quality checks..."
    npm run lint || print_warning "Linting issues found"

    # Create production build info
    echo "{
  \"version\": \"$(npm pkg get version | tr -d '\"')\",
  \"buildDate\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
  \"nodeVersion\": \"$(node --version)\",
  \"platform\": \"$(uname -s)\",
  \"mode\": \"production\"
}" > build-info.json

    print_success "Backend prepared for deployment"

    echo ""
    echo "🚀 Backend Deployment Options:"
    echo "   1. PM2: pm2 start src/server.js --name medical-vault-api"
    echo "   2. Systemd: create a service file for your backend"
    echo "   3. Cloud: deploy to Heroku, Railway, or similar"
    echo "   4. VPS: run with 'npm start' behind a reverse proxy"
    echo ""
    echo "📋 Required Environment Variables:"
    echo "   - NODE_ENV=production"
    echo "   - DATABASE_URL=postgresql://..."
    echo "   - CONTRACT_ADDRESS=0x..."
    echo "   - PRIVATE_KEY=0x..."
    echo "   - JWT_SECRET=your-secret"
    echo ""

    cd ..
}

# Create environment template
create_env_template() {
    print_status "Creating environment template..."

    cat > ".env.production.example" << 'EOF'
# Production Environment Configuration
# Copy this file to .env and fill in your values

# Frontend Configuration (medical-vault-ui/.env)
VITE_VAULT_ADDRESS=0x6cd4FEb053E613dF60CF10f0DD1D9597051D241B
VITE_CHAIN_ID=114
VITE_RPC_URL=https://rpc-coston2.flare.network
VITE_IPFS_GATEWAY=https://ipfs.io
VITE_APP_MODE=decentralized

# Backend Configuration (medical-vault-backend/.env) - Optional for hybrid mode
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://user:pass@host:5432/medical_vault_db
CONTRACT_ADDRESS=0x6cd4FEb053E613dF60CF10f0DD1D9597051D241B
PRIVATE_KEY=0x...your-private-key
JWT_SECRET=your-super-secure-jwt-secret
ENCRYPTION_KEY=your-32-byte-encryption-key
RPC_URL=https://rpc-coston2.flare.network
IPFS_HOST=localhost
IPFS_PORT=5001
EOF

    print_success "Environment template created: .env.production.example"
}

# Generate deployment documentation
create_deployment_docs() {
    print_status "Generating deployment documentation..."

    cat > "DEPLOYMENT.md" << 'EOF'
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
EOF

    print_success "Deployment documentation created: DEPLOYMENT.md"
}

# Show deployment summary
show_summary() {
    echo ""
    echo "🎉 Deployment Complete!"
    echo "======================"
    echo ""
    echo "📁 Generated Files:"
    [ -f "medical-vault-frontend.tar.gz" ] && echo "   ✅ medical-vault-frontend.tar.gz (traditional hosting)"
    [ -f "IPFS_DEPLOYMENT.txt" ] && echo "   ✅ IPFS_DEPLOYMENT.txt (decentralized URLs)"
    [ -f ".env.production.example" ] && echo "   ✅ .env.production.example (configuration template)"
    [ -f "DEPLOYMENT.md" ] && echo "   ✅ DEPLOYMENT.md (deployment guide)"
    echo ""

    if [ "$IPFS_AVAILABLE" = true ] && [ -f "IPFS_DEPLOYMENT.txt" ]; then
        echo "🌐 Decentralized Access URLs:"
        cat IPFS_DEPLOYMENT.txt | sed 's/^/   /'
        echo ""
    fi

    echo "📋 Next Steps:"
    echo "   1. Configure your environment variables"
    echo "   2. Deploy to your preferred hosting platform"
    echo "   3. Test the application thoroughly"
    echo "   4. Share the access URLs with users"
    echo ""
    echo "🔗 For detailed instructions, see DEPLOYMENT.md"
}

# Main deployment logic
main() {
    echo ""

    # Parse command line arguments
    FRONTEND_ONLY=false
    FULL_STACK=false

    while [[ $# -gt 0 ]]; do
        case $1 in
            --frontend-only)
                FRONTEND_ONLY=true
                shift
                ;;
            --full-stack)
                FULL_STACK=true
                shift
                ;;
            --help)
                echo "Usage: $0 [OPTIONS]"
                echo "Options:"
                echo "  --frontend-only    Deploy only the frontend (decentralized mode)"
                echo "  --full-stack       Deploy both frontend and backend"
                echo "  --help            Show this help message"
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                echo "Use --help for usage information"
                exit 1
                ;;
        esac
    done

    # Default to frontend-only if no option specified
    if [ "$FRONTEND_ONLY" = false ] && [ "$FULL_STACK" = false ]; then
        print_status "No deployment mode specified, defaulting to frontend-only (decentralized)"
        FRONTEND_ONLY=true
    fi

    # Check dependencies
    check_dependencies

    # Create environment template
    create_env_template

    # Deploy based on selected mode
    if [ "$FRONTEND_ONLY" = true ]; then
        deploy_frontend_only
    fi

    if [ "$FULL_STACK" = true ]; then
        deploy_frontend_only
        deploy_backend
    fi

    # Create deployment documentation
    create_deployment_docs

    # Show summary
    show_summary
}

# Run main function with all arguments
main "$@"