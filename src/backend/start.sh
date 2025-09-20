#!/bin/bash

# XRPL Medical Records Platform - Simple Startup Script
echo "🏥 Starting XRPL Medical Records Platform..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

# Navigate to backend directory
cd "$(dirname "$0")"

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "❌ .env file not found. Please create .env file with your configuration."
    echo "📋 Copy .env.example to .env and update with your settings."
    exit 1
fi

# Check if PLATFORM_WALLET_SEED is set
if ! grep -q "PLATFORM_WALLET_SEED=" .env || grep -q "PLATFORM_WALLET_SEED=$" .env; then
    echo "⚠️  PLATFORM_WALLET_SEED not configured in .env"
    echo "🔑 Generating new XRPL wallet..."

    # Generate new wallet
    WALLET_INFO=$(node -e "
    const { Wallet } = require('xrpl');
    const wallet = Wallet.generate();
    console.log(wallet.address + '|' + wallet.seed);
    ")

    ADDRESS=$(echo "$WALLET_INFO" | cut -d'|' -f1)
    SEED=$(echo "$WALLET_INFO" | cut -d'|' -f2)

    # Update .env file
    if grep -q "PLATFORM_WALLET_SEED=" .env; then
        sed -i "s/PLATFORM_WALLET_SEED=.*/PLATFORM_WALLET_SEED=$SEED/" .env
    else
        echo "PLATFORM_WALLET_SEED=$SEED" >> .env
    fi

    echo "✅ New wallet generated:"
    echo "   Address: $ADDRESS"
    echo "   Seed: $SEED"
    echo ""
    echo "💰 To enable real NFT minting:"
    echo "   1. Visit: https://xrpl.org/xrp-testnet-faucet.html"
    echo "   2. Send 1000 XRP to: $ADDRESS"
    echo "   3. Restart this script"
    echo ""
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install

    if [ $? -ne 0 ]; then
        echo "❌ Failed to install dependencies."
        exit 1
    fi
fi

# Check if data directory exists
if [ ! -d "data" ]; then
    echo "📁 Creating data directory..."
    mkdir -p data
fi

# Check if uploads directory exists
if [ ! -d "uploads" ]; then
    echo "📁 Creating uploads directory..."
    mkdir -p uploads
fi

# Display configuration info
echo ""
echo "🔧 Configuration Status:"

# Check XRPL configuration
if grep -q "PLATFORM_WALLET_SEED=" .env && ! grep -q "PLATFORM_WALLET_SEED=$" .env; then
    echo "   ✅ XRPL Wallet: Configured"
else
    echo "   ⚠️  XRPL Wallet: Not configured"
fi

# Check AWS S3 configuration
if grep -q "AWS_ACCESS_KEY_ID=" .env && ! grep -q "AWS_ACCESS_KEY_ID=$" .env; then
    echo "   ✅ AWS S3: Configured"
else
    echo "   📁 AWS S3: Using local storage"
fi

# Check MongoDB configuration
if grep -q "MONGODB_URI=" .env && ! grep -q "MONGODB_URI=$" .env && ! grep -q "^#.*MONGODB_URI=" .env; then
    echo "   ✅ MongoDB: Configured"
else
    echo "   📁 MongoDB: Using local storage"
fi

echo ""
echo "🚀 Starting server..."
echo "   📊 Health: http://localhost:3000/api/health"
echo "   📋 API Docs: Available endpoints in routes/"
echo ""
echo "🔗 Frontend URL: ${FRONTEND_URL:-http://localhost:5173}"
echo ""
echo "Press Ctrl+C to stop the server"
echo "======================================="

# Start the server
if [ "$NODE_ENV" = "production" ]; then
    node server.js
else
    # Use nodemon for development if available, otherwise use node
    if command -v nodemon &> /dev/null; then
        nodemon server.js
    else
        node server.js
    fi
fi