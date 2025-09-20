const { Client, Wallet, xrpToDrops, dropsToXrp } = require('xrpl');
const crypto = require('crypto');

class XRPLService {
  constructor() {
    this.client = null;
    this.platformWallet = null;
    this.networkUrl = process.env.XRPL_NETWORK || 'wss://s.altnet.rippletest.net:51233';
    this.isTestNet = process.env.XRPL_TESTNET === 'true';
  }

  async initialize() {
    try {
      this.client = new Client(this.networkUrl);
      await this.client.connect();

      if (process.env.PLATFORM_WALLET_SEED) {
        this.platformWallet = Wallet.fromSeed(process.env.PLATFORM_WALLET_SEED);
      } else {
        this.platformWallet = Wallet.generate();
        console.log('⚠️ Generated new platform wallet. Save this seed:', this.platformWallet.seed);
      }

      console.log('✅ XRPL Service initialized');
      console.log(`🌐 Network: ${this.networkUrl}`);
      console.log(`💰 Platform Wallet: ${this.platformWallet.address}`);

      return true;
    } catch (error) {
      console.error('❌ Failed to initialize XRPL Service:', error);
      throw error;
    }
  }

  async disconnect() {
    if (this.client && this.client.isConnected()) {
      await this.client.disconnect();
      console.log('🔌 Disconnected from XRPL');
    }
  }

  async getAccountInfo(address) {
    try {
      if (!this.client || !this.client.isConnected()) {
        throw new Error('XRPL client not connected');
      }

      const response = await this.client.request({
        command: 'account_info',
        account: address,
        ledger_index: 'validated'
      });

      return {
        address: response.result.account_data.Account,
        balance: dropsToXrp(response.result.account_data.Balance),
        sequence: response.result.account_data.Sequence,
        flags: response.result.account_data.Flags,
        ownerCount: response.result.account_data.OwnerCount
      };
    } catch (error) {
      console.error('Error getting account info:', error);
      throw error;
    }
  }

  async mintToUserWallet(evaluationData, userSeed) {
    try {
      if (!this.client || !this.client.isConnected()) {
        throw new Error('XRPL client not connected');
      }

      // Create user wallet from seed
      const userWallet = Wallet.fromSeed(userSeed);
      console.log('🔑 Using user wallet:', userWallet.address);

      const metadata = {
        patientName: `${evaluationData.patientInfo.firstName} ${evaluationData.patientInfo.lastName}`,
        evaluationType: evaluationData.patientInfo.evaluationType,
        uploadDate: new Date().toISOString(),
        fileHash: evaluationData.fileHash,
        platform: 'XRPL Medical Records',
        ownedBy: 'patient'
      };

      const uri = Buffer.from(JSON.stringify(metadata)).toString('hex').toUpperCase();

      const mintTransaction = {
        TransactionType: 'NFTokenMint',
        Account: userWallet.address,
        URI: uri,
        Flags: 8,
        NFTokenTaxon: 0,
        TransferFee: 1000
      };

      const prepared = await this.client.autofill(mintTransaction);
      const signed = userWallet.sign(prepared);
      const result = await this.client.submitAndWait(signed.tx_blob);

      if (result.result.meta.TransactionResult === 'tesSUCCESS') {
        const nfTokenPage = result.result.meta.AffectedNodes.find(
          node => node.ModifiedNode?.LedgerEntryType === 'NFTokenPage' ||
                  node.CreatedNode?.LedgerEntryType === 'NFTokenPage'
        );

        if (nfTokenPage) {
          const tokenPage = nfTokenPage.ModifiedNode || nfTokenPage.CreatedNode;
          const tokens = tokenPage.FinalFields?.NFTokens || tokenPage.NewFields?.NFTokens;

          if (tokens && tokens.length > 0) {
            const newToken = tokens[tokens.length - 1].NFToken;

            return {
              nftTokenId: newToken.NFTokenID,
              transactionHash: result.result.hash,
              ledgerIndex: result.result.ledger_index,
              metadata,
              platformWallet: userWallet.address,
              mintedBy: 'user',
              userOwned: true
            };
          }
        }
      }

      throw new Error('NFT minting failed: ' + result.result.meta.TransactionResult);
    } catch (error) {
      console.error('Error minting NFT to user wallet:', error);
      throw error;
    }
  }

  async mintEvaluationNFT(evaluationData) {
    try {
      if (!this.client || !this.client.isConnected()) {
        throw new Error('XRPL client not connected');
      }

      const metadata = {
        patientName: `${evaluationData.patientInfo.firstName} ${evaluationData.patientInfo.lastName}`,
        evaluationType: evaluationData.patientInfo.evaluationType,
        uploadDate: new Date().toISOString(),
        fileHash: evaluationData.fileHash,
        platform: 'XRPL Medical Records',
        ownedBy: 'platform'
      };

      const uri = Buffer.from(JSON.stringify(metadata)).toString('hex').toUpperCase();

      const mintTransaction = {
        TransactionType: 'NFTokenMint',
        Account: this.platformWallet.address,
        URI: uri,
        Flags: 8,
        NFTokenTaxon: 0,
        TransferFee: 1000
      };

      const prepared = await this.client.autofill(mintTransaction);
      const signed = this.platformWallet.sign(prepared);
      const result = await this.client.submitAndWait(signed.tx_blob);

      if (result.result.meta.TransactionResult === 'tesSUCCESS') {
        const nfTokenPage = result.result.meta.AffectedNodes.find(
          node => node.ModifiedNode?.LedgerEntryType === 'NFTokenPage' ||
                  node.CreatedNode?.LedgerEntryType === 'NFTokenPage'
        );

        if (nfTokenPage) {
          const tokenPage = nfTokenPage.ModifiedNode || nfTokenPage.CreatedNode;
          const tokens = tokenPage.FinalFields?.NFTokens || tokenPage.NewFields?.NFTokens;

          if (tokens && tokens.length > 0) {
            const newToken = tokens[tokens.length - 1].NFToken;

            return {
              nftTokenId: newToken.NFTokenID,
              transactionHash: result.result.hash,
              ledgerIndex: result.result.ledger_index,
              metadata,
              platformWallet: this.platformWallet.address
            };
          }
        }
      }

      throw new Error('NFT minting failed: ' + result.result.meta.TransactionResult);
    } catch (error) {
      console.error('Error minting NFT:', error);
      throw error;
    }
  }

