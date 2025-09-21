#!/bin/bash

# Medical Vault - Stop Script
# This script stops all Medical Vault services

# Color codes for output
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

print_header() {
    echo -e "${RED}"
    echo "=================================================="
    echo "🛑 Medical Vault - Stop Script"
    echo "=================================================="
    echo -e "${NC}"
}

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

    # Kill any remaining Vite processes on port 5173
    local vite_pids=$(lsof -Pi :5173 -sTCP:LISTEN -t 2>/dev/null || echo "")
    if [ -n "$vite_pids" ]; then
        print_status "Killing remaining processes on port 5173..."
        for pid in $vite_pids; do
            kill $pid 2>/dev/null || true
        done
        sleep 2

        # Force kill if needed
        vite_pids=$(lsof -Pi :5173 -sTCP:LISTEN -t 2>/dev/null || echo "")
        if [ -n "$vite_pids" ]; then
            for pid in $vite_pids; do
                kill -9 $pid 2>/dev/null || true
            done
        fi
    fi

    # Check if port is now free
    if ! lsof -Pi :5173 -sTCP:LISTEN -t >/dev/null 2>&1; then
        print_success "Port 5173 is now free"
    else
        print_warning "Port 5173 may still be in use"
    fi
}

check_status() {
    print_status "Checking service status..."

    # Check frontend
    if [ -f "medical-vault-frontend.pid" ]; then
        local pid=$(cat medical-vault-frontend.pid)
        if kill -0 $pid 2>/dev/null; then
            print_status "Frontend running (PID: $pid)"
            return 1
        fi
    fi

    # Check port 5173
    if lsof -Pi :5173 -sTCP:LISTEN -t >/dev/null 2>&1; then
        local pid=$(lsof -Pi :5173 -sTCP:LISTEN -t)
        print_status "Port 5173 in use (PID: $pid)"
        return 1
    fi

    print_success "No Medical Vault services running"
    return 0
}

main() {
    print_header

    if check_status; then
        print_success "Medical Vault is not running"
        exit 0
    fi

    stop_frontend

    print_success "All Medical Vault services stopped!"
    echo
    echo "To start again, run: ./start-medical-vault.sh"
}

main "$@"