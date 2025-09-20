#!/usr/bin/env node

/**
 * XRPL Medical Records Platform - Node.js Startup Script
 * Cross-platform startup script for both frontend and backend
 */

const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

class PlatformLauncher {
  constructor() {
    this.processes = [];
    this.isShuttingDown = false;
    this.setupSignalHandlers();
  }

  log(message, color = 'reset') {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`${colors[color]}[${timestamp}] ${message}${colors.reset}`);
  }

  error(message) {
    this.log(`❌ ERROR: ${message}`, 'red');
  }

  success(message) {
    this.log(`✅ SUCCESS: ${message}`, 'green');
  }

  info(message) {
    this.log(`ℹ️  INFO: ${message}`, 'blue');
  }

  warning(message) {
    this.log(`⚠️  WARNING: ${message}`, 'yellow');
  }

  setupSignalHandlers() {
    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());
    process.on('exit', () => this.cleanup());
  }

  async shutdown() {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    this.warning('Shutting down all services...');

    // Kill all spawned processes
    this.processes.forEach(proc => {
      if (proc && !proc.killed) {
        proc.kill('SIGTERM');
      }
    });

    // Wait a bit for graceful shutdown
    await this.sleep(2000);

    // Force kill if still running
    this.processes.forEach(proc => {
      if (proc && !proc.killed) {
        proc.kill('SIGKILL');
      }
    });

    this.success('All services stopped');
    process.exit(0);
  }

  cleanup() {
    this.processes.forEach(proc => {
      if (proc && !proc.killed) {
        try {
          process.kill(proc.pid, 'SIGKILL');
        } catch (e) {
          // Process might already be dead
        }
      }
    });
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async checkPrerequisites() {
    this.info('Checking prerequisites...');

    // Check Node.js version
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);

    if (majorVersion < 18) {
      this.error(`Node.js version 18+ required. Current: ${nodeVersion}`);
      process.exit(1);
    }

    // Check if npm is available
    try {
      await this.execPromise('npm --version');
    } catch (error) {
      this.error('npm is not installed or not in PATH');
      process.exit(1);
    }

    // Check directories
    if (!fs.existsSync('backend')) {
      this.error('Backend directory not found');
      process.exit(1);
    }

    if (!fs.existsSync('frontend')) {
      this.error('Frontend directory not found');
      process.exit(1);
    }

    this.success('Prerequisites check passed');
  }

  execPromise(command) {
    return new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error) reject(error);
        else resolve(stdout);
      });
    });
  }

  async installDependencies() {
    this.info('Checking dependencies...');

    // Backend dependencies
    if (!fs.existsSync('backend/node_modules')) {
      this.info('Installing backend dependencies...');
      await this.execPromise('cd backend && npm install');
      this.success('Backend dependencies installed');
    } else {
      this.info('Backend dependencies already installed');
    }

    // Frontend dependencies
    if (!fs.existsSync('frontend/node_modules')) {
      this.info('Installing frontend dependencies...');
      await this.execPromise('cd frontend && npm install');
      this.success('Frontend dependencies installed');
    } else {
      this.info('Frontend dependencies already installed');
    }
  }

  async setupEnvironment() {
    this.info('Setting up environment configuration...');

    // Backend .env
    if (!fs.existsSync('backend/.env')) {
      if (fs.existsSync('backend/.env.example')) {
        fs.copyFileSync('backend/.env.example', 'backend/.env');
        this.success('Backend .env created from template');
      } else {
        const defaultEnv = `PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
MONGODB_URI=mongodb://localhost:27017/xrpl-medical-records
XRPL_TESTNET=true
ENABLE_DEMO_MODE=true`;
        fs.writeFileSync('backend/.env', defaultEnv);
        this.success('Backend .env created with defaults');
      }
    }

    // Frontend .env
    if (!fs.existsSync('frontend/.env')) {
      const frontendEnv = 'VITE_API_URL=http://localhost:3000';
      fs.writeFileSync('frontend/.env', frontendEnv);
      this.success('Frontend .env created');
    }
  }

  async waitForService(url, serviceName, timeout = 60000) {
    this.info(`Waiting for ${serviceName} to be ready...`);

    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      try {
        await this.httpGet(url);
        this.success(`${serviceName} is ready!`);
        return true;
      } catch (error) {
        process.stdout.write('.');
        await this.sleep(2000);
      }
    }

    console.log(''); // New line after dots
    this.error(`${serviceName} failed to start within ${timeout / 1000} seconds`);
    return false;
  }

  httpGet(url) {
    return new Promise((resolve, reject) => {
      const request = http.get(url, (response) => {
        if (response.statusCode === 200) {
          resolve();
        } else {
          reject(new Error(`HTTP ${response.statusCode}`));
        }
      });

      request.on('error', reject);
      request.setTimeout(5000, () => {
        request.destroy();
        reject(new Error('Timeout'));
      });
    });
  }

  spawnProcess(command, args, options = {}) {
    const proc = spawn(command, args, {
      stdio: options.silent ? 'pipe' : 'inherit',
      shell: true,
      ...options
    });

    this.processes.push(proc);

    proc.on('error', (error) => {
      this.error(`Process error: ${error.message}`);
    });

    return proc;
  }

  async startBackend() {
    this.info('Starting backend server...');

    const backendProcess = this.spawnProcess('npm', ['run', 'dev'], {
      cwd: path.resolve('backend'),
      silent: false
    });

    // Wait for backend to be ready
    const isReady = await this.waitForService('http://localhost:3000/api/health', 'Backend');

    if (isReady) {
      this.success('✅ Backend is running at http://localhost:3000');
      return backendProcess;
    } else {
      this.error('❌ Backend failed to start');
      process.exit(1);
    }
  }

  async startFrontend() {
    this.info('Starting frontend development server...');

    const frontendProcess = this.spawnProcess('npm', ['run', 'dev'], {
      cwd: path.resolve('frontend'),
      silent: false
    });

    // Wait for frontend to be ready
    const isReady = await this.waitForService('http://localhost:5173', 'Frontend');

    if (isReady) {
      this.success('✅ Frontend is running at http://localhost:5173');
      return frontendProcess;
    } else {
      this.error('❌ Frontend failed to start');
      process.exit(1);
    }
  }

  async start() {
    try {
      console.log(`${colors.green}
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║        🚀 XRPL Medical Records Platform Launcher            ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
${colors.reset}`);

      await this.checkPrerequisites();
      await this.installDependencies();
      await this.setupEnvironment();

      this.success('🎬 Starting services...');

      // Start backend first
      await this.startBackend();
      await this.sleep(2000); // Give backend a moment

      // Start frontend
      await this.startFrontend();

      console.log(`${colors.green}
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   🎉 XRPL Medical Records Platform is now running!          ║
║                                                              ║
║   📱 Frontend:  http://localhost:5173                       ║
║   🔧 Backend:   http://localhost:3000                       ║
║   💚 Health:    http://localhost:3000/api/health            ║
║   🔍 Blockchain: http://localhost:3000/api/blockchain/health ║
║                                                              ║
║   🛑 Press Ctrl+C to stop all services                      ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
${colors.reset}`);

      // Keep the process running
      await new Promise(resolve => {
        process.on('SIGINT', resolve);
        process.on('SIGTERM', resolve);
      });

    } catch (error) {
      this.error(`Startup failed: ${error.message}`);
      process.exit(1);
    }
  }
}

// Run the launcher
if (require.main === module) {
  const launcher = new PlatformLauncher();
  launcher.start().catch(console.error);
}

module.exports = PlatformLauncher;