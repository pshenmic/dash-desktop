import { describe, it, expect } from 'vitest'
import {
  defaultReceiveCoreAddress,
  defaultReceiveShieldedAddress,
  defaultReceivePlatformAddress,
  isUnusedPlatformAddress,
} from '../../src/renderer/src/utils/receiveDefaults'
import type { WalletAddressDto } from '../../src/renderer/src/api/types'

const addr = (address: string, balance: bigint): WalletAddressDto =>
  ({ address, balance } as WalletAddressDto)

const platformAddr = (platformAddress: string, balanceCredits: string, nonce: number) =>
  ({ platformAddress, balanceCredits, nonce })

describe('isUnusedPlatformAddress', () => {
  it('is true for zero balance and zero nonce', () => {
    expect(isUnusedPlatformAddress(platformAddr('a', '0', 0))).toBe(true)
  })

  it('is false when funded', () => {
    expect(isUnusedPlatformAddress(platformAddr('a', '100', 0))).toBe(false)
  })

  it('is false when the nonce advanced even with zero balance', () => {
    expect(isUnusedPlatformAddress(platformAddr('a', '0', 3))).toBe(false)
  })
})

describe('defaultReceivePlatformAddress', () => {
  it('picks the first unused address', () => {
    const list = [platformAddr('a', '500', 2), platformAddr('b', '0', 1), platformAddr('c', '0', 0), platformAddr('d', '0', 0)]
    expect(defaultReceivePlatformAddress(list)?.platformAddress).toBe('c')
  })

  it('prefers a zero-balance address with an advanced nonce over funded ones', () => {
    const list = [platformAddr('a', '500', 2), platformAddr('b', '0', 3), platformAddr('c', '10', 0)]
    expect(defaultReceivePlatformAddress(list)?.platformAddress).toBe('b')
  })

  it('falls back to the first address when all are funded', () => {
    const list = [platformAddr('a', '500', 2), platformAddr('b', '10', 0)]
    expect(defaultReceivePlatformAddress(list)?.platformAddress).toBe('a')
  })

  it('returns undefined for an empty list', () => {
    expect(defaultReceivePlatformAddress([])).toBeUndefined()
  })
})

describe('defaultReceiveCoreAddress', () => {
  it('picks the preferred address when it has zero balance', () => {
    const list = [addr('a', 0n), addr('b', 0n)]
    expect(defaultReceiveCoreAddress(list, 'b')?.address).toBe('b')
  })

  it('ignores the preferred address when it is funded', () => {
    const list = [addr('a', 100n), addr('b', 0n)]
    expect(defaultReceiveCoreAddress(list, 'a')?.address).toBe('b')
  })

  it('picks the first zero-balance address without a preferred one', () => {
    const list = [addr('a', 100n), addr('b', 0n), addr('c', 0n)]
    expect(defaultReceiveCoreAddress(list)?.address).toBe('b')
  })

  it('falls back to the first address when all are funded', () => {
    const list = [addr('a', 100n), addr('b', 50n)]
    expect(defaultReceiveCoreAddress(list, 'x')?.address).toBe('a')
  })

  it('returns undefined for an empty list', () => {
    expect(defaultReceiveCoreAddress([])).toBeUndefined()
  })
})

describe('defaultReceiveShieldedAddress', () => {
  it('picks the first address without a balance', () => {
    const balances = new Map<string, bigint>([['a', 10n], ['b', 5n]])
    expect(defaultReceiveShieldedAddress(['a', 'b', 'c'], balances)).toBe('c')
  })

  it('treats a zero entry in the balance map as unfunded', () => {
    const balances = new Map<string, bigint>([['a', 10n], ['b', 0n]])
    expect(defaultReceiveShieldedAddress(['a', 'b'], balances)).toBe('b')
  })

  it('falls back to the first address when all are funded', () => {
    const balances = new Map<string, bigint>([['a', 10n], ['b', 5n]])
    expect(defaultReceiveShieldedAddress(['a', 'b'], balances)).toBe('a')
  })

  it('picks the first address when the balance map is empty', () => {
    expect(defaultReceiveShieldedAddress(['a', 'b'], new Map())).toBe('a')
  })

  it('returns undefined for an empty list', () => {
    expect(defaultReceiveShieldedAddress([], new Map())).toBeUndefined()
  })
})
