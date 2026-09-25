import {describe, it, expect} from 'vitest'
import {AppliedTxOutput} from '../../src/main/p2p/types/walletSync'
import {PlatformTransaction} from '../../src/main/src/types/PlatformTransaction'
import {Transaction} from '../../src/main/src/types/Transaction'
import {coreTransactionMessage, platformTransactionMessage} from '../../src/main/src/utils/transactionNotifications'

// The two totals decide direction and transfer amount, as in TransactionDAO.
function core(ourInputs: bigint, ourOutputs: bigint, overrides: Partial<Transaction> = {}): Transaction {
  return {
    address: 'ours1',
    direction: ourInputs > ourOutputs ? -1 : 1,
    inAmount: ourInputs,
    outAmount: ourOutputs,
    transferAmount: ourInputs > ourOutputs ? ourInputs - ourOutputs : ourOutputs - ourInputs,
    usdAmount: '0.0',
    date: new Date('2026-01-01T00:00:00Z'),
    size: 200,
    blockHeight: 0,
    status: 'Pending',
    walletId: 'w1',
    confirmations: 0,
    txid: 'txid1',
    vin: [],
    vout: [],
    instantLocked: false,
    chainlocked: false,
    isLocal: false,
    ...overrides,
  }
}

function output(overrides: Partial<AppliedTxOutput>): AppliedTxOutput {
  return {vout: 0, address: 'theirs1', satoshis: '0', isMine: false, ...overrides}
}

function platform(overrides: Partial<PlatformTransaction>): PlatformTransaction {
  return {
    walletId: 'w1',
    hash: 'st1',
    type: 'IDENTITY_CREDIT_TRANSFER',
    date: new Date('2026-01-01T00:00:00Z'),
    blockHeight: 10,
    status: 'SUCCESS',
    error: null,
    gasCredits: 0n,
    netCredits: 0n,
    amountCredits: 0n,
    sender: [],
    recipient: [],
    ...overrides,
  }
}

describe('coreTransactionMessage', () => {
  it('reports arriving duffs as a positive net and names who was paid', () => {
    const message = coreTransactionMessage(core(0n, 5_000n), [
      output({vout: 0, address: 'ours1', isMine: true}),
      output({vout: 1, address: 'theirs1', isMine: false}),
    ])
    expect(message).toMatchObject({
      chain: 'core',
      netAmount: 5_000n,
      amount: 5_000n,
      recipients: ['ours1'],
    })
  })

  it('leaves change out of the recipients on the way out', () => {
    const message = coreTransactionMessage(core(10_000n, 3_000n), [
      output({vout: 0, address: 'theirs1', isMine: false}),
      output({vout: 1, address: 'ourChange', isMine: true}),
    ])
    expect(message.netAmount).toBe(-7_000n)
    expect(message.amount).toBe(7_000n)
    expect(message.recipients).toEqual(['theirs1'])
  })

  it('answers no recipients rather than an empty list', () => {
    const message = coreTransactionMessage(core(10_000n, 3_000n), [
      output({vout: 0, address: 'ourChange', isMine: true}),
    ])
    expect(message.recipients).toBeNull()
  })

  it('calls a transaction with an underivable output an asset lock', () => {
    const locking = coreTransactionMessage(core(10_000n, 0n), [
      output({vout: 0, address: null, isMine: false}),
    ])
    const plain = coreTransactionMessage(core(10_000n, 0n), [output({vout: 0})])
    expect(locking.type).toBe('assetLock')
    expect(plain.type).toBe('transfer')
  })
})

describe('platformTransactionMessage', () => {
  it('carries the transition net and what it moved as they are', () => {
    const message = platformTransactionMessage(platform({
      netCredits: 1_000n,
      amountCredits: 1_000n,
      recipient: [{source: 'idA', amount: 1_000n}],
    }))
    expect(message).toMatchObject({
      chain: 'platform',
      netAmount: 1_000n,
      amount: 1_000n,
      recipients: ['idA'],
      type: 'IDENTITY_CREDIT_TRANSFER',
    })
  })

  it('reports credits leaving as a negative net', () => {
    expect(platformTransactionMessage(platform({netCredits: -1_000n})).netAmount).toBe(-1_000n)
  })

  it('keeps what moved when the net is nothing', () => {
    const message = platformTransactionMessage(platform({netCredits: 0n, amountCredits: 2_000n}))
    expect(message.netAmount).toBe(0n)
    expect(message.amount).toBe(2_000n)
  })
})
