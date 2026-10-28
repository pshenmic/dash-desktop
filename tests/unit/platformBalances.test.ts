import { describe, expect, it } from 'vitest'
import { totalIdentityCredits, totalPlatformAddressCredits, totalWalletCredits } from '../../src/renderer/src/utils/platformBalances'

const identity = (amount: bigint) => ({ balance: { amount, usdAmount: '0' } })
const address = (balanceCredits: bigint) => ({ balanceCredits })

describe('totalIdentityCredits', () => {
  it('sums the credit balance of every identity', () => {
    expect(totalIdentityCredits([identity(2_500_000_000n), identity(1n), identity(0n)])).toBe(2_500_000_001n)
  })

  it('is zero for a wallet without identities', () => {
    expect(totalIdentityCredits([])).toBe(0n)
  })
})

describe('totalPlatformAddressCredits', () => {
  it('sums the credits held by Platform addresses only', () => {
    expect(totalPlatformAddressCredits([address(689_086_912_734n), address(0n), address(5n)])).toBe(689_086_912_739n)
  })

  it('is zero without funded addresses', () => {
    expect(totalPlatformAddressCredits([])).toBe(0n)
  })
})

describe('totalWalletCredits', () => {
  it('adds the Core balance in credits to every Platform balance', () => {
    expect(totalWalletCredits(2n, [5n, 7n, 11n])).toBe(2_023n)
  })

  it('counts a balance that is not loaded yet as nothing', () => {
    expect(totalWalletCredits(1n, [5n, undefined])).toBe(1_005n)
  })
})
