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
} from '../../src/renderer/src/utils/transferMatrix'
import { SourceKind } from '../../src/renderer/src/enums/SourceKind'
import { DestinationKind } from '../../src/renderer/src/enums/DestinationKind'
import { TransferOperation } from '../../src/renderer/src/enums/TransferOperation'

const EXPECTED: Record<SourceKind, Partial<Record<DestinationKind, TransferOperation | null>>> = {
  [SourceKind.Core]: {
    [DestinationKind.CoreAddress]: TransferOperation.CoreSend,
    [DestinationKind.PlatformAddress]: TransferOperation.AssetLockFunding,
    [DestinationKind.Identity]: TransferOperation.IdentityTopUpL1,
    [DestinationKind.NewIdentity]: TransferOperation.IdentityRegister,
    [DestinationKind.Shielded]: TransferOperation.AssetLockShield,
  },
  [SourceKind.PlatformAddress]: {
    [DestinationKind.CoreAddress]: TransferOperation.AddressWithdrawal,
    [DestinationKind.PlatformAddress]: TransferOperation.AddressFundsTransfer,
    [DestinationKind.Identity]: TransferOperation.IdentityTopUp,
    [DestinationKind.NewIdentity]: TransferOperation.IdentityCreate,
    [DestinationKind.Shielded]: TransferOperation.Shield,
  },
  [SourceKind.Identity]: {
    [DestinationKind.CoreAddress]: TransferOperation.IdentityWithdrawal,
    [DestinationKind.PlatformAddress]: TransferOperation.IdentityToAddress,
    [DestinationKind.Identity]: TransferOperation.IdentityToIdentity,
    [DestinationKind.NewIdentity]: null,
    [DestinationKind.Shielded]: null,
  },
  [SourceKind.Shielded]: {
    [DestinationKind.CoreAddress]: TransferOperation.ShieldedWithdrawal,
    [DestinationKind.PlatformAddress]: TransferOperation.Unshield,
    [DestinationKind.Identity]: null,
    [DestinationKind.NewIdentity]: TransferOperation.IdentityCreateFromPool,
    [DestinationKind.Shielded]: TransferOperation.ShieldedTransfer,
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
    expect(unsupportedReason(SourceKind.Core, DestinationKind.PlatformAddress)).toBeNull()
    expect(unsupportedReason(SourceKind.PlatformAddress, DestinationKind.NewIdentity)).toBeNull()
  })
})

describe('operationInfo', () => {
  it('exposes credits fee and minimum for platform operations', () => {
    expect(operationInfo(TransferOperation.AddressFundsTransfer)).toMatchObject({unit: 'credits', feeCredits: 6_500_000n, minCredits: 500_000n})
    expect(operationInfo(TransferOperation.AddressWithdrawal).feeCredits).toBe(400_000_000n)
    expect(operationInfo(TransferOperation.IdentityWithdrawal).feeCredits).toBe(400_000_000n)
    expect(operationInfo(TransferOperation.IdentityTopUp).minCredits).toBe(100_000n)
    expect(operationInfo(TransferOperation.IdentityToIdentity)).toMatchObject({unit: 'credits', feeCredits: 1_000_000n, minCredits: 100_000n})
  })

  it('leaves the fee null for pool-paid shielded spends (computed from note count)', () => {
    expect(operationInfo(TransferOperation.ShieldedTransfer).feeCredits).toBeNull()
    expect(operationInfo(TransferOperation.Unshield).feeCredits).toBeNull()
    expect(operationInfo(TransferOperation.ShieldedWithdrawal).feeCredits).toBeNull()
  })

  it('uses dash units without a credits fee for L1-sourced operations', () => {
    expect(operationInfo(TransferOperation.CoreSend)).toMatchObject({unit: 'dash', feeCredits: null})
    expect(operationInfo(TransferOperation.AssetLockShield)).toMatchObject({unit: 'dash', feeCredits: null})
    expect(operationInfo(TransferOperation.IdentityTopUpL1)).toMatchObject({unit: 'dash', feeCredits: null, submitLabel: 'Top up'})
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
    expect(operationInfo(TransferOperation.IdentityCreateFromPool)).toMatchObject({unit: 'credits', minCredits: POOL_IDENTITY_DENOMINATIONS[0]})
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
