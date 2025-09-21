#!/bin/bash

# Medical Vault - Stop Script
# This script stops all Medical Vault services

echo "🛑 Medical Vault - Stop Script"
echo "==============================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# Stop frontend service
stop_frontend() {
    print_status "Stopping Medical Vault frontend..."

    # Check for PID file
    if [ -f "medical-vault-frontend.pid" ]; then
        local pid=$(cat medical-vault-frontend.pid)
        if kill -0 $pid 2>/dev/null; then
            print_status "Stopping frontend process (PID: $pid)..."
            kill $pid
            sleep 3

            # Check if still running
            if kill -0 $pid 2>/dev/null; then
                print_warning "Process still running, force killing..."
                kill -9 $pid
            fi

            print_success "Frontend stopped!"
        else
            print_warning "Frontend process not running"
        fi
        rm -f medical-vault-frontend.pid
    fi

    # Kill any remaining processes on port 5173
    local frontend_pids=$(lsof -Pi :5173 -sTCP:LISTEN -t 2>/dev/null || echo "")
    if [ -n "$frontend_pids" ]; then
        print_status "Killing remaining processes on port 5173..."
        for pid in $frontend_pids; do
            kill $pid 2>/dev/null || true
        done
        sleep 2

        # Force kill if needed
        frontend_pids=$(lsof -Pi :5173 -sTCP:LISTEN -t 2>/dev/null || echo "")
        if [ -n "$frontend_pids" ]; then
            for pid in $frontend_pids; do
                kill -9 $pid 2>/dev/null || true
            done
        fi
    fi
}

# Stop backend service
stop_backend() {
    print_status "Stopping Medical Vault backend..."

    # Check for PID file
    if [ -f "medical-vault-backend.pid" ]; then
        local pid=$(cat medical-vault-backend.pid)
        if kill -0 $pid 2>/dev/null; then
            print_status "Stopping backend process (PID: $pid)..."
            kill $pid
            sleep 3

            # Check if still running
            if kill -0 $pid 2>/dev/null; then
                print_warning "Process still running, force killing..."
                kill -9 $pid
            fi

            print_success "Backend stopped!"
        else
            print_warning "Backend process not running"
        fi
        rm -f medical-vault-backend.pid
    fi

    # Kill any remaining processes on port 3001
    local backend_pids=$(lsof -Pi :3001 -sTCP:LISTEN -t 2>/dev/null || echo "")
    if [ -n "$backend_pids" ]; then
        print_status "Killing remaining processes on port 3001..."
        for pid in $backend_pids; do
            kill $pid 2>/dev/null || true
        done
        sleep 2

        # Force kill if needed
        backend_pids=$(lsof -Pi :3001 -sTCP:LISTEN -t 2>/dev/null || echo "")
        if [ -n "$backend_pids" ]; then
            for pid in $backend_pids; do
                kill -9 $pid 2>/dev/null || true
            done
        fi
    fi
}

# Stop mapping server service
stop_mapping_server() {
    print_status "Stopping Medical Vault mapping server..."

    # Check for PID file
    if [ -f "medical-vault-mapping.pid" ]; then
        local pid=$(cat medical-vault-mapping.pid)
        if kill -0 $pid 2>/dev/null; then
            print_status "Stopping mapping server process (PID: $pid)..."
            kill $pid
            sleep 3

            # Check if still running
            if kill -0 $pid 2>/dev/null; then
                print_warning "Process still running, force killing..."
                kill -9 $pid
            fi

            print_success "Mapping server stopped!"
        else
            print_warning "Mapping server process not running"
        fi
        rm -f medical-vault-mapping.pid
    fi

    # Kill any remaining processes on port 3002
    local mapping_pids=$(lsof -Pi :3002 -sTCP:LISTEN -t 2>/dev/null || echo "")
    if [ -n "$mapping_pids" ]; then
        print_status "Killing remaining processes on port 3002..."
        for pid in $mapping_pids; do
            kill $pid 2>/dev/null || true
        done
        sleep 2

        # Force kill if needed
        mapping_pids=$(lsof -Pi :3002 -sTCP:LISTEN -t 2>/dev/null || echo "")
        if [ -n "$mapping_pids" ]; then
            for pid in $mapping_pids; do
                kill -9 $pid 2>/dev/null || true
            done
        fi
    fi
}

# Stop any additional Medical Vault processes
stop_additional_processes() {
    print_status "Stopping any additional Medical Vault processes..."

    # Find and stop npm/node processes related to medical-vault
    local medical_vault_pids=$(ps aux | grep -E "(npm|node).*medical-vault" | grep -v grep | awk '{print $2}' || true)

    if [ -n "$medical_vault_pids" ]; then
        print_status "Found Medical Vault processes: $medical_vault_pids"
        echo "$medical_vault_pids" | xargs kill -TERM 2>/dev/null || true
        sleep 3

        # Force kill if still running
        local remaining_pids=$(ps aux | grep -E "(npm|node).*medical-vault" | grep -v grep | awk '{print $2}' || true)
        if [ -n "$remaining_pids" ]; then
            print_warning "Force killing remaining processes"
            echo "$remaining_pids" | xargs kill -KILL 2>/dev/null || true
        fi
    fi

    # Stop any Vite processes
    local vite_pids=$(ps aux | grep "vite" | grep -v grep | awk '{print $2}' || true)
    if [ -n "$vite_pids" ]; then
        print_status "Stopping Vite processes..."
        echo "$vite_pids" | xargs kill -TERM 2>/dev/null || true
        sleep 2

        # Force kill if needed
        vite_pids=$(ps aux | grep "vite" | grep -v grep | awk '{print $2}' || true)
        if [ -n "$vite_pids" ]; then
            echo "$vite_pids" | xargs kill -KILL 2>/dev/null || true
        fi
    fi
}

