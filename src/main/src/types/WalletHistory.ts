import {PlatformTransaction} from './PlatformTransaction'
import {Transaction} from './Transaction'

// Two lists, not one: a state transition counts credits and is named by its own
// hash, so it shares no field with a Core transaction.
export interface WalletHistory {
  core: Transaction[]
  platform: PlatformTransaction[]
  // The last refresh this session ran against the explorer failed, so `platform`
  // may be short or empty for that reason rather than for want of activity.
  platformFailed: boolean
}
