import {describe, it, expect} from 'vitest'
import {TransferOperation} from '../../src/renderer/src/enums/TransferOperation'
import {ShieldedSpendKind} from '../../src/renderer/src/enums/ShieldedSpendKind'
import {FeeOperation, PoolSpendOperation} from '../../src/main/platform/types/messages'

// The renderer names an operation and main prices it, but the two lists live in
// separate bundles and cannot import each other. These maps are exhaustive over
// main's unions, so main gaining an operation the renderer cannot name is a
// compile error; the tests below cover the other direction, which types cannot.
const FEE_OPERATIONS: Record<FeeOperation, TransferOperation> = {
  coreSend: TransferOperation.CoreSend,
  assetLockFunding: TransferOperation.AssetLockFunding,
  assetLockShield: TransferOperation.AssetLockShield,
  identityRegister: TransferOperation.IdentityRegister,
  identityTopUpL1: TransferOperation.IdentityTopUpL1,
  addressFundsTransfer: TransferOperation.AddressFundsTransfer,
  identityTopUp: TransferOperation.IdentityTopUp,
  identityCreate: TransferOperation.IdentityCreate,
  addressWithdrawal: TransferOperation.AddressWithdrawal,
  shield: TransferOperation.Shield,
  identityToAddress: TransferOperation.IdentityToAddress,
  identityToIdentity: TransferOperation.IdentityToIdentity,
  identityWithdrawal: TransferOperation.IdentityWithdrawal,
  shieldedTransfer: TransferOperation.ShieldedTransfer,
  unshield: TransferOperation.Unshield,
  shieldedWithdrawal: TransferOperation.ShieldedWithdrawal,
  identityCreateFromPool: TransferOperation.IdentityCreateFromPool,
}

const SPEND_KINDS: Record<PoolSpendOperation, ShieldedSpendKind> = {
  shieldedTransfer: ShieldedSpendKind.Transfer,
  unshield: ShieldedSpendKind.Unshield,
  shieldedWithdrawal: ShieldedSpendKind.Withdrawal,
  identityCreateFromPool: ShieldedSpendKind.IdentityCreate,
}

describe('fee operation parity', () => {
  it('prices exactly the operations the renderer can offer', () => {
    expect(Object.keys(FEE_OPERATIONS).sort()).toEqual(Object.values(TransferOperation).sort())
  })

  // Both sides spell an operation with the same string, so nothing between them
  // has to translate it.
  it('names an operation the same in both bundles', () => {
    for (const [operation, rendererName] of Object.entries(FEE_OPERATIONS)) {
      expect(rendererName, operation).toBe(operation)
    }
  })

  it('names a pool spend the same in both bundles, and prices every one', () => {
    expect(Object.keys(SPEND_KINDS).sort()).toEqual(Object.values(ShieldedSpendKind).sort())
    for (const [kind, spendKind] of Object.entries(SPEND_KINDS)) {
      expect(spendKind, kind).toBe(kind)
      expect(FEE_OPERATIONS).toHaveProperty(kind)
    }
  })
})