# Check service status
check_status() {
    print_status "Checking service status..."

    local any_running=false

    # Check frontend
    if [ -f "medical-vault-frontend.pid" ]; then
        local pid=$(cat medical-vault-frontend.pid)
        if kill -0 $pid 2>/dev/null; then
            print_status "Frontend still running (PID: $pid)"
            any_running=true
        fi
    fi

    # Check backend
    if [ -f "medical-vault-backend.pid" ]; then
        local pid=$(cat medical-vault-backend.pid)
        if kill -0 $pid 2>/dev/null; then
            print_status "Backend still running (PID: $pid)"
            any_running=true
        fi
    fi

    # Check mapping server
    if [ -f "medical-vault-mapping.pid" ]; then
        local pid=$(cat medical-vault-mapping.pid)
        if kill -0 $pid 2>/dev/null; then
            print_status "Mapping server still running (PID: $pid)"
            any_running=true
        fi
    fi

    # Check ports
    if lsof -Pi :5173 -sTCP:LISTEN -t >/dev/null 2>&1; then
        local pid=$(lsof -Pi :5173 -sTCP:LISTEN -t)
        print_status "Port 5173 still in use (PID: $pid)"
        any_running=true
    fi

    if lsof -Pi :3001 -sTCP:LISTEN -t >/dev/null 2>&1; then
        local pid=$(lsof -Pi :3001 -sTCP:LISTEN -t)
        print_status "Port 3001 still in use (PID: $pid)"
        any_running=true
    fi

    if lsof -Pi :3002 -sTCP:LISTEN -t >/dev/null 2>&1; then
        local pid=$(lsof -Pi :3002 -sTCP:LISTEN -t)
        print_status "Port 3002 still in use (PID: $pid)"
        any_running=true
    fi

    if [ "$any_running" = false ]; then
        print_success "No Medical Vault services running"
        return 0
    else
        return 1
    fi
}

# Clean up temporary files (optional)
cleanup_files() {
    print_status "Cleaning up temporary files..."

    local cleaned=false

    # Remove PID files
    if [ -f "medical-vault-frontend.pid" ]; then
        rm -f medical-vault-frontend.pid
        cleaned=true
    fi

    if [ -f "medical-vault-backend.pid" ]; then
        rm -f medical-vault-backend.pid
        cleaned=true
    fi

    if [ -f "medical-vault-mapping.pid" ]; then
        rm -f medical-vault-mapping.pid
        cleaned=true
    fi

    # Remove build artifacts if requested
    if [ "$CLEAN_BUILD" = true ]; then
        if [ -d "medical-vault-ui/dist" ]; then
            rm -rf medical-vault-ui/dist
            print_status "Removed frontend build directory"
            cleaned=true
        fi

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

        # Clean contract artifacts
        if [ -d "build" ]; then
            rm -rf build
            print_status "Removed contract build artifacts"
            cleaned=true
        fi

        # Clean truffle cache
        if [ -d ".truffle" ]; then
            rm -rf .truffle
            print_status "Cleared truffle cache"
            cleaned=true
        fi
    fi

    if [ "$cleaned" = true ]; then
        print_success "Cleanup completed"
    fi
}

# Main function
main() {
    # Parse command line arguments
    CLEAN_BUILD=false
    FORCE_KILL=false

    while [[ $# -gt 0 ]]; do
        case $1 in
            --clean)
                CLEAN_BUILD=true
                shift
                ;;
            --force)
                FORCE_KILL=true
                shift
                ;;
            --help)
                echo "Usage: $0 [OPTIONS]"
                echo "Options:"
                echo "  --clean     Clean build artifacts and cache"
                echo "  --force     Force kill all processes"
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

    echo

    # Check initial status
    if check_status; then
        print_success "Medical Vault is not running"
        cleanup_files
        exit 0
    fi

    # Stop services
    stop_frontend
    stop_backend
    stop_mapping_server
    stop_additional_processes

    # Force kill if requested
    if [ "$FORCE_KILL" = true ]; then
        print_warning "Force killing all node/npm processes..."
        pkill -f "node" 2>/dev/null || true
        pkill -f "npm" 2>/dev/null || true
        pkill -f "vite" 2>/dev/null || true
        sleep 2
    fi

    # Clean up files
    cleanup_files

    # Final status check
    echo
    if check_status; then
        print_success "All Medical Vault services stopped successfully!"
    else
        print_warning "Some processes may still be running"
        print_status "Use --force option to kill all node processes"
    fi

    echo
    echo "To start again, run: ./start.sh"
}

# Run main function
main "$@"