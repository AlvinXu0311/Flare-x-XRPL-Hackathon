#!/bin/bash

# Medical Vault - Complete Startup Script
# This script starts the frontend and checks all dependencies

set -e  # Exit on any error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

print_header() {
    echo -e "${BLUE}"
    echo "=================================================="
    echo "🏥 Medical Vault - Startup Script"
    echo "=================================================="
    echo -e "${NC}"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check dependencies
check_dependencies() {
    print_status "Checking dependencies..."

    local missing_deps=()

    if ! command_exists node; then
        missing_deps+=("Node.js")
    fi

    if ! command_exists npm; then
        missing_deps+=("npm")
    fi

    if [ ${#missing_deps[@]} -ne 0 ]; then
        print_error "Missing dependencies: ${missing_deps[*]}"
        print_error "Please install the missing dependencies and try again."
        exit 1
    fi

    print_success "All dependencies found!"

    # Check Node.js version
    local node_version=$(node --version | cut -d'v' -f2)
    print_status "Node.js version: $node_version"

    # Check npm version
    local npm_version=$(npm --version)
    print_status "npm version: $npm_version"
}

# Check project structure
check_project_structure() {
    print_status "Checking project structure..."

    if [ ! -f "medical-vault-ui/package.json" ]; then
        print_error "medical-vault-ui/package.json not found!"
        print_error "Please run this script from the project root directory."
        exit 1
    fi

    if [ ! -f "medical-vault-ui/.env" ]; then
        print_warning ".env file not found in medical-vault-ui/"
        print_warning "Creating basic .env file..."

        cat > medical-vault-ui/.env << EOF
VITE_VAULT_ADDRESS=0x6cd4FEb053E613dF60CF10f0DD1D9597051D241B
VITE_COSTON2_RPC=https://rpc-coston2.flare.network
VITE_COSTON2_CHAIN_ID=114
EOF
        print_success "Created .env file with default values"
    fi

    print_success "Project structure verified!"
}

# Install dependencies if needed
install_dependencies() {
    print_status "Checking frontend dependencies..."

    cd medical-vault-ui

    if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules" ]; then
        print_status "Installing frontend dependencies..."
        npm install
        print_success "Frontend dependencies installed!"
    else
        print_success "Frontend dependencies already installed!"
    fi

    cd ..
}

# Check smart contract deployment
check_smart_contract() {
    print_status "Checking smart contract deployment..."

    local vault_address=$(grep "VITE_VAULT_ADDRESS" medical-vault-ui/.env | cut -d'=' -f2)

    if [ -z "$vault_address" ] || [ "$vault_address" = "" ]; then
        print_warning "Smart contract address not configured!"
        print_warning "Please set VITE_VAULT_ADDRESS in medical-vault-ui/.env"
        print_warning "Example: VITE_VAULT_ADDRESS=0x1234567890abcdef..."
    else
        print_success "Smart contract address configured: $vault_address"
    fi
}

# Start the frontend
start_frontend() {
    print_status "Starting Medical Vault frontend..."

    cd medical-vault-ui

    # Check if port 5173 is already in use
    if lsof -Pi :5173 -sTCP:LISTEN -t >/dev/null 2>&1; then
        print_warning "Port 5173 is already in use!"
        print_status "Checking if it's our development server..."

        local pid=$(lsof -Pi :5173 -sTCP:LISTEN -t)
        local process_name=$(ps -p $pid -o comm= 2>/dev/null || echo "unknown")

        if [[ "$process_name" == *"node"* ]] || [[ "$process_name" == *"vite"* ]]; then
            print_success "Development server already running on port 5173!"
            print_success "Frontend available at: http://localhost:5173/"
            return 0
        else
            print_error "Port 5173 is occupied by: $process_name (PID: $pid)"
            print_error "Please stop the process or use a different port."
            exit 1
        fi
    fi

    print_status "Starting Vite development server..."

    # Start the development server in the background
    npm run dev &
    local frontend_pid=$!

    # Wait for the server to start
    print_status "Waiting for server to start..."
    sleep 3

    # Check if the server started successfully
    if kill -0 $frontend_pid 2>/dev/null; then
        print_success "Frontend started successfully!"
        print_success "🚀 Medical Vault UI: http://localhost:5173/"

        # Store PID for cleanup
        echo $frontend_pid > ../medical-vault-frontend.pid
    else
        print_error "Failed to start frontend server!"
        exit 1
    fi

    cd ..
}

# Show startup information
show_startup_info() {
    echo -e "${GREEN}"
    echo "=================================================="
    echo "🎉 Medical Vault Started Successfully!"
    echo "=================================================="
    echo -e "${NC}"
    echo
    echo "📱 Frontend Application:"
    echo "   🌐 URL: http://localhost:5173/"
    echo "   📁 Directory: medical-vault-ui/"
    echo
    echo "🔧 Configuration:"
    echo "   📝 Environment: medical-vault-ui/.env"
    echo "   🏗️  Smart Contract: $(grep "VITE_VAULT_ADDRESS" medical-vault-ui/.env | cut -d'=' -f2)"
    echo "   🌍 Network: Coston2 Testnet (Chain ID: 114)"
    echo
    echo "📋 Next Steps:"
    echo "   1. Open http://localhost:5173/ in your browser"
    echo "   2. Connect your MetaMask wallet"
    echo "   3. Switch to Coston2 network when prompted"
    echo "   4. Use Admin Setup tab to configure patient roles"
    echo "   5. Upload and download encrypted medical documents"
    echo
    echo "🛑 To stop the application:"
    echo "   Press Ctrl+C or run: ./stop-medical-vault.sh"
    echo
    echo -e "${BLUE}Logs will appear below...${NC}"
    echo "=================================================="
}

# Wait for frontend and show logs
wait_for_frontend() {
    local frontend_pid=$(cat medical-vault-frontend.pid 2>/dev/null || echo "")

    if [ -n "$frontend_pid" ] && kill -0 $frontend_pid 2>/dev/null; then
        print_status "Monitoring frontend process (PID: $frontend_pid)..."
        print_status "Press Ctrl+C to stop all services"

        # Wait for the process to finish or be interrupted
        wait $frontend_pid 2>/dev/null || {
            print_warning "Frontend process stopped"
            cleanup
        }
    else
        print_error "Frontend process not found!"
        exit 1
    fi
}

# Cleanup function
cleanup() {
    print_status "Shutting down Medical Vault..."

    # Kill frontend if running
    if [ -f "medical-vault-frontend.pid" ]; then
        local frontend_pid=$(cat medical-vault-frontend.pid)
        if kill -0 $frontend_pid 2>/dev/null; then
            print_status "Stopping frontend (PID: $frontend_pid)..."
            kill $frontend_pid 2>/dev/null || true
            sleep 2

            # Force kill if still running
            if kill -0 $frontend_pid 2>/dev/null; then
                print_warning "Force stopping frontend..."
                kill -9 $frontend_pid 2>/dev/null || true
            fi
        fi
        rm -f medical-vault-frontend.pid
    fi

    print_success "Medical Vault stopped successfully!"
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Main execution
main() {
    print_header

    # Check system requirements
    check_dependencies
    check_project_structure

    # Install and setup
    install_dependencies
    check_smart_contract

    # Start services
    start_frontend

    # Show information
    show_startup_info

    # Keep running and monitor
    wait_for_frontend
}

# Run main function
main "$@"