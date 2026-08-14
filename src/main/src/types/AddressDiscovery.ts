export interface GapEntry {
  index: number
  isUsed: boolean
}

// Usage by position, never by address string: the addresses themselves are
// always derived locally from our own xpub.
export interface AddressUsage {
  isChange: boolean
  index: number
  isUsed: boolean
}