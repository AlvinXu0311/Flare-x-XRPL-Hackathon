#!/bin/bash

# Medical Vault Stop Script
# This script stops all running Medical Vault services

set -e

echo "🛑 Medical Vault Stop Script"
echo "============================"

# Colors for output
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

# Stop Node.js development servers
stop_dev_servers() {
    print_status "Stopping Node.js development servers..."

    # Find and kill processes running on common development ports
    local ports=(3000 3001 5173 8080 8081 8082)
    local killed_any=false

    for port in "${ports[@]}"; do
        # Find process using the port
        local pids=$(lsof -ti:$port 2>/dev/null || true)

        if [ ! -z "$pids" ]; then
            print_status "Stopping process on port $port (PID: $pids)"
            echo "$pids" | xargs kill -TERM 2>/dev/null || true

            # Wait a moment for graceful shutdown
            sleep 2

            # Force kill if still running
            local remaining_pids=$(lsof -ti:$port 2>/dev/null || true)
            if [ ! -z "$remaining_pids" ]; then
                print_warning "Force killing stubborn process on port $port"
                echo "$remaining_pids" | xargs kill -KILL 2>/dev/null || true
            fi

            killed_any=true
        fi
    done

    if [ "$killed_any" = true ]; then
        print_success "Development servers stopped"
    else
        print_status "No development servers were running"
    fi
}

# Stop npm processes by name
stop_npm_processes() {
    print_status "Stopping npm processes..."

    # Find npm/node processes related to medical-vault
    local npm_pids=$(ps aux | grep -E "(npm|node).*medical-vault|vite|nodemon" | grep -v grep | awk '{print $2}' || true)

    if [ ! -z "$npm_pids" ]; then
        print_status "Found npm/node processes: $npm_pids"
        echo "$npm_pids" | xargs kill -TERM 2>/dev/null || true

        # Wait for graceful shutdown
        sleep 3

        # Check if any are still running and force kill
        local remaining_pids=$(ps aux | grep -E "(npm|node).*medical-vault|vite|nodemon" | grep -v grep | awk '{print $2}' || true)
        if [ ! -z "$remaining_pids" ]; then
            print_warning "Force killing remaining processes"
            echo "$remaining_pids" | xargs kill -KILL 2>/dev/null || true
        fi

        print_success "npm processes stopped"
    else
        print_status "No npm processes found"
    fi
}

# Stop background bash processes (if any)
stop_background_processes() {
    print_status "Checking for background processes..."

    # Look for any background jobs
    local bg_jobs=$(jobs -r 2>/dev/null || true)

    if [ ! -z "$bg_jobs" ]; then
        print_status "Stopping background jobs..."
        kill %1 %2 %3 %4 %5 2>/dev/null || true
        print_success "Background jobs stopped"
    else
        print_status "No background jobs found"
    fi
}

# Clean up temporary files
cleanup_temp_files() {
    print_status "Cleaning up temporary files..."

    local cleaned=false

    # Remove build artifacts
    if [ -d "medical-vault-ui/dist" ]; then
        rm -rf medical-vault-ui/dist
        print_status "Removed frontend build directory"
        cleaned=true
    fi

    # Remove temporary upload files
    if [ -d "medical-vault-backend/tmp" ]; then
        rm -rf medical-vault-backend/tmp/*
        print_status "Cleaned backend temporary files"
        cleaned=true
    fi

    # Remove log files (if desired)
    if [ -d "medical-vault-backend/logs" ]; then
        find medical-vault-backend/logs -name "*.log" -mtime +1 -delete 2>/dev/null || true
        print_status "Cleaned old log files"
        cleaned=true
    fi

    # Remove node_modules/.cache
    if [ -d "medical-vault-ui/node_modules/.cache" ]; then
        rm -rf medical-vault-ui/node_modules/.cache
        print_status "Cleared frontend cache"
        cleaned=true
    fi

    if [ -d "medical-vault-backend/node_modules/.cache" ]; then
        rm -rf medical-vault-backend/node_modules/.cache
        print_status "Cleared backend cache"
        cleaned=true
    fi

    if [ "$cleaned" = true ]; then
        print_success "Temporary files cleaned"
    else
        print_status "No temporary files to clean"
    fi
}

# Stop IPFS daemon (if running locally)
stop_ipfs_daemon() {
    print_status "Checking IPFS daemon..."

    if command -v ipfs &> /dev/null; then
        # Check if IPFS daemon is running
        if ipfs id &>/dev/null; then
            print_status "Stopping IPFS daemon..."
            ipfs shutdown &>/dev/null || true
            print_success "IPFS daemon stopped"
        else
            print_status "IPFS daemon is not running"
        fi
    else
        print_status "IPFS CLI not found (not an issue for web-only deployment)"
    fi
}

# Show current process status
show_process_status() {
    print_status "Current process status:"
    echo ""

    # Check common ports
    local ports=(3000 3001 5173 8080)
    for port in "${ports[@]}"; do
        local process=$(lsof -ti:$port 2>/dev/null || true)
        if [ ! -z "$process" ]; then
            echo "   ❌ Port $port: Still in use (PID: $process)"
        else
            echo "   ✅ Port $port: Available"
        fi
    done

    echo ""
}

# Main stop logic
main() {
    echo ""

    # Parse command line arguments
    CLEAN_ALL=false
    FORCE_KILL=false
    QUIET=false

    while [[ $# -gt 0 ]]; do
        case $1 in
            --clean)
                CLEAN_ALL=true
                shift
                ;;
            --force)
                FORCE_KILL=true
                shift
                ;;
            --quiet)
                QUIET=true
                shift
                ;;
            --help)
                echo "Usage: $0 [OPTIONS]"
                echo "Options:"
                echo "  --clean     Clean temporary files and build artifacts"
                echo "  --force     Force kill all processes (use with caution)"
                echo "  --quiet     Suppress output"
                echo "  --help      Show this help message"
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                echo "Use --help for usage information"
                exit 1
                ;;
        esac
    done

    if [ "$QUIET" = false ]; then
        print_status "Stopping Medical Vault services..."
    fi

    # Stop development servers
    stop_dev_servers

    # Stop npm processes
    stop_npm_processes

    # Stop background processes
    stop_background_processes

    # Stop IPFS daemon
    stop_ipfs_daemon

    # Clean up if requested
    if [ "$CLEAN_ALL" = true ]; then
        cleanup_temp_files
    fi

    # Force kill everything if requested
    if [ "$FORCE_KILL" = true ]; then
        print_warning "Force killing all node processes..."
        pkill -f "node.*medical-vault" 2>/dev/null || true
        pkill -f "npm.*medical-vault" 2>/dev/null || true
        pkill -f "vite" 2>/dev/null || true
        pkill -f "nodemon" 2>/dev/null || true
    fi

    if [ "$QUIET" = false ]; then
        echo ""
        print_success "Medical Vault services stopped!"
        echo ""
        show_process_status

        echo "💡 Quick commands:"
        echo "   Start frontend:    cd medical-vault-ui && npm run dev"
        echo "   Start backend:     cd medical-vault-backend && npm run dev"
        echo "   Deploy to IPFS:    ./deploy.sh --frontend-only"
        echo "   Clean restart:     ./stop.sh --clean && ./deploy.sh"
        echo ""
    fi
}

# Handle Ctrl+C gracefully
trap 'echo -e "\n${YELLOW}[INTERRUPT]${NC} Stop script interrupted"; exit 1' INT

# Run main function with all arguments
main "$@"