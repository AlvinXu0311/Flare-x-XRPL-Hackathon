import { createHelia } from 'helia'
import { unixfs } from '@helia/unixfs'
import { strings } from '@helia/strings'

let heliaInstance: any = null
let fs: any = null
let stringManager: any = null

// Initialize Helia IPFS instance
export async function initIPFS() {
  if (!heliaInstance) {
    heliaInstance = await createHelia()
    fs = unixfs(heliaInstance)
    stringManager = strings(heliaInstance)
  }
  return { helia: heliaInstance, fs, strings: stringManager }
}

// Upload file to IPFS
export async function uploadToIPFS(file: File): Promise<string> {
  try {
    const { fs } = await initIPFS()

    // Convert file to Uint8Array
    const arrayBuffer = await file.arrayBuffer()
    const uint8Array = new Uint8Array(arrayBuffer)

    // Add file to IPFS
    const cid = await fs.addFile({
      path: file.name,
      content: uint8Array
    })

    return cid.toString()
  } catch (error) {
    console.error('IPFS upload error:', error)
    throw new Error(`Failed to upload file to IPFS: ${error}`)
  }
}

// Upload text/JSON to IPFS
export async function uploadTextToIPFS(text: string): Promise<string> {
  try {
    const { strings } = await initIPFS()
    const cid = await strings.add(text)
    return cid.toString()
  } catch (error) {
    console.error('IPFS text upload error:', error)
    throw new Error(`Failed to upload text to IPFS: ${error}`)
  }
}

// Download file from IPFS
export async function downloadFromIPFS(cid: string): Promise<Uint8Array> {
  try {
    const { fs } = await initIPFS()

    const chunks: Uint8Array[] = []
    for await (const chunk of fs.cat(cid)) {
      chunks.push(chunk)
    }

    // Combine all chunks
    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0)
    const result = new Uint8Array(totalLength)
    let offset = 0

    for (const chunk of chunks) {
      result.set(chunk, offset)
      offset += chunk.length
    }

    return result
  } catch (error) {
    console.error('IPFS download error:', error)
    throw new Error(`Failed to download from IPFS: ${error}`)
  }
}

// Download text from IPFS
export async function downloadTextFromIPFS(cid: string): Promise<string> {
  try {
    const { strings } = await initIPFS()
    return await strings.get(cid)
  } catch (error) {
    console.error('IPFS text download error:', error)
    throw new Error(`Failed to download text from IPFS: ${error}`)
  }
}

// Convert IPFS CID to gateway URL
export function ipfsToGatewayUrl(cid: string, gateway: string = 'https://ipfs.io/ipfs/'): string {
  if (cid.startsWith('ipfs://')) {
    return cid.replace('ipfs://', gateway)
  }
  return `${gateway}${cid}`
}

// Get file info from IPFS
export async function getIPFSFileInfo(cid: string): Promise<{ size: number; name?: string }> {
  try {
    const { fs } = await initIPFS()
    const stat = await fs.stat(cid)
    return {
      size: stat.size,
      name: stat.path
    }
  } catch (error) {
    console.error('IPFS file info error:', error)
    throw new Error(`Failed to get file info from IPFS: ${error}`)
  }
}