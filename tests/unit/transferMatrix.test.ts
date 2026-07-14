import { describe, it, expect } from 'vitest'
import {
  resolveOperation,
  unsupportedReason,
  operationInfo,
  isLikelyIdentityId,
  isPoolIdentityDenomination,
  POOL_IDENTITY_DENOMINATIONS,
  SOURCE_KINDS,
  DESTINATION_KINDS,
  SourceKind,
  DestinationKind,
} from '../../src/renderer/src/utils/transferMatrix'

const EXPECTED: Record<SourceKind, Partial<Record<DestinationKind, string | null>>> = {
  core: {
    coreAddress: 'coreSend',
    platformAddress: 'assetLockFunding',
    identity: 'identityTopUpL1',
    newIdentity: 'identityRegister',
    shielded: 'assetLockShield',
  },
  platformAddress: {
    coreAddress: 'addressWithdrawal',
    platformAddress: 'addressFundsTransfer',
    identity: 'identityTopUp',
    newIdentity: 'identityCreate',
    shielded: 'shield',
  },
  identity: {
    coreAddress: 'identityWithdrawal',
    platformAddress: 'identityToAddress',
    identity: 'identityToIdentity',
    newIdentity: null,
    shielded: null,
  },
  shielded: {
    coreAddress: 'shieldedWithdrawal',
    platformAddress: 'unshield',
    identity: null,
    newIdentity: 'identityCreateFromPool',
    shielded: 'shieldedTransfer',
  },
}

describe('resolveOperation', () => {
  for (const {kind: from} of SOURCE_KINDS) {
    for (const {kind: to} of DESTINATION_KINDS) {
      it(`${from} -> ${to}`, () => {
        expect(resolveOperation(from, to)).toBe(EXPECTED[from][to] ?? null)
      })
    }
  }
})

describe('unsupportedReason', () => {
  it('is null for every supported combination', () => {
    for (const {kind: from} of SOURCE_KINDS) {
      for (const {kind: to} of DESTINATION_KINDS) {
        if (resolveOperation(from, to) != null) {
          expect(unsupportedReason(from, to)).toBeNull()
        }
      }
    }
  })

  it('is a human message for every unsupported combination', () => {
    for (const {kind: from} of SOURCE_KINDS) {
      for (const {kind: to} of DESTINATION_KINDS) {
        if (resolveOperation(from, to) == null) {
          expect(unsupportedReason(from, to)).toMatch(/\w/)
        }
      }
    }
  })

  it('supports every operation defined in the matrix', () => {
    expect(unsupportedReason('core', 'platformAddress')).toBeNull()
    expect(unsupportedReason('platformAddress', 'newIdentity')).toBeNull()
  })
})

describe('operationInfo', () => {
  it('exposes credits fee and minimum for platform operations', () => {
    expect(operationInfo('addressFundsTransfer')).toMatchObject({unit: 'credits', feeCredits: 6_500_000n, minCredits: 500_000n})
    expect(operationInfo('addressWithdrawal').feeCredits).toBe(400_000_000n)
    expect(operationInfo('identityWithdrawal').feeCredits).toBe(400_000_000n)
    expect(operationInfo('identityTopUp').minCredits).toBe(100_000n)
    expect(operationInfo('identityToIdentity')).toMatchObject({unit: 'credits', feeCredits: 1_000_000n, minCredits: 100_000n})
  })

  it('uses dash units without a credits fee for L1-sourced operations', () => {
    expect(operationInfo('coreSend')).toMatchObject({unit: 'dash', feeCredits: null})
    expect(operationInfo('assetLockShield')).toMatchObject({unit: 'dash', feeCredits: null})
    expect(operationInfo('identityTopUpL1')).toMatchObject({unit: 'dash', feeCredits: null, submitLabel: 'Top up'})
  })
})

describe('isPoolIdentityDenomination', () => {
  it('accepts exactly the protocol exit denominations', () => {
    for (const denomination of POOL_IDENTITY_DENOMINATIONS) {
      expect(isPoolIdentityDenomination(denomination)).toBe(true)
    }
    expect(isPoolIdentityDenomination(0n)).toBe(false)
    expect(isPoolIdentityDenomination(20_000_000_000n)).toBe(false)
    expect(isPoolIdentityDenomination(10_000_000_001n)).toBe(false)
  })

  it('matches the pool minimum in operationInfo', () => {
    expect(operationInfo('identityCreateFromPool')).toMatchObject({unit: 'credits', minCredits: POOL_IDENTITY_DENOMINATIONS[0]})
  })
})

describe('isLikelyIdentityId', () => {
  it('accepts a 44-char base58 identifier', () => {
    expect(isLikelyIdentityId('4EfA9Jrvv3nnCFdSf7fad59851iiTRZ6Wcu6YVJ4iSeF')).toBe(true)
  })

  it('rejects short strings and invalid base58 characters', () => {
    expect(isLikelyIdentityId('abc')).toBe(false)
    expect(isLikelyIdentityId('0OIl'.repeat(11))).toBe(false)
  })
})
