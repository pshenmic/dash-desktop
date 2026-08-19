import { describe, it, expect } from 'vitest'
import {
  defaultReceiveCoreAddress,
  defaultReceiveShieldedAddress,
  defaultReceivePlatformAddress,
  isUnusedPlatformAddress,
  receivePlatformAddresses,
  receiveShieldedAddresses,
} from '../../src/renderer/src/utils/receiveDefaults'
import type { WalletAddressDto } from '../../src/renderer/src/api/types'

const addr = (address: string, balance: bigint): WalletAddressDto =>
  ({ address, balance } as WalletAddressDto)

const platformAddr = (platformAddress: string, balanceCredits: bigint, nonce: number) =>
  ({ platformAddress, balanceCredits, nonce })

describe('isUnusedPlatformAddress', () => {
  it('is true for zero balance and zero nonce', () => {
    expect(isUnusedPlatformAddress(platformAddr('a', 0n, 0))).toBe(true)
  })

  it('is false when funded', () => {
    expect(isUnusedPlatformAddress(platformAddr('a', 100n, 0))).toBe(false)
  })

  it('is false when the nonce advanced even with zero balance', () => {
    expect(isUnusedPlatformAddress(platformAddr('a', 0n, 3))).toBe(false)
  })
})

describe('defaultReceivePlatformAddress', () => {
  it('picks the first unused address', () => {
    const list = [platformAddr('a', 500n, 2), platformAddr('b', 0n, 1), platformAddr('c', 0n, 0), platformAddr('d', 0n, 0)]
    expect(defaultReceivePlatformAddress(list)?.platformAddress).toBe('c')
  })

  it('does not return a zero-balance address with an advanced nonce', () => {
    const list = [platformAddr('a', 500n, 2), platformAddr('b', 0n, 3), platformAddr('c', 10n, 0)]
    expect(defaultReceivePlatformAddress(list)).toBeUndefined()
  })

  it('returns undefined when all addresses are funded', () => {
    const list = [platformAddr('a', 500n, 2), platformAddr('b', 10n, 0)]
    expect(defaultReceivePlatformAddress(list)).toBeUndefined()
  })

  it('returns undefined for an empty list', () => {
    expect(defaultReceivePlatformAddress([])).toBeUndefined()
  })
})

describe('receivePlatformAddresses', () => {
  it('excludes funded addresses and addresses with an advanced nonce', () => {
    const list = [platformAddr('a', 0n, 0), platformAddr('b', 10n, 0), platformAddr('c', 0n, 1)]
    expect(receivePlatformAddresses(list).map(address => address.platformAddress)).toEqual(['a'])
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

  it('returns undefined when all addresses are funded', () => {
    const balances = new Map<string, bigint>([['a', 10n], ['b', 5n]])
    expect(defaultReceiveShieldedAddress(['a', 'b'], balances)).toBeUndefined()
  })

  it('picks the first address when the balance map is empty', () => {
    expect(defaultReceiveShieldedAddress(['a', 'b'], new Map())).toBe('a')
  })

  it('returns undefined for an empty list', () => {
    expect(defaultReceiveShieldedAddress([], new Map())).toBeUndefined()
  })
})

describe('receiveShieldedAddresses', () => {
  it('excludes addresses with a positive current balance', () => {
    const balances = new Map<string, bigint>([['a', 10n], ['b', 0n]])
    expect(receiveShieldedAddresses(['a', 'b', 'c'], balances)).toEqual(['b', 'c'])
  })
})
