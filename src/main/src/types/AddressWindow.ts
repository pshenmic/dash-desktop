import {GapEntry} from './AddressDiscovery'

// One index of a key class. The index is the identity everywhere in the window
// machinery; the address string is derived from it and never the other way.
export interface DerivedAddress {
  index: number
  address: string
  derivationPath: string
}

export interface AddressDeriver {
  derive(index: number): DerivedAddress
}

export interface UsageOracle {
  // Null when the source cannot walk the gap itself, and the window has to be
  // widened round by round through probe().
  scan(gapLimit: number): Promise<GapEntry[] | null>
  probe(addresses: DerivedAddress[]): Promise<GapEntry[]>
}

// What a key class has already materialised. `reveal` is the only thing that
// widens it, so a store that keeps a count rather than rows still satisfies it.
export interface AddressWindowStore {
  known(): Promise<GapEntry[]>
  reveal(addresses: DerivedAddress[]): Promise<void>
  markUsed(indexes: number[]): Promise<void>
}

export interface AddressWindowPolicy {
  gapLimit: number
  batch: number
  maxRounds: number
}

export interface AddressWindowPlan {
  // Holes below the frontier. The window must stay contiguous from zero: a used
  // index inside a hole is otherwise never derived.
  refill: number[]
  extend: number[]
}