  async createPaymentIntent(amount, sourceWallet, evaluationId) {
    try {
      const xrpRate = await this.getXRPRate();
      const xrpAmount = (amount / xrpRate).toFixed(6);

      const paymentIntent = {
        id: crypto.randomUUID(),
        amount,
        xrpAmount,
        sourceWallet,
        destinationWallet: this.platformWallet.address,
        evaluationId,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        memo: `Medical evaluation access payment - ${evaluationId}`
      };

      return paymentIntent;
    } catch (error) {
      console.error('Error creating payment intent:', error);
      throw error;
    }
  }

  async verifyPayment(transactionHash) {
    try {
      if (!this.client || !this.client.isConnected()) {
        throw new Error('XRPL client not connected');
      }

      const response = await this.client.request({
        command: 'tx',
        transaction: transactionHash
      });

      const transaction = response.result;

      if (transaction.TransactionType !== 'Payment') {
        throw new Error('Transaction is not a payment');
      }

      if (transaction.Destination !== this.platformWallet.address) {
        throw new Error('Payment destination does not match platform wallet');
      }

      if (transaction.meta.TransactionResult !== 'tesSUCCESS') {
        throw new Error('Transaction was not successful');
      }

      return {
        hash: transaction.hash,
        amount: dropsToXrp(transaction.Amount),
        source: transaction.Account,
        destination: transaction.Destination,
        ledgerIndex: transaction.ledger_index,
        timestamp: transaction.date,
        validated: true,
        memo: transaction.Memos?.[0]?.Memo?.MemoData
          ? Buffer.from(transaction.Memos[0].Memo.MemoData, 'hex').toString()
          : null
      };
    } catch (error) {
      console.error('Error verifying payment:', error);
      throw error;
    }
  }

  async mintAccessNFT(accessData) {
    try {
      const metadata = {
        type: 'AccessToken',
        evaluationId: accessData.evaluationId,
        hospitalId: accessData.hospitalId,
        grantedAt: new Date().toISOString(),
        expiresAt: accessData.expiresAt,
        paymentAmount: accessData.paymentAmount,
        transactionHash: accessData.transactionHash
      };

      const uri = Buffer.from(JSON.stringify(metadata)).toString('hex').toUpperCase();

      const mintTransaction = {
        TransactionType: 'NFTokenMint',
        Account: this.platformWallet.address,
        URI: uri,
        Flags: 1,
        NFTokenTaxon: 1,
        TransferFee: 0
      };

      const prepared = await this.client.autofill(mintTransaction);
      const signed = this.platformWallet.sign(prepared);
      const result = await this.client.submitAndWait(signed.tx_blob);

      if (result.result.meta.TransactionResult === 'tesSUCCESS') {
        const nfTokenPage = result.result.meta.AffectedNodes.find(
          node => node.ModifiedNode?.LedgerEntryType === 'NFTokenPage' ||
                  node.CreatedNode?.LedgerEntryType === 'NFTokenPage'
        );

        if (nfTokenPage) {
          const tokenPage = nfTokenPage.ModifiedNode || nfTokenPage.CreatedNode;
          const tokens = tokenPage.FinalFields?.NFTokens || tokenPage.NewFields?.NFTokens;

          if (tokens && tokens.length > 0) {
            const newToken = tokens[tokens.length - 1].NFToken;

            return {
              accessNftId: newToken.NFTokenID,
              transactionHash: result.result.hash,
              ledgerIndex: result.result.ledger_index,
              metadata
            };
          }
        }
      }

      throw new Error('Access NFT minting failed');
    } catch (error) {
      console.error('Error minting access NFT:', error);
      throw error;
    }
  }

  async getXRPRate() {
    try {
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ripple&vs_currencies=usd');
      const data = await response.json();
      return data.ripple.usd;
    } catch (error) {
      console.error('Error fetching XRP rate:', error);
      return 0.50;
    }
  }

  async getNFTsByAccount(address) {
    try {
      if (!this.client || !this.client.isConnected()) {
        throw new Error('XRPL client not connected');
      }

      const response = await this.client.request({
        command: 'account_nfts',
        account: address,
        ledger_index: 'validated'
      });

      return response.result.account_nfts || [];
    } catch (error) {
      console.error('Error getting NFTs:', error);
      throw error;
    }
  }

  async validateWalletAddress(address) {
    try {
      if (!address || typeof address !== 'string') {
        return false;
      }

      if (address.length < 25 || address.length > 34) {
        return false;
      }

      if (!address.startsWith('r')) {
        return false;
      }

      try {
        await this.getAccountInfo(address);
        return true;
      } catch {
        return false;
      }
    } catch {
      return false;
    }
  }

  getPlatformAddress() {
    return this.platformWallet?.address || null;
  }

  isConnected() {
    return this.client && this.client.isConnected();
  }
}

module.exports = new XRPLService();