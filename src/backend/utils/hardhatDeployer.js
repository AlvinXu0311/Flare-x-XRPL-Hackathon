const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

class HardhatDeployer {
  constructor() {
    this.projectRoot = path.join(__dirname, '..');
    this.configPath = path.join(this.projectRoot, 'hardhat.config.js');
  }

  async updateHardhatConfig(privateKey) {
    console.log('📝 Updating Hardhat config with deployment key...');

    let config = await fs.readFile(this.configPath, 'utf8');

    // Replace the accounts array with the provided private key
    config = config.replace(
      'accounts: [], // Will be populated dynamically',
      `accounts: ["${privateKey}"], // Populated with deployment key`
    );

    await fs.writeFile(this.configPath, config);
    console.log('✅ Hardhat config updated');
  }

  async runHardhatCommand(args) {
    return new Promise((resolve) => {
      console.log(`🔨 Running: hardhat ${args.join(' ')}`);

      const process = spawn('npx', ['hardhat', ...args], {
        cwd: this.projectRoot,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let output = '';
      let error = '';

      process.stdout.on('data', (data) => {
        const text = data.toString();
        output += text;
        console.log(text.trim());
      });

      process.stderr.on('data', (data) => {
        const text = data.toString();
        error += text;
        console.error(text.trim());
      });

      process.on('close', (code) => {
        resolve({
          success: code === 0,
          output,
          error: error || (code !== 0 ? `Process exited with code ${code}` : null),
          code
        });
      });
    });
  }

  async deployContract(privateKey, progressCallback = null) {
    try {
      console.log('🚀 Starting real contract deployment to Flare Coston2...');

      if (progressCallback) {
        progressCallback({
          step: 'config_update',
          message: 'Updating Hardhat configuration...'
        });
      }

      // Update Hardhat config with the deployment private key
      await this.updateHardhatConfig(privateKey);

      console.log('📝 Compiling contract with Hardhat...');

      if (progressCallback) {
        progressCallback({
          step: 'compiling',
          message: 'Compiling smart contract...'
        });
      }

      // Compile the contract first
      const compileResult = await this.runHardhatCommand(['compile']);
      if (!compileResult.success) {
        throw new Error(`Contract compilation failed: ${compileResult.error}`);
      }

      console.log('🚀 Deploying contract to Flare Coston2...');

      if (progressCallback) {
        progressCallback({
          step: 'deploying',
          message: 'Deploying contract to Flare Coston2 network...'
        });
      }

      // Deploy the contract
      const deployResult = await this.runHardhatCommand(['run', 'scripts/deploy.js', '--network', 'flareCoston2']);
      if (!deployResult.success) {
        throw new Error(`Contract deployment failed: ${deployResult.error}`);
      }

      if (progressCallback) {
        progressCallback({
          step: 'extracting',
          message: 'Extracting contract address...'
        });
      }

      // Extract contract address from deployment output
      const contractAddressMatch = deployResult.output.match(/📄 Contract address: (0x[a-fA-F0-9]{40})/);
      if (!contractAddressMatch) {
        throw new Error('Failed to extract contract address from deployment output');
      }

      const contractAddress = contractAddressMatch[1];

      console.log(`✅ Contract deployed successfully to: ${contractAddress}`);

      if (progressCallback) {
        progressCallback({
          step: 'completed',
          message: `Contract deployed successfully to ${contractAddress}`
        });
      }

      return {
        success: true,
        contractAddress,
        network: 'Flare Coston2',
        transactionHash: null, // Could extract from output if needed
        deploymentOutput: deployResult.output
      };

    } catch (error) {
      console.error('❌ Contract deployment failed:', error.message);

      if (progressCallback) {
        progressCallback({
          step: 'error',
          message: `Deployment failed: ${error.message}`
        });
      }

      throw error;
    }
  }
}

module.exports = HardhatDeployer;