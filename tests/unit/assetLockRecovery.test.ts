import { describe, it, expect } from 'vitest'
import { Output, Transaction, TransactionType, utils as sdkUtils } from 'dash-core-sdk'
import { AssetLockTx } from 'dash-core-sdk/src/types/ExtraPayload/AssetLockTx.js'
import {
  assetLockCredit,
  assetLockIdentityId,
  recoveryFundingKind,
  requireTxid,
} from '../../src/main/src/utils/assetLockRecovery'
import { buildAssetLockOutputs } from '../../src/main/src/utils/assetLockTx'
import { ASSET_LOCK_PAYLOAD_VERSION } from '../../src/main/src/constants/credits'
import { AssetLockCreditSource, AssetLockRecoveryDestination } from '../../src/main/src/types/AssetLockRecovery'

const creditAddress = sdkUtils.publicKeyHashToAddress(new Uint8Array(20).fill(7), 'testnet')
const TXID = 'ab'.repeat(32)

function assetLock(payload: AssetLockTx, burn: Output): Transaction {
  return new Transaction([], [burn], 0, 3, TransactionType.TRANSACTION_ASSET_LOCK, payload)
}

describe('requireTxid', () => {
  it('trims and lowercases a pasted txid', () => {
    expect(requireTxid(`  ${'AB'.repeat(32)}\n`)).toBe(TXID)
  })

  it.each(['', 'ab'.repeat(31), `${'ab'.repeat(31)}zz`, `0x${'ab'.repeat(31)}`])('rejects %j', input => {
    expect(() => requireTxid(input)).toThrow('Invalid transaction id')
  })
})

describe('assetLockCredit', () => {
  it('reads the credit address and amount off a serialized lock', () => {
    const {burnOutput, extraPayload} = buildAssetLockOutputs(150_000n, creditAddress)
    const tx = Transaction.fromHex(assetLock(extraPayload, burnOutput).hex())
    expect(assetLockCredit(tx, 'testnet')).toEqual({address: creditAddress, amountDuffs: 150_000n})
  })

  it('rejects a transaction that is not an asset lock', () => {
    const tx = new Transaction([], [Output.createP2PKH(1_000n, creditAddress)])
    expect(() => assetLockCredit(tx, 'testnet')).toThrow('Transaction is not an asset lock')
  })

  it('rejects a lock with more than one credit output', () => {
    const {burnOutput} = buildAssetLockOutputs(2_000n, creditAddress)
    const outputs = [Output.createP2PKH(1_000n, creditAddress), Output.createP2PKH(1_000n, creditAddress)]
    const tx = assetLock(new AssetLockTx(ASSET_LOCK_PAYLOAD_VERSION, outputs.length, outputs), burnOutput)
    expect(() => assetLockCredit(tx, 'testnet')).toThrow('single P2PKH credit output')
  })
})

describe('recoveryFundingKind', () => {
  const destinations: AssetLockRecoveryDestination[] = [
    {kind: 'address', to: 'x'},
    {kind: 'shielded', to: 'x'},
    {kind: 'identity'},
    {kind: 'identityTopUp', to: 'x'},
  ]
  const accepted: Record<AssetLockCreditSource, string[]> = {
    core: ['address', 'shielded'],
    registration: ['identity'],
    topUp: ['identityTopUp'],
  }

  for (const source of Object.keys(accepted) as AssetLockCreditSource[]) {
    for (const destination of destinations) {
      const ok = accepted[source].includes(destination.kind)
      it(`${ok ? 'accepts' : 'refuses'} a ${source} credit for ${destination.kind}`, () => {
        if (ok) {
          expect(recoveryFundingKind(source, destination)).toBe(destination.kind)
        } else {
          expect(() => recoveryFundingKind(source, destination)).toThrow(`cannot fund a ${destination.kind} destination`)
        }
      })
    }
  }
})

describe('assetLockIdentityId', () => {
  it('names the identity after the outpoint alone', () => {
    expect(assetLockIdentityId(TXID)).toBe(assetLockIdentityId(TXID))
    expect(assetLockIdentityId(TXID)).not.toBe(assetLockIdentityId('cd'.repeat(32)))
  })
})
