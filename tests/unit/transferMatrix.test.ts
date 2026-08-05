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
import { ShieldedSpendKind } from '../../src/renderer/src/enums/ShieldedSpendKind'
import { CoreFeeShape } from '../../src/renderer/src/enums/CoreFeeShape'

const SPEND_KINDS: Array<ShieldedSpendKind | null> = [...Object.values(ShieldedSpendKind), null]

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
  it('exposes the credits unit and minimum for platform operations', () => {
    expect(operationInfo(TransferOperation.AddressFundsTransfer)).toMatchObject({unit: 'credits', minCredits: 500_000n})
    expect(operationInfo(TransferOperation.AddressWithdrawal).minCredits).toBe(100_000n)
    expect(operationInfo(TransferOperation.IdentityWithdrawal).minCredits).toBe(100_000n)
    expect(operationInfo(TransferOperation.IdentityTopUp).minCredits).toBe(100_000n)
    expect(operationInfo(TransferOperation.IdentityToIdentity)).toMatchObject({unit: 'credits', minCredits: 100_000n})
  })

  it('uses dash units for L1-sourced operations', () => {
    expect(operationInfo(TransferOperation.CoreSend)).toMatchObject({unit: 'dash', minCredits: null})
    expect(operationInfo(TransferOperation.AssetLockShield)).toMatchObject({unit: 'dash', minCredits: null})
    expect(operationInfo(TransferOperation.IdentityTopUpL1)).toMatchObject({unit: 'dash', minCredits: null, submitLabel: 'Top up'})
  })

  it('maps every pool-paid operation to its spend kind', () => {
    expect(operationInfo(TransferOperation.ShieldedTransfer).spendKind).toBe(ShieldedSpendKind.Transfer)
    expect(operationInfo(TransferOperation.Unshield).spendKind).toBe(ShieldedSpendKind.Unshield)
    expect(operationInfo(TransferOperation.ShieldedWithdrawal).spendKind).toBe(ShieldedSpendKind.Withdrawal)
    expect(operationInfo(TransferOperation.IdentityCreateFromPool).spendKind).toBe(ShieldedSpendKind.IdentityCreate)
  })

  it('has no spend kind for operations the pool does not pay for', () => {
    expect(operationInfo(TransferOperation.AddressFundsTransfer).spendKind).toBeNull()
    expect(operationInfo(TransferOperation.CoreSend).spendKind).toBeNull()
    expect(operationInfo(TransferOperation.Shield).spendKind).toBeNull()
  })

  it('classifies every operation', () => {
    for (const operation of Object.values(TransferOperation)) {
      const info = operationInfo(operation)
      expect(info).toBeDefined()
      expect(SPEND_KINDS).toContain(info.spendKind)
    }
  })

  it('gives a core fee shape to exactly the dash-denominated operations', () => {
    for (const operation of Object.values(TransferOperation)) {
      const info = operationInfo(operation)
      expect(info.coreFeeShape !== null).toBe(info.unit === 'dash')
    }
    expect(operationInfo(TransferOperation.CoreSend).coreFeeShape).toBe(CoreFeeShape.Send)
    expect(operationInfo(TransferOperation.AssetLockFunding).coreFeeShape).toBe(CoreFeeShape.AssetLock)
    expect(operationInfo(TransferOperation.AssetLockShield).coreFeeShape).toBe(CoreFeeShape.AssetLock)
    expect(operationInfo(TransferOperation.IdentityRegister).coreFeeShape).toBe(CoreFeeShape.AssetLock)
    expect(operationInfo(TransferOperation.IdentityTopUpL1).coreFeeShape).toBe(CoreFeeShape.AssetLock)
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
