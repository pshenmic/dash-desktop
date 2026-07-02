export interface PlatformSourceCandidate {
  platformAddress: string
  coreAddress: string
  derivationPath: string
  balanceCredits: bigint
  nonce: number
}

export const MIN_OUTPUT_CREDITS = 500_000n
export const TRANSFER_FEE_CREDITS = 6_500_000n

export function selectPlatformSource(
  candidates: PlatformSourceCandidate[],
  amountCredits: bigint,
  fromAddress?: string,
): PlatformSourceCandidate {
  if (amountCredits < MIN_OUTPUT_CREDITS) {
    throw new Error(`Minimum Platform transfer is ${MIN_OUTPUT_CREDITS.toString()} credits`)
  }

  const required = amountCredits + TRANSFER_FEE_CREDITS

  if (fromAddress != null) {
    const chosen = candidates.find(candidate => candidate.platformAddress === fromAddress)
    if (chosen == null) {
      throw new Error('Source address not found in this wallet')
    }
    if (chosen.balanceCredits < required) {
      throw new Error('Source address has insufficient credits for this transfer plus fee')
    }
    return chosen
  }

  const funded = candidates.filter(candidate => candidate.balanceCredits >= required)
  if (funded.length === 0) {
    throw new Error('No Platform address holds enough credits for this transfer plus fee')
  }

  return funded.reduce((best, candidate) =>
    candidate.balanceCredits > best.balanceCredits ? candidate : best,
  )
}
