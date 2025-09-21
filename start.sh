#!/bin/bash

# Medical Vault - Complete Startup Script
# This script starts all Medical Vault services

set -e

echo "🏥 Medical Vault - Startup Script"
echo "================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
FRONTEND_DIR="medical-vault-ui"
BACKEND_DIR="medical-vault-backend"

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

    if [ ! -f "$FRONTEND_DIR/package.json" ]; then
        print_error "$FRONTEND_DIR/package.json not found!"
        print_error "Please run this script from the project root directory."
        exit 1
    fi

    if [ ! -f "$FRONTEND_DIR/.env" ]; then
        print_warning ".env file not found in $FRONTEND_DIR/"
        print_warning "Creating basic .env file..."

        cat > $FRONTEND_DIR/.env << EOF
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
    print_status "Installing dependencies..."

    # Frontend dependencies
    print_status "Checking frontend dependencies..."
    cd $FRONTEND_DIR

    if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules" ]; then
        print_status "Installing frontend dependencies..."
        npm install
        print_success "Frontend dependencies installed!"
    else
        print_success "Frontend dependencies already installed!"
    fi

    cd ..

    # Backend dependencies (if backend exists)
    if [ -f "$BACKEND_DIR/package.json" ]; then
        print_status "Checking backend dependencies..."
        cd $BACKEND_DIR

        if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules" ]; then
            print_status "Installing backend dependencies..."
            npm install
            print_success "Backend dependencies installed!"
        else
            print_success "Backend dependencies already installed!"
        fi

        cd ..
    fi
}

# Start the backend if it exists
start_backend() {
    if [ -f "$BACKEND_DIR/package.json" ]; then
        print_status "Starting Medical Vault backend..."

        cd $BACKEND_DIR

        # Check if port 3001 is already in use
        if lsof -Pi :3001 -sTCP:LISTEN -t >/dev/null 2>&1; then
            print_warning "Port 3001 is already in use!"
            local pid=$(lsof -Pi :3001 -sTCP:LISTEN -t)
            local process_name=$(ps -p $pid -o comm= 2>/dev/null || echo "unknown")

            if [[ "$process_name" == *"node"* ]]; then
                print_success "Backend server already running on port 3001!"
                cd ..
                return 0
            else
                print_error "Port 3001 is occupied by: $process_name (PID: $pid)"
                print_error "Please stop the process or use a different port."
                exit 1
            fi
        fi

        print_status "Starting backend server..."

        # Start backend in the background
        npm run dev &
        local backend_pid=$!

        # Wait for the server to start
        print_status "Waiting for backend to start..."
        sleep 3

        # Check if the server started successfully
        if kill -0 $backend_pid 2>/dev/null; then
            print_success "Backend started successfully!"
            print_success "🔧 Medical Vault API: http://localhost:3001/"
            echo $backend_pid > ../medical-vault-backend.pid
        else
            print_error "Failed to start backend server!"
            exit 1
        fi

        cd ..
    else
        print_status "No backend found, running frontend only..."
    fi
}

