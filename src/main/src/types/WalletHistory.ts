import {PlatformTransaction} from './PlatformTransaction'
import {ShieldedNoteInfo} from './Shielded'
import {Transaction} from './Transaction'

// Everything one wallet's history is made of. Three lists rather than one,
// because no two of these share a field: a state transition counts credits and
// is named by its own hash, and a pool note has neither a hash nor a date.
export interface WalletHistory {
  core: Transaction[]
  platform: PlatformTransaction[]
  // The L2 read failed and `platform` is empty for that reason rather than for
  // want of activity, so a caller can say so instead of showing a short list.
  platformFailed: boolean
  // Owned pool notes, newest leaf first. An Orchard note carries an address, a
  // value and its tree position and nothing else, so these cannot be dated or
  // interleaved with the lists above — only ordered among themselves, by a leaf
  // position that does grow with the chain.
  shielded: ShieldedNoteInfo[]
}
