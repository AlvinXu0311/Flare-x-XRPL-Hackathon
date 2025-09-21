#!/bin/bash

# Medical Vault - Initial Setup Script
# This script sets up the Medical Vault project for first-time use

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

print_header() {
    echo -e "${GREEN}"
    echo "=================================================="
    echo "🔧 Medical Vault - Initial Setup"
    echo "=================================================="
    echo -e "${NC}"
}

check_prerequisites() {
    print_status "Checking prerequisites..."

    if ! command -v node >/dev/null 2>&1; then
        print_error "Node.js is not installed!"
        print_error "Please install Node.js (v16 or higher) from: https://nodejs.org/"
        exit 1
    fi

    if ! command -v npm >/dev/null 2>&1; then
        print_error "npm is not installed!"
        print_error "Please install npm (usually comes with Node.js)"
        exit 1
    fi

    local node_version=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$node_version" -lt 16 ]; then
        print_warning "Node.js version is $node_version. Recommended: 16 or higher"
    fi

    print_success "Prerequisites check passed!"
}

setup_environment() {
    print_status "Setting up environment files..."

    # Create .env file if it doesn't exist
    if [ ! -f "medical-vault-ui/.env" ]; then
        print_status "Creating .env file..."
        cat > medical-vault-ui/.env << EOF
# Medical Vault Configuration
VITE_VAULT_ADDRESS=0x6cd4FEb053E613dF60CF10f0DD1D9597051D241B
VITE_COSTON2_RPC=https://rpc-coston2.flare.network
VITE_COSTON2_CHAIN_ID=114
EOF
        print_success "Created .env file with default configuration"
    else
        print_success ".env file already exists"
    fi
}

install_dependencies() {
    print_status "Installing frontend dependencies..."

    cd medical-vault-ui

    if [ -f "package-lock.json" ]; then
        npm ci
    else
        npm install
    fi

    print_success "Frontend dependencies installed!"
    cd ..
}

setup_permissions() {
    print_status "Setting up script permissions..."

    chmod +x start-medical-vault.sh
    chmod +x stop-medical-vault.sh
    chmod +x setup-medical-vault.sh

    print_success "Script permissions configured!"
}

show_completion_info() {
    echo -e "${GREEN}"
    echo "=================================================="
    echo "✅ Medical Vault Setup Complete!"
    echo "=================================================="
    echo -e "${NC}"
    echo
    echo "📁 Project Structure:"
    echo "   📂 medical-vault-ui/          - Vue.js frontend application"
    echo "   📂 contracts/                 - Smart contracts"
    echo "   📄 start-medical-vault.sh     - Start all services"
    echo "   📄 stop-medical-vault.sh      - Stop all services"
    echo "   📄 setup-medical-vault.sh     - This setup script"
    echo
    echo "🚀 Quick Start:"
    echo "   1. Run: ./start-medical-vault.sh"
    echo "   2. Open: http://localhost:5173/"
    echo "   3. Connect MetaMask to Coston2 network"
    echo "   4. Use Admin Setup to configure patient roles"
    echo
    echo "📚 Documentation:"
    echo "   📖 CONNECTION-ARCHITECTURE.md - MetaMask connection details"
    echo "   📖 TESTING.md                 - Testing guide"
    echo "   📖 DEPLOYMENT-SUCCESS.md      - Deployment info"
    echo
    echo "🔧 Configuration:"
    echo "   📝 medical-vault-ui/.env      - Environment variables"
    echo "   🏗️  Smart Contract: $(cat medical-vault-ui/.env | grep VITE_VAULT_ADDRESS | cut -d'=' -f2)"
    echo
    echo "🎉 Ready to use! Run ./start-medical-vault.sh to begin!"
}

main() {
    print_header

    # Verify we're in the right directory
    if [ ! -d "medical-vault-ui" ]; then
        print_error "medical-vault-ui directory not found!"
        print_error "Please run this script from the project root directory."
        exit 1
    fi

    check_prerequisites
    setup_environment
    install_dependencies
    setup_permissions

    show_completion_info
}

main "$@"