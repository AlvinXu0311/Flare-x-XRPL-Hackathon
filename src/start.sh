#!/bin/bash

# XRPL Medical Records Platform - Startup Script
# This script starts both frontend and backend services

set -e

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

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if a port is in use
port_in_use() {
    lsof -i :$1 >/dev/null 2>&1
}

# Function to kill processes on specific ports
kill_port() {
    local port=$1
    if port_in_use $port; then
        print_warning "Port $port is in use. Killing existing processes..."
        lsof -ti :$port | xargs kill -9 2>/dev/null || true
        sleep 2
    fi
}

# Function to wait for service to be ready
wait_for_service() {
    local url=$1
    local service_name=$2
    local max_attempts=30
    local attempt=1

    print_status "Waiting for $service_name to be ready..."

    while [ $attempt -le $max_attempts ]; do
        if curl -s "$url" >/dev/null 2>&1; then
            print_success "$service_name is ready!"
            return 0
        fi

        printf "."
        sleep 2
        attempt=$((attempt + 1))
    done

    print_error "$service_name failed to start after $((max_attempts * 2)) seconds"
    return 1
}

# Trap to cleanup background processes on exit
cleanup() {
    print_warning "Shutting down services..."

    # Kill background processes
    jobs -p | xargs -r kill 2>/dev/null || true

    # Kill processes on our ports
    kill_port 3000  # Backend
    kill_port 5173  # Frontend

    print_success "Cleanup completed"
    exit 0
}

trap cleanup SIGINT SIGTERM EXIT

# Main script starts here
print_success "🚀 Starting XRPL Medical Records Platform"
echo "=================================================="

# Check prerequisites
print_status "Checking prerequisites..."

if ! command_exists node; then
    print_error "Node.js is not installed. Please install Node.js 18+ and try again."
    exit 1
fi

if ! command_exists npm; then
    print_error "npm is not installed. Please install npm and try again."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    print_error "Node.js version 18+ is required. Current version: $(node --version)"
    exit 1
fi

print_success "Prerequisites check passed"

# Clean up any existing processes
print_status "Cleaning up existing processes..."
kill_port 3000
kill_port 5173

# Check if directories exist
if [ ! -d "backend" ]; then
    print_error "Backend directory not found. Please run this script from the project root."
    exit 1
fi

if [ ! -d "frontend" ]; then
    print_error "Frontend directory not found. Please run this script from the project root."
    exit 1
fi

# Install dependencies if needed
print_status "Checking dependencies..."

# Backend dependencies
if [ ! -d "backend/node_modules" ]; then
    print_status "Installing backend dependencies..."
    cd backend
    npm install
    cd ..
    print_success "Backend dependencies installed"
else
    print_status "Backend dependencies already installed"
fi

# Frontend dependencies
if [ ! -d "frontend/node_modules" ]; then
    print_status "Installing frontend dependencies..."
    cd frontend
    npm install
    cd ..
    print_success "Frontend dependencies installed"
else
    print_status "Frontend dependencies already installed"
fi

# Create environment files if they don't exist
print_status "Setting up environment configuration..."

if [ ! -f "backend/.env" ]; then
    print_warning "Backend .env file not found. Creating from template..."
    cp backend/.env.example backend/.env
    print_success "Backend .env file created. Please configure it for production use."
fi

if [ ! -f "frontend/.env" ]; then
    print_warning "Frontend .env file not found. Creating from template..."
    cp frontend/.env.example frontend/.env 2>/dev/null || echo "VITE_API_URL=http://localhost:3000" > frontend/.env
    print_success "Frontend .env file created."
fi

# Start services
print_success "🎬 Starting services..."
echo ""

# Start backend
print_status "Starting backend server on port 3000..."
cd backend
npm run dev > ../backend.log 2>&1 &
BACKEND_PID=$!
cd ..

# Wait for backend to be ready
if wait_for_service "http://localhost:3000/api/health" "Backend"; then
    print_success "✅ Backend is running at http://localhost:3000"
    print_status "📊 Health check: http://localhost:3000/api/health"
    print_status "📚 API docs: http://localhost:3000/api"
else
    print_error "❌ Backend failed to start. Check backend.log for details."
    exit 1
fi

echo ""

# Start frontend
print_status "Starting frontend development server on port 5173..."
cd frontend
npm run dev > ../frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..

# Wait for frontend to be ready
if wait_for_service "http://localhost:5173" "Frontend"; then
    print_success "✅ Frontend is running at http://localhost:5173"
else
    print_error "❌ Frontend failed to start. Check frontend.log for details."
    exit 1
fi

echo ""
print_success "🎉 XRPL Medical Records Platform is now running!"
echo "=================================================="
echo ""
echo -e "${GREEN}📱 Frontend:${NC} http://localhost:5173"
echo -e "${GREEN}🔧 Backend API:${NC} http://localhost:3000"
echo -e "${GREEN}💚 Health Check:${NC} http://localhost:3000/api/health"
echo -e "${GREEN}🔍 Blockchain Status:${NC} http://localhost:3000/api/blockchain/health"
echo ""
echo -e "${YELLOW}📋 Logs:${NC}"
echo "  - Backend: tail -f backend.log"
echo "  - Frontend: tail -f frontend.log"
echo ""
echo -e "${YELLOW}🛑 To stop:${NC} Press Ctrl+C"
echo ""

# Keep the script running and show live logs
print_status "Showing live logs (Press Ctrl+C to stop all services)..."
echo ""

# Show logs from both services
tail -f backend.log frontend.log 2>/dev/null &

# Wait for user interrupt
wait