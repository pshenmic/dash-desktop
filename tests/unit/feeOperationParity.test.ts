import {describe, it, expect} from 'vitest'
import {TransferOperation} from '../../src/renderer/src/enums/TransferOperation'
import {ShieldedSpendKind} from '../../src/renderer/src/enums/ShieldedSpendKind'
import {FeeOperation, PoolSpendOperation} from '../../src/main/platform/types/messages'

// The renderer names an operation and main prices it, but the two lists live in
// separate bundles and cannot import each other. Only this test stops them
// drifting: adding to one and not the other compiles, then throws at runtime.
const FEE_OPERATIONS: FeeOperation[] = [
  'coreSend',
  'assetLockFunding',
  'assetLockShield',
  'identityRegister',
  'identityTopUpL1',
  'addressFundsTransfer',
  'identityTopUp',
  'identityCreate',
  'addressWithdrawal',
  'shield',
  'identityToAddress',
  'identityToIdentity',
  'identityWithdrawal',
  'shieldedTransfer',
  'unshield',
  'shieldedWithdrawal',
  'identityCreateFromPool',
]

const SPEND_KINDS: PoolSpendOperation[] = ['shieldedTransfer', 'unshield', 'shieldedWithdrawal', 'identityCreateFromPool']

describe('fee operation parity', () => {
  it('prices exactly the operations the renderer can offer', () => {
    expect([...FEE_OPERATIONS].sort()).toEqual(Object.values(TransferOperation).sort())
  })

  it('names a pool spend the same in both bundles, so no table translates it', () => {
    expect([...SPEND_KINDS].sort()).toEqual(Object.values(ShieldedSpendKind).sort())
    for (const kind of SPEND_KINDS) {
      expect(FEE_OPERATIONS).toContain(kind)
    }
  })
})
