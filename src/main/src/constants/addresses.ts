import {AddressWindowPolicy} from '../types/AddressWindow'

// BIP-44 coin type and the account level of every derivation path in the app.
// Defining these more than once forks the key tree on whichever copy is missed.
export const COIN_TYPE: Record<'mainnet' | 'testnet', number> = {mainnet: 5, testnet: 1}
export const PLATFORM_ACCOUNT = 0
export const SHIELDED_ACCOUNT = 0

export const ADDRESS_PREFIX: Record<'mainnet' | 'testnet', {p2pkh: number; p2sh: number}> = {
  mainnet: {p2pkh: 76, p2sh: 16},
  testnet: {p2pkh: 140, p2sh: 19},
}

export const HD_VERSIONS: Record<'mainnet' | 'testnet', {private: number; public: number}> = {
  mainnet: {private: 0x0488ade4, public: 0x0488b21e},
  testnet: {private: 0x04358394, public: 0x043587cf},
}

// base58check payload: 1 version byte + 20 hash bytes.
export const ADDRESS_DECODED_LENGTH = 21

// One gap-walk policy per key class — the only place a lookahead is written.
// `gapLimit` is how many unused indexes must follow the last used one; `batch`
// is how many are derived once the gap runs short; `maxRounds` stops a walk that
// the gap alone never would.

// L1 (BIP-44). Extending to exactly the limit re-exhausts on the very next used
// address, and a wallet with a run of them makes the cfilter scan rewind once
// per address — hence a batch above the minimum.
export const CORE_ADDRESS_WINDOW: AddressWindowPolicy = {
  gapLimit: 50,
  batch: 20,
  maxRounds: 50,
}

// Platform (DIP-17). Every round is a worker round trip that probes a whole
// batch at once, so there is nothing to gain from a batch below the limit.
export const PLATFORM_ADDRESS_WINDOW: AddressWindowPolicy = {
  gapLimit: 20,
  batch: 20,
  maxRounds: 50,
}

// Shielded (ZIP-32). Probing is a lookup in the decrypted-note set rather than a
// network call, so rounds are cheap. The gap is small because it is also the
// list the user sees, and note discovery does not depend on it — one incoming
// viewing key covers every diversifier whether or not its index was revealed.
export const SHIELDED_ADDRESS_WINDOW: AddressWindowPolicy = {
  gapLimit: 5,
  batch: 5,
  maxRounds: 50,
}

// How often the backend re-runs address discovery for the selected wallet.
// Shielded is absent by design: its deriver needs the seed, so it only walks
// inside an already-unlocked operation.
export const DISCOVERY_INTERVAL_MS = 120_000

export const IDENTITY_LOOKAHEAD = 10
export const IDENTITY_SCAN_LIMIT = 100

// Consecutive unused indexes that end the top-up funding-key scan. A top-up's
// credit address receives the asset lock output, so the chain records every
// index this wallet ever used — which a local row count does not survive a
// restore to.
export const TOPUP_KEY_GAP_LIMIT = 5
export const TOPUP_KEY_SCAN_LIMIT = 200
