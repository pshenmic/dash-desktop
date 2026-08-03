export interface PlatformSourceCandidate {
  platformAddress: string
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