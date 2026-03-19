/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_HUME_API_KEY: string
  readonly VITE_HUME_SECRETE_KEY: string
  // add more env variables here ...
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
