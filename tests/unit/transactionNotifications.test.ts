import {describe, it, expect} from 'vitest'
import {AppliedTxOutput} from '../../src/main/p2p/types/walletSync'
import {PlatformTransaction} from '../../src/main/src/types/PlatformTransaction'
import {Transaction} from '../../src/main/src/types/Transaction'
import {coreTransactionMessage, platformTransactionMessage} from '../../src/main/src/utils/transactionNotifications'

function core(overrides: Partial<Transaction>): Transaction {
  return {
    address: 'ours1',
    direction: 1,
    inAmount: 0n,
    outAmount: 0n,
    transferAmount: 0n,
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
  it('reports the addresses that were paid on the way in', () => {
    const message = coreTransactionMessage(core({direction: 1, transferAmount: 5000n}), [
      output({vout: 0, address: 'ours1', isMine: true}),
      output({vout: 1, address: 'theirs1', isMine: false}),
    ])
    expect(message).toMatchObject({
      chain: 'core',
      direction: 'in',
      amount: 5000n,
      amountType: 'duffs',
      recipients: ['ours1'],
    })
  })

  // Change is ours, so counting it as a recipient would name the sender as who
  // was paid.
  it('leaves change out of the recipients on the way out', () => {
    const message = coreTransactionMessage(core({direction: -1, transferAmount: 7000n}), [
      output({vout: 0, address: 'theirs1', isMine: false}),
      output({vout: 1, address: 'ourChange', isMine: true}),
    ])
    expect(message.direction).toBe('out')
    expect(message.recipients).toEqual(['theirs1'])
  })

  it('answers no recipients rather than an empty list', () => {
    const message = coreTransactionMessage(core({direction: -1}), [
      output({vout: 0, address: 'ourChange', isMine: true}),
    ])
    expect(message.recipients).toBeNull()
  })

  it('calls a transaction with an underivable output an asset lock', () => {
    const locking = coreTransactionMessage(core({direction: -1}), [
      output({vout: 0, address: null, isMine: false}),
    ])
    const plain = coreTransactionMessage(core({direction: -1}), [output({vout: 0})])
    expect(locking.type).toBe('assetLock')
    expect(plain.type).toBe('transfer')
  })
})

describe('platformTransactionMessage', () => {
  it('reads the direction off the net and the amount off what moved', () => {
    const message = platformTransactionMessage(platform({
      netCredits: 1_000n,
      amountCredits: 1_000n,
      recipient: [{source: 'idA', amount: 1_000n}],
    }))
    expect(message).toMatchObject({
      chain: 'platform',
      direction: 'in',
      amount: 1_000n,
      amountType: 'credits',
      recipients: ['idA'],
      type: 'IDENTITY_CREDIT_TRANSFER',
    })
  })

  it('reports credits leaving as out', () => {
    expect(platformTransactionMessage(platform({netCredits: -1_000n})).direction).toBe('out')
  })

  // An asset lock funding moves credits without either side gaining.
  it('claims neither side when the net is nothing', () => {
    const message = platformTransactionMessage(platform({netCredits: 0n, amountCredits: 2_000n}))
    expect(message.direction).toBe('neutral')
    expect(message.amount).toBe(2_000n)
  })
})
