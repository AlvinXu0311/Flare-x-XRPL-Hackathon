/// <reference types="vite/client" />
/// <reference path="./src/types/ethereum.d.ts" />

interface ImportMetaEnv {
  readonly VITE_VAULT_ADDRESS: string
  readonly VITE_COSTON2_RPC: string
  readonly VITE_COSTON2_CHAIN_ID: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
