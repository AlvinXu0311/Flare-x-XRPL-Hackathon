import { ethers } from 'ethers'

interface FlareContractRegistry {
  getContractAddressByName(name: string): Promise<string>
  getAllContracts(): Promise<{ names: string[], addresses: string[] }>
}

interface FdcHubRequest {
  attestationType: string
  sourceId: string
  requestBody: string
  fee: number
}

interface FdcVerificationProof {
  merkleRoot: string
  merkleProof: string[]
  data: string
}

interface FtsoV2PriceData {
  price: string
  timestamp: number
  decimals: number
}

class RealFdcService {
  private provider: ethers.providers.Web3Provider | null = null
  private registryAddress = '0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019'
  private cache: Map<string, any> = new Map()

  constructor() {
    if (window.ethereum) {
      this.provider = new ethers.providers.Web3Provider(window.ethereum as any)
    }
  }

  private async getRegistry(): Promise<FlareContractRegistry> {
    if (!this.provider) {
      throw new Error('No Web3 provider available')
    }

    const registryAbi = [
      'function getContractAddressByName(string calldata _name) external view returns (address)',
      'function getAllContracts() external view returns (string[] memory _names, address[] memory _addresses)'
    ]

    const registry = new ethers.Contract(this.registryAddress, registryAbi, this.provider)
    return registry as unknown as FlareContractRegistry
  }

