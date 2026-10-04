import { describe, expect, it } from 'vitest'
import type { WalletAddressDto } from '../../src/renderer/src/api/types'
import { coreOwnedAddresses, platformOwnedParticipants } from '../../src/renderer/src/utils/ownedAddresses'

function address(value: string, walletId = 'wallet-a'): WalletAddressDto {
  return { walletId, address: value, accountId: 0, derivationPath: '', index: 0,
    isChange: 0, isUsed: true, balance: 0n, txCount: 1, label: null, usdBalance: null }
}

describe('transaction address ownership', () => {
  it('includes receiving and change addresses even with zero balance, scoped to the selected wallet', () => {
    const addresses = {
      receiving: [address('receiving'), address('foreign', 'wallet-b'), address('')],
      change: [address('change'), address('receiving')],
    }
    expect(coreOwnedAddresses('wallet-a', addresses)).toEqual(new Set(['receiving', 'change']))
    expect(coreOwnedAddresses(undefined, addresses).size).toBe(0)
    expect(coreOwnedAddresses('wallet-b', addresses)).toEqual(new Set(['foreign']))
  })

  it('recognizes Platform addresses and identities without marking unknown participants or empty sources as owned', () => {
    const owned = platformOwnedParticipants([
      { platformAddress: 'platform-address', balanceCredits: 0n, nonce: 1 },
      { platformAddress: '', balanceCredits: 0n, nonce: 0 },
    ], [{ identifier: 'identity-id' }, { identifier: '' }])
    expect(owned.has('platform-address')).toBe(true)
    expect(owned.has('external-address')).toBe(false)
    expect(owned.has('identity-id')).toBe(true)
    expect(owned.has('external-identity')).toBe(false)
    expect(owned.has('')).toBe(false)
    expect(platformOwnedParticipants([], []).size).toBe(0)
    expect(platformOwnedParticipants([], [{ identifier: 'identity-id' }])).toEqual(new Set(['identity-id']))
  })
})
