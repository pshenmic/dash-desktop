import {Network} from '../src/types'

// Per-network chain anchor: the (height, hash) pair that header sync starts
// from when chain.db is empty. The hash is in display order (Bitcoin/Dash
// convention — what explorers and `getblockhash` print). Height matches the
// position of that block in Dash Core's height numbering.
//
// Genesis is at height 1 in Dash, NOT 0. Setting this to (0, hash) made
// every persisted height +1 from the real chain and broke cfilter requests
// (off-by-one between our heights and peer-reported heights).
export interface ChainAnchor {
  height: number
  hash: string
}

export const GENESIS: Record<Network, ChainAnchor> = {
  mainnet: {
    height: 1,
    hash: '00000ffd590b1485b3caadc19b22e6379c733355108f107a430458cdf3407ab6',
  },
  testnet: {
    height: 1,
    hash: '0000047d24635e347be3aaaeb66c26be94901a2f962feccd4f95090191f208c1',
  },
}

// Convenience accessor — kept for the cfilter genesis-seed code path which
// only needs the hash string.
export const GENESIS_HASH: Record<Network, string> = {
  mainnet: GENESIS.mainnet.hash,
  testnet: GENESIS.testnet.hash,
}