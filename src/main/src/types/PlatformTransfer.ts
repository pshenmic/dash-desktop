export interface PlatformSourceCandidate {
  platformAddress: string
  // Consensus keys inputs by the 21-byte PlatformAddress, so this is the order
  // a DeductFromInput index resolves against — not bech32m string order.
  addressBytes: Uint8Array
  index: number
  balanceCredits: bigint
  nonce: number
}

export interface PlatformInputSelection {
  candidate: PlatformSourceCandidate
  credits: bigint
}

export interface PlatformInputPlan {
  inputs: PlatformInputSelection[]
  feeCredits: bigint
}