  async getFdcHubAddress(): Promise<string> {
    const cacheKey = 'fdcHub'
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)
    }

    try {
      const registry = await this.getRegistry()
      const address = await registry.getContractAddressByName('FdcHub')

      if (address === ethers.constants.AddressZero) {
        throw new Error('FdcHub not found in registry')
      }

      this.cache.set(cacheKey, address)
      return address
    } catch (error) {
      console.error('Failed to get FdcHub address:', error)
      throw error
    }
  }

  async getFdcVerificationAddress(): Promise<string> {
    const cacheKey = 'fdcVerification'
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)
    }

    try {
      const registry = await this.getRegistry()
      const address = await registry.getContractAddressByName('FdcVerification')

      if (address === ethers.constants.AddressZero) {
        throw new Error('FdcVerification not found in registry')
      }

      this.cache.set(cacheKey, address)
      return address
    } catch (error) {
      console.error('Failed to get FdcVerification address:', error)
      throw error
    }
  }

  async getFtsoV2Address(): Promise<string> {
    const cacheKey = 'ftsoV2'
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)
    }

    try {
      const registry = await this.getRegistry()
      const address = await registry.getContractAddressByName('FtsoV2')

      if (address === ethers.constants.AddressZero) {
        throw new Error('FtsoV2 not found in registry')
      }

      this.cache.set(cacheKey, address)
      return address
    } catch (error) {
      console.error('Failed to get FtsoV2 address:', error)
      throw error
    }
  }

  async getAllFlareContracts(): Promise<{ names: string[], addresses: string[] }> {
    const cacheKey = 'allContracts'
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)
    }

    try {
      const registry = await this.getRegistry()
      const result = await registry.getAllContracts()

      this.cache.set(cacheKey, result)
      return result
    } catch (error) {
      console.error('Failed to get all Flare contracts:', error)
      throw error
    }
  }

  async submitFdcAttestationRequest(
    attestationType: string,
    sourceId: string,
    requestBody: any,
    fee: number
  ): Promise<string> {
    if (!this.provider) {
      throw new Error('No Web3 provider available')
    }

    try {
      const fdcHubAddress = await this.getFdcHubAddress()

      const fdcHubAbi = [
        `function requestAttestation(
          tuple(bytes32 attestationType, bytes32 sourceId, bytes requestBody, uint256 fee) _request
        ) external payable returns (bytes32)`,
        'function getAttestationFee(bytes32 _attestationType) external view returns (uint256)'
      ]

      const signer = this.provider.getSigner()
      const fdcHub = new ethers.Contract(fdcHubAddress, fdcHubAbi, signer)

      // Convert parameters to proper format
      const attestationTypeHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(attestationType))
      const sourceIdHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(sourceId))
      const encodedRequestBody = ethers.utils.defaultAbiCoder.encode(['string'], [JSON.stringify(requestBody)])

      const request = {
        attestationType: attestationTypeHash,
        sourceId: sourceIdHash,
        requestBody: encodedRequestBody,
        fee: ethers.utils.parseEther(fee.toString())
      }

      console.log('Submitting FDC attestation request:', request)

      const tx = await fdcHub.requestAttestation(request, {
        value: ethers.utils.parseEther(fee.toString())
      })

      const receipt = await tx.wait()
      console.log('FDC attestation request submitted:', receipt.transactionHash)

      // Extract request ID from logs (implementation depends on FDC event structure)
      const requestId = receipt.transactionHash // Simplified for now
      return requestId

    } catch (error) {
      console.error('Failed to submit FDC attestation request:', error)
      throw error
    }
  }

  async verifyFdcProof(proof: FdcVerificationProof): Promise<boolean> {
    if (!this.provider) {
      throw new Error('No Web3 provider available')
    }

    try {
      const fdcVerificationAddress = await this.getFdcVerificationAddress()

      const fdcVerificationAbi = [
        `function verifyAttestation(
          tuple(bytes32 merkleRoot, bytes32[] merkleProof, bytes data) _proof
        ) external view returns (bool)`
      ]

      const fdcVerification = new ethers.Contract(fdcVerificationAddress, fdcVerificationAbi, this.provider)

      const formattedProof = {
        merkleRoot: proof.merkleRoot,
        merkleProof: proof.merkleProof,
        data: proof.data
      }

      console.log('Verifying FDC proof:', formattedProof)

      const isValid = await fdcVerification.verifyAttestation(formattedProof)
      console.log('FDC proof verification result:', isValid)

      return isValid

    } catch (error) {
      console.error('Failed to verify FDC proof:', error)
      throw error
    }
  }

  async getCurrentXrpPrice(): Promise<FtsoV2PriceData> {
    if (!this.provider) {
      throw new Error('No Web3 provider available')
    }

    const cacheKey = 'xrpPrice'
    const cachedPrice = this.cache.get(cacheKey)

    // Use cached price if less than 30 seconds old
    if (cachedPrice && Date.now() - cachedPrice.timestamp < 30000) {
      return cachedPrice
    }

    try {
      const ftsoV2Address = await this.getFtsoV2Address()

      // Use the actual FTSO v2 interface from Flare documentation
      const ftsoV2Abi = [
        'function getCurrentPriceWithDecimals(bytes21 _feedId) external view returns (uint256 _price, uint8 _decimals, uint64 _timestamp)',
        'function getCurrentPrice(bytes21 _feedId) external view returns (uint256 _price, uint64 _timestamp)',
        'function getDecimals(bytes21 _feedId) external view returns (uint8)',
        'function getAllCurrentPrices() external view returns (tuple(bytes21 feedId, uint256 value, uint8 decimals, uint64 timestamp)[] prices)',
        'function getFeedName(bytes21 _feedId) external view returns (string memory)',
        'function getSupportedFeeds() external view returns (bytes21[] memory)'
      ]

      const ftsoV2 = new ethers.Contract(ftsoV2Address, ftsoV2Abi, this.provider)

      console.log('Getting XRP price from FTSO v2...')

      // First, try to get all supported feeds to find XRP
      let xrpFeedId = null
      try {
        console.log('🔍 Discovering all supported feeds...')
        const supportedFeeds = await ftsoV2.getSupportedFeeds()
        console.log(`Found ${supportedFeeds.length} supported feeds`)

        // Look for XRP feed by checking feed names
        for (const feedId of supportedFeeds) {
          try {
            const feedName = await ftsoV2.getFeedName(feedId)
            console.log(`Feed ${feedId}: ${feedName}`)

            if (feedName && (
              feedName.toLowerCase().includes('xrp') ||
              feedName.toLowerCase().includes('ripple')
            )) {
              console.log(`🎯 Found XRP feed: ${feedId} (${feedName})`)
              xrpFeedId = feedId
              break
            }
          } catch (error) {
            // Skip feeds without names
            continue
          }
        }
      } catch (error) {
        console.warn('Could not discover feeds from contract:', error)
      }

      // If no XRP feed found through discovery, try common XRP feed IDs for bytes21 format
      const possibleFeedIds = [
        xrpFeedId, // Discovered feed (if any)
        '0x01585250000000000000000000000000000000000000', // XRP/USD (21 bytes)
        '0x58525020555344000000000000000000000000000000', // 'XRP USD' (21 bytes)
        '0x58525000000000000000000000000000000000000000', // 'XRP' (21 bytes)
        '0x00585250000000000000000000000000000000000000'  // Alternative XRP (21 bytes)
      ].filter(Boolean) // Remove null values

      let priceData = null
      let lastError = null

      // Try each feed ID
      for (const feedId of possibleFeedIds) {
        try {
          console.log(`Trying feed ID: ${feedId}`)

          // Try getCurrentPriceWithDecimals first (most complete)
          try {
            const result = await ftsoV2.getCurrentPriceWithDecimals(feedId)
            priceData = {
              _price: result._price,
              _timestamp: result._timestamp,
              _decimals: result._decimals
            }
            console.log(`✅ Success with getCurrentPriceWithDecimals for feed ID: ${feedId}`)
            break
          } catch (error) {
            // Try alternative method
            console.log(`Trying getCurrentPrice for feed ID: ${feedId}`)
            const priceResult = await ftsoV2.getCurrentPrice(feedId)
            const decimals = await ftsoV2.getDecimals(feedId)

            priceData = {
              _price: priceResult._price,
              _timestamp: priceResult._timestamp,
              _decimals: decimals
            }
            console.log(`✅ Success with getCurrentPrice for feed ID: ${feedId}`)
            break
          }
        } catch (error) {
          console.warn(`❌ Feed ID ${feedId} failed:`, error)
          lastError = error
          continue
        }
      }

      if (!priceData) {
        throw lastError || new Error('No valid XRP feed ID found')
      }

      const result = {
        price: priceData._price.toString(),
        timestamp: priceData._timestamp.toNumber(),
        decimals: priceData._decimals
      }

      // Cache the result
      this.cache.set(cacheKey, { ...result, timestamp: Date.now() })

      console.log('XRP price from FTSO v2:', result)
      return result

    } catch (error: any) {
      console.error('Failed to get XRP price from FTSO v2:', error)

      // For development/testing, provide a mock price when real FTSO is unavailable
      if (import.meta.env.DEV || import.meta.env.VITE_ALLOW_MOCK_FTSO === 'true') {
        console.warn('🚨 Using mock XRP price for development/testing')
        return {
          price: '620000', // $0.62 with 6 decimals
          timestamp: Math.floor(Date.now() / 1000),
          decimals: 6
        }
      }

      throw new Error(`Real FTSO v2 price feed unavailable: ${error?.message || error}. Ensure Flare network connectivity and FTSO v2 service availability.`)
    }
  }

  async calculateRequiredXrpDrops(usdAmount: number): Promise<number> {
    try {
      const priceData = await this.getCurrentXrpPrice()
      const priceInUsd = parseFloat(priceData.price) / Math.pow(10, priceData.decimals)

      if (priceInUsd <= 0) {
        throw new Error('Invalid XRP price')
      }

      const xrpAmount = usdAmount / priceInUsd
      const drops = Math.ceil(xrpAmount * 1000000) // Convert XRP to drops

      console.log('XRP calculation:', {
        usdAmount,
        priceInUsd,
        xrpAmount,
        drops
      })

      return drops

    } catch (error: any) {
      console.error('Failed to calculate required XRP drops:', error)
      throw new Error(`XRP calculation failed: ${error?.message || error}. Real-time pricing unavailable.`)
    }
  }

  async isRealFdcAvailable(): Promise<boolean> {
    try {
      await this.getFdcHubAddress()
      await this.getFdcVerificationAddress()
      await this.getFtsoV2Address()
      return true
    } catch (error) {
      console.warn('Real FDC not available:', error)
      return false
    }
  }

  clearCache(): void {
    console.log('🧹 Clearing Real FDC service cache...')
    this.cache.clear()
  }

  async getSystemStatus(): Promise<{
    registryConnected: boolean
    fdcHubAvailable: boolean
    fdcVerificationAvailable: boolean
    ftsoV2Available: boolean
    contracts: { names: string[], addresses: string[] }
  }> {
    try {
      const registry = await this.getRegistry()
      const contracts = await this.getAllFlareContracts()

      const status = {
        registryConnected: true,
        fdcHubAvailable: false,
        fdcVerificationAvailable: false,
        ftsoV2Available: false,
        contracts
      }

      try {
        await this.getFdcHubAddress()
        status.fdcHubAvailable = true
      } catch {}

      try {
        await this.getFdcVerificationAddress()
        status.fdcVerificationAvailable = true
      } catch {}

      try {
        await this.getFtsoV2Address()
        status.ftsoV2Available = true
      } catch {}

      return status

    } catch (error) {
      return {
        registryConnected: false,
        fdcHubAvailable: false,
        fdcVerificationAvailable: false,
        ftsoV2Available: false,
        contracts: { names: [], addresses: [] }
      }
    }
  }

  // Discover XRP-related feeds from FTSO v2 contract using getAllCurrentPrices
  private async discoverXrpFeeds(ftsoV2Contract: any): Promise<string[]> {
    const xrpFeeds: string[] = []

    try {
      // Use getAllCurrentPrices to discover available feeds
      console.log('🔍 Getting all current prices to discover feeds...')
      const allPrices = await ftsoV2Contract.getAllCurrentPrices()

      for (const priceData of allPrices) {
        try {
          const feedId = priceData.feedId
          const feedName = await ftsoV2Contract.getFeedName(feedId)
          console.log(`Feed ${feedId}: ${feedName} (Price: ${priceData.value}, Decimals: ${priceData.decimals})`)

          // Look for XRP-related feeds
          if (feedName && (
            feedName.toLowerCase().includes('xrp') ||
            feedName.toLowerCase().includes('ripple')
          )) {
            console.log(`🎯 Found XRP feed: ${feedId} (${feedName})`)
            xrpFeeds.push(feedId)
          }
        } catch (error) {
          // Some feeds might not have names, skip silently
          continue
        }
      }
    } catch (error) {
      console.warn('Could not query all current prices:', error)

      // Fallback: try getSupportedFeeds if available
      try {
        const supportedFeeds = await ftsoV2Contract.getSupportedFeeds()
        console.log(`Fallback: found ${supportedFeeds.length} supported feeds`)

        for (const feedId of supportedFeeds) {
          try {
            const feedName = await ftsoV2Contract.getFeedName(feedId)
            console.log(`Feed ${feedId}: ${feedName}`)

            if (feedName && (
              feedName.toLowerCase().includes('xrp') ||
              feedName.toLowerCase().includes('ripple')
            )) {
              console.log(`🎯 Found XRP feed: ${feedId} (${feedName})`)
              xrpFeeds.push(feedId)
            }
          } catch (error) {
            continue
          }
        }
      } catch (fallbackError) {
        console.warn('Fallback feed discovery also failed:', fallbackError)
      }
    }

    return xrpFeeds
  }
}

// Export singleton instance
export const realFdcService = new RealFdcService()
export type { FdcHubRequest, FdcVerificationProof, FtsoV2PriceData }