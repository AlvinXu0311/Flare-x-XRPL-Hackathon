# 🏥 Medical Vault - Startup Scripts

Complete automation scripts to manage your Medical Vault application.

## 📋 Available Scripts

### 🔧 `setup-medical-vault.sh`
**First-time setup script**
- Checks Node.js and npm installation
- Creates environment configuration
- Installs all dependencies
- Sets up script permissions

```bash
./setup-medical-vault.sh
```

### 🚀 `start-medical-vault.sh`
**Main startup script**
- Checks all dependencies
- Verifies smart contract configuration
- Starts frontend development server
- Shows comprehensive startup information
- Monitors services and handles graceful shutdown

```bash
./start-medical-vault.sh
```

### 🛑 `stop-medical-vault.sh`
**Shutdown script**
- Stops all Medical Vault services
- Kills frontend processes
- Frees up ports
- Cleans up PID files

```bash
./stop-medical-vault.sh
```

## 🎯 Quick Start Guide

### 1. Initial Setup (Run once)
```bash
# Make sure you're in the project root directory
cd /path/to/Flare-x-XRPL-Hackathon/

# Run the setup script
./setup-medical-vault.sh
```

### 2. Start the Application
```bash
./start-medical-vault.sh
```

### 3. Access the Application
- **Frontend**: http://localhost:5173/
- **Connect MetaMask** to Coston2 network
- **Use Admin Setup** to configure patient roles

### 4. Stop the Application
```bash
# Press Ctrl+C in the terminal running start-medical-vault.sh
# OR run in another terminal:
./stop-medical-vault.sh
```

## 🔧 What the Scripts Do

### Setup Script Features:
- ✅ Checks Node.js and npm versions
- ✅ Creates `.env` file with smart contract configuration
- ✅ Installs frontend dependencies (`npm install`)
- ✅ Sets executable permissions on scripts

### Start Script Features:
- ✅ Comprehensive dependency checking
- ✅ Project structure validation
- ✅ Automatic dependency installation if needed
- ✅ Smart contract deployment verification
- ✅ Frontend server startup with error handling
- ✅ Port conflict detection and resolution
- ✅ Process monitoring and PID management
- ✅ Graceful shutdown on Ctrl+C

### Stop Script Features:
- ✅ Finds and stops all Medical Vault processes
- ✅ Frees up port 5173
- ✅ Cleans up temporary files
- ✅ Force-kills stuck processes if needed

## 📊 What Gets Started

### Frontend Services:
- **Vite Development Server** (port 5173)
- **Vue.js Application** with hot reload
- **MetaMask Integration** for wallet connection
- **Smart Contract Interface** for blockchain interaction

### Environment Configuration:
- **Smart Contract Address**: Coston2 deployment
- **RPC Endpoint**: Flare Coston2 network
- **Chain ID**: 114 (Coston2)

## 🐛 Troubleshooting

### Port Already in Use
```bash
# Check what's using port 5173
lsof -i :5173

# Kill specific process
kill <PID>

# Or use the stop script
./stop-medical-vault.sh
```

### Permission Denied
```bash
# Make scripts executable
chmod +x *.sh

# Or run setup again
./setup-medical-vault.sh
```

### Dependencies Missing
```bash
# Install Node.js from https://nodejs.org/
# Then run setup again
./setup-medical-vault.sh
```

### Smart Contract Not Found
```bash
# Check .env file
cat medical-vault-ui/.env

# Verify contract address is set
# VITE_VAULT_ADDRESS=0x6cd4FEb053E613dF60CF10f0DD1D9597051D241B
```

## 📝 Script Logs

The start script provides detailed logging:
- 🔵 **[INFO]** - General information
- 🟢 **[SUCCESS]** - Successful operations
- 🟡 **[WARNING]** - Non-critical issues
- 🔴 **[ERROR]** - Critical errors

## 🎊 Success Indicators

When everything works correctly, you'll see:
```
==================================================
🎉 Medical Vault Started Successfully!
==================================================

📱 Frontend Application:
   🌐 URL: http://localhost:5173/
   📁 Directory: medical-vault-ui/

🔧 Configuration:
   📝 Environment: medical-vault-ui/.env
   🏗️ Smart Contract: 0x6cd4FEb053E613dF60CF10f0DD1D9597051D241B
   🌍 Network: Coston2 Testnet (Chain ID: 114)
```

## 🔄 Development Workflow

```bash
# Day-to-day development
./start-medical-vault.sh    # Start everything
# ... do your development work ...
# Ctrl+C or ./stop-medical-vault.sh  # Stop when done

# If you make changes to package.json
./stop-medical-vault.sh
./setup-medical-vault.sh    # Reinstall dependencies
./start-medical-vault.sh    # Start again
```

These scripts provide a complete, production-ready way to manage your Medical Vault application! 🚀