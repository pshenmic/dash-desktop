import {PlatformTransaction} from './PlatformTransaction'
import {ShieldedNoteInfo} from './Shielded'
import {Transaction} from './Transaction'

// Everything one wallet's history is made of. Three lists rather than one,
// because no two of these share a field: a state transition counts credits and
// is named by its own hash, and a pool note has neither a hash nor a date.
export interface WalletHistory {
  core: Transaction[]
  platform: PlatformTransaction[]
  // The last refresh this session ran against the explorer failed, so `platform`
  // may be short or empty for that reason rather than for want of activity.
  platformFailed: boolean
  // Owned pool notes, newest leaf first.
  shielded: ShieldedNoteInfo[]
}