# Start the frontend
start_frontend() {
    print_status "Starting Medical Vault frontend..."

    cd $FRONTEND_DIR

    # Check if port 5173 is already in use
    if lsof -Pi :5173 -sTCP:LISTEN -t >/dev/null 2>&1; then
        print_warning "Port 5173 is already in use!"
        local pid=$(lsof -Pi :5173 -sTCP:LISTEN -t)
        local process_name=$(ps -p $pid -o comm= 2>/dev/null || echo "unknown")

        if [[ "$process_name" == *"node"* ]] || [[ "$process_name" == *"vite"* ]]; then
            print_success "Frontend server already running on port 5173!"
            print_success "🚀 Medical Vault UI: http://localhost:5173/"
            cd ..
            return 0
        else
            print_error "Port 5173 is occupied by: $process_name (PID: $pid)"
            print_error "Please stop the process or use a different port."
            exit 1
        fi
    fi

    print_status "Starting Vite development server..."

    # Start frontend in the background
    npm run dev &
    local frontend_pid=$!

    # Wait for the server to start
    print_status "Waiting for frontend to start..."
    sleep 3

    # Check if the server started successfully
    if kill -0 $frontend_pid 2>/dev/null; then
        print_success "Frontend started successfully!"
        print_success "🚀 Medical Vault UI: http://localhost:5173/"
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
    echo "   📁 Directory: $FRONTEND_DIR/"
    echo

    if [ -f "$BACKEND_DIR/package.json" ]; then
        echo "🔧 Backend API:"
        echo "   🌐 URL: http://localhost:3001/"
        echo "   📁 Directory: $BACKEND_DIR/"
        echo
    fi

    echo "🔧 Configuration:"
    echo "   📝 Environment: $FRONTEND_DIR/.env"
    echo "   🏗️  Smart Contract: $(grep "VITE_VAULT_ADDRESS" $FRONTEND_DIR/.env | cut -d'=' -f2)"
    echo "   🌍 Network: Coston2 Testnet (Chain ID: 114)"
    echo
    echo "📋 Next Steps:"
    echo "   1. Open http://localhost:5173/ in your browser"
    echo "   2. Connect your MetaMask wallet"
    echo "   3. Switch to Coston2 network when prompted"
    echo "   4. Use Admin Setup tab to configure patient roles"
    echo "   5. Upload and download encrypted medical documents"
    echo
    echo "🛑 To stop all services:"
    echo "   Press Ctrl+C or run: ./stop.sh"
    echo
    echo -e "${BLUE}Services are running in the background...${NC}"
    echo "=================================================="
}

# Wait for services and monitor
wait_for_services() {
    local frontend_pid=""
    local backend_pid=""

    if [ -f "medical-vault-frontend.pid" ]; then
        frontend_pid=$(cat medical-vault-frontend.pid)
    fi

    if [ -f "medical-vault-backend.pid" ]; then
        backend_pid=$(cat medical-vault-backend.pid)
    fi

    print_status "Monitoring services..."
    print_status "Press Ctrl+C to stop all services"

    # Monitor processes
    while true; do
        local services_running=false

        # Check frontend
        if [ -n "$frontend_pid" ] && kill -0 $frontend_pid 2>/dev/null; then
            services_running=true
        fi

        # Check backend
        if [ -n "$backend_pid" ] && kill -0 $backend_pid 2>/dev/null; then
            services_running=true
        fi

        if [ "$services_running" = false ]; then
            print_warning "All services have stopped"
            cleanup
            break
        fi

        sleep 5
    done
}

# Cleanup function
cleanup() {
    print_status "Shutting down Medical Vault services..."

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

    # Kill backend if running
    if [ -f "medical-vault-backend.pid" ]; then
        local backend_pid=$(cat medical-vault-backend.pid)
        if kill -0 $backend_pid 2>/dev/null; then
            print_status "Stopping backend (PID: $backend_pid)..."
            kill $backend_pid 2>/dev/null || true
            sleep 2

            # Force kill if still running
            if kill -0 $backend_pid 2>/dev/null; then
                print_warning "Force stopping backend..."
                kill -9 $backend_pid 2>/dev/null || true
            fi
        fi
        rm -f medical-vault-backend.pid
    fi

    print_success "Medical Vault stopped successfully!"
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Main execution
main() {
    # Parse command line arguments
    FRONTEND_ONLY=false

    while [[ $# -gt 0 ]]; do
        case $1 in
            --frontend-only)
                FRONTEND_ONLY=true
                shift
                ;;
            --help)
                echo "Usage: $0 [OPTIONS]"
                echo "Options:"
                echo "  --frontend-only    Start only the frontend"
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

    # Check system requirements
    check_dependencies
    check_project_structure

    # Install and setup
    install_dependencies

    # Start services
    if [ "$FRONTEND_ONLY" = false ] && [ -f "$BACKEND_DIR/package.json" ]; then
        start_backend
    fi

    start_frontend

    # Show information
    show_startup_info

    # Keep running and monitor
    wait_for_services
}

# Run main function
main "$@"