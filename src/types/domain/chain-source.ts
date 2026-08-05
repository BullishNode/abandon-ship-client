export interface EsploraChainSource {
  esplora: { url: string }
}

export interface BitcoindChainSource {
  bitcoind: {
    bitcoind: string
    bitcoindAuth: { cookie: { cookie: string } }
  }
}

export type ChainSource = EsploraChainSource | BitcoindChainSource
