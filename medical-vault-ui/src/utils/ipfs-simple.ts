// Simplified IPFS utilities for better compatibility

// For demo purposes, we'll use a mock IPFS implementation
// In production, you'd want to use a proper IPFS client or Pinata/Infura

interface MockIPFSFile {
  cid: string
  content: string
  uploadedAt: number
}

// Simple in-memory storage (for demo only)
const mockIPFSStorage = new Map<string, MockIPFSFile>()

// Generate a mock CID
function generateMockCID(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substr(2, 9)
  return `Qm${timestamp}${random}`.substr(0, 46)
}

// Mock upload function
export async function uploadToIPFSSimple(file: File): Promise<string> {
  try {
    // Convert file to base64 for storage
    const arrayBuffer = await file.arrayBuffer()
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))

    const cid = generateMockCID()

    mockIPFSStorage.set(cid, {
      cid,
      content: base64,
      uploadedAt: Date.now()
    })

    console.log(`Mock IPFS upload: ${file.name} -> ${cid}`)

    return cid
  } catch (error) {
    throw new Error(`Mock IPFS upload failed: ${error}`)
  }
}

// Mock download function
export async function downloadFromIPFSSimple(cid: string): Promise<Uint8Array> {
  try {
    const stored = mockIPFSStorage.get(cid)

    if (!stored) {
      throw new Error(`File not found in mock IPFS: ${cid}`)
    }

    // Convert base64 back to Uint8Array
    const binaryString = atob(stored.content)
    const bytes = new Uint8Array(binaryString.length)

    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }

    console.log(`Mock IPFS download: ${cid}`)

    return bytes
  } catch (error) {
    throw new Error(`Mock IPFS download failed: ${error}`)
  }
}

// Upload text to mock IPFS
export async function uploadTextToIPFSSimple(text: string): Promise<string> {
  try {
    const blob = new Blob([text], { type: 'text/plain' })
    const file = new File([blob], 'text.txt', { type: 'text/plain' })
    return await uploadToIPFSSimple(file)
  } catch (error) {
    throw new Error(`Mock IPFS text upload failed: ${error}`)
  }
}

// Download text from mock IPFS
export async function downloadTextFromIPFSSimple(cid: string): Promise<string> {
  try {
    const bytes = await downloadFromIPFSSimple(cid)
    return new TextDecoder().decode(bytes)
  } catch (error) {
    throw new Error(`Mock IPFS text download failed: ${error}`)
  }
}

// Convert CID to gateway URL (works for both real and mock)
export function ipfsToGatewayUrlSimple(cid: string, gateway: string = 'https://ipfs.io/ipfs/'): string {
  if (cid.startsWith('ipfs://')) {
    return cid.replace('ipfs://', gateway)
  }
  return `${gateway}${cid}`
}

// Get mock file info
export async function getIPFSFileInfoSimple(cid: string): Promise<{ size: number; name?: string }> {
  try {
    const stored = mockIPFSStorage.get(cid)

    if (!stored) {
      // For demo, return mock data
      return { size: 1024, name: 'mock-file.dat' }
    }

    const size = Math.ceil(stored.content.length * 0.75) // Approximate original size

    return { size, name: `file-${cid.substr(0, 8)}.dat` }
  } catch (error) {
    throw new Error(`Failed to get mock file info: ${error}`)
  }
}

// List all mock files (for debugging)
export function listMockIPFSFiles(): MockIPFSFile[] {
  return Array.from(mockIPFSStorage.values())
}