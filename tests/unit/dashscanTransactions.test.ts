import { describe, it, expect, vi } from 'vitest'
import { dashscanToWalletTransactions } from '../../src/main/src/utils/dashscanTransactions'
import { DashscanTransaction, DashscanVIn, DashscanVOut } from '../../src/main/src/types/Dashscan'

const OURS = 'yXWJGWuD4VBRMp9n2MtXQbGpgSeWyTRHme'
const THEIRS = 'yPTufhdDnAx77n5cZ6qYmjUtNcMfdMYMxR'

function vin(overrides: Partial<DashscanVIn> = {}): DashscanVIn {
  return {
    prevTxHash: '88449174a5fe8a49dfd14f2d7231346ef6bda31bbe1f878434962d5917fe62db',
    vOutIndex: 1,
    address: OURS,
    amount: '963099819428',
    sequence: null,
    scriptSigASM: null,
    ...overrides,
  }
}

function vout(overrides: Partial<DashscanVOut> = {}): DashscanVOut {
  return {
    value: 100000000,
    number: 0,
    scriptPubKeyASM: 'OP_DUP OP_HASH160 ...',
    scriptPubKeyHex: '76a914228217a532e39bed427bcc03f10db8326ca8bbf688ac',
    scriptPubKeyType: 'pubkeyhash',
    address: THEIRS,
    addresses: [THEIRS],
    spentTxId: null,
    spentIndex: null,
    spentHeight: null,
    ...overrides,
  }
}

function tx(overrides: Partial<DashscanTransaction> = {}): DashscanTransaction {
  return {
    hash: 'f1493b1af3efb3de16758da3897b0e87fb27c09adbe3835141d6c71a68369459',
    type: 'CLASSIC',
    blockHeight: 1529177,
    blockHash: '000000a493d0e3c062e6326f73e0709229bc6053b1e7d4b5789504f3bfbb4352',
    timestamp: '2026-08-06T19:13:10.000Z',
    amount: '963099819203',
    version: 2,
    size: 225,
    vIn: [vin()],
    vOut: [vout(), vout({ value: 962999819203, number: 1, address: OURS, addresses: [OURS] })],
    confirmations: 26,
    instantLock: '0101db62fe17592d96',
    chainLocked: true,
    coinjoin: false,
    multisig: false,
    ...overrides,
  }
}

describe('dashscanToWalletTransactions', () => {
  it('reads an outgoing send as spent minus change', () => {
    const [result] = dashscanToWalletTransactions([tx()], 'w1', [OURS])

    expect(result.direction).toBe(-1)
    expect(result.inAmount).toBe(963099819428n)
    expect(result.outAmount).toBe(962999819203n)
    expect(result.transferAmount).toBe(100000225n)
    expect(result.address).toBe(OURS)
  })

  it('reads an incoming payment from the owned output', () => {
    const [result] = dashscanToWalletTransactions([tx()], 'w1', [THEIRS])

    expect(result.direction).toBe(1)
    expect(result.inAmount).toBe(0n)
    expect(result.outAmount).toBe(100000000n)
    expect(result.transferAmount).toBe(100000000n)
    expect(result.address).toBe(THEIRS)
  })

  // The p2p provider hands the renderer DASH decimal strings, so this path has
  // to match it or the transaction detail view renders two different units.
  it('formats input and output values as DASH decimal strings', () => {
    const [result] = dashscanToWalletTransactions([tx()], 'w1', [OURS])

    expect(result.vout[0].value).toBe('1.00000000')
    expect(result.vout[1].value).toBe('9629.99819203')
    expect(result.vin[0].value).toBe('9630.99819428')
  })

  // The docs type `value` as a string and the API serves a number; both have to
  // work, and the string form has to survive past the float-safe range.
  it('accepts a duffs value as either a number or a string', () => {
    const asString = tx({ vOut: [vout({ value: '9007199254740993', addresses: [OURS] })] })
    const [result] = dashscanToWalletTransactions([asString], 'w1', [OURS])

    expect(result.vout[0].value).toBe('90071992.54740993')
    expect(result.outAmount).toBe(9007199254740993n)
  })

  it('marks an InstantSend-locked transaction, and leaves an unlocked one pending', () => {
    const [locked] = dashscanToWalletTransactions([tx()], 'w1', [OURS])
    const [pending] = dashscanToWalletTransactions([tx({ instantLock: null })], 'w1', [OURS])

    expect(locked.status).toBe('Locked')
    expect(pending.status).toBe('Pending')
  })

  it('handles a coinbase input, whose fields are all null', () => {
    const coinbase = tx({
      vIn: [vin({ prevTxHash: null, vOutIndex: null, address: null, amount: null })],
      vOut: [vout({ addresses: [OURS], address: OURS })],
    })
    const [result] = dashscanToWalletTransactions([coinbase], 'w1', [OURS])

    expect(result.direction).toBe(1)
    expect(result.vin[0]).toEqual({ value: '0.00000000', n: 0, addr: '', prevTxId: '', prevVout: 0, sequence: 0 })
  })

  // Real ASSET_UNLOCK payload: credits withdrawn from Platform land as an
  // output with no transparent input, and the API sends `vIn: null` for it.
  it('reads an asset unlock, which has no vIn at all', () => {
    const unlock = tx({
      hash: 'd13a3bac5a22bf48e6b6fd48074d9eaa07a42ceff43a96172c31601f1637494b',
      type: 'ASSET_UNLOCK',
      amount: '1000',
      size: 190,
      instantLock: null,
      vIn: null,
      vOut: [vout({
        value: 1000,
        scriptPubKeyHex: '76a91475969517409f3dbdbd2806d6fa54788e52a8d74188ac',
        address: OURS,
        addresses: [OURS],
      })],
    })
    const [result] = dashscanToWalletTransactions([unlock], 'w1', [OURS])

    expect(result.direction).toBe(1)
    expect(result.inAmount).toBe(0n)
    expect(result.transferAmount).toBe(1000n)
    expect(result.address).toBe(OURS)
    expect(result.vin).toEqual([])
    expect(result.vout).toHaveLength(1)
  })

  it('survives a transaction with neither side, as QUORUM_COMMITMENT arrives', () => {
    const [result] = dashscanToWalletTransactions(
      [tx({ type: 'QUORUM_COMMITMENT', vIn: null, vOut: null })],
      'w1',
      [OURS],
    )

    expect(result.vin).toEqual([])
    expect(result.vout).toEqual([])
    expect(result.transferAmount).toBe(0n)
    expect(result.address).toBe('')
  })

  it('sees an owned key inside a bare-multisig output', () => {
    const multisig = tx({
      vIn: [vin({ address: THEIRS })],
      vOut: [vout({ address: THEIRS, addresses: [THEIRS, OURS] })],
    })
    const [result] = dashscanToWalletTransactions([multisig], 'w1', [OURS])

    expect(result.direction).toBe(1)
    expect(result.outAmount).toBe(100000000n)
  })

  it('carries spend status and pending fields through', () => {
    const spent = tx({ vOut: [vout({ spentTxId: 'e2589404', spentIndex: 0, spentHeight: 1529177 })] })
    const [result] = dashscanToWalletTransactions([spent], 'w1', [OURS])

    expect(result.vout[0]).toMatchObject({ spentTxId: 'e2589404', spentIndex: 0, spentHeight: 1529177 })

    const [mempool] = dashscanToWalletTransactions(
      [tx({ blockHeight: null, timestamp: null, confirmations: null, size: null })],
      'w1',
      [OURS],
    )
    expect(mempool.blockHeight).toBe(0)
    expect(mempool.confirmations).toBe(0)
    expect(mempool.size).toBe(0)
  })

  // The renderer sorts and day-groups on this field, so a mempool transaction
  // dated to the epoch would sink to the bottom of the history.
  it('dates a mempool transaction to now, not the epoch', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-14T12:00:00.000Z'))

    try {
      const [mempool] = dashscanToWalletTransactions([tx({ timestamp: null })], 'w1', [OURS])
      const [confirmed] = dashscanToWalletTransactions([tx({ timestamp: '2020-04-09T06:00:12.000Z' })], 'w1', [OURS])

      expect(mempool.date).toEqual(new Date('2026-08-14T12:00:00.000Z'))
      expect(confirmed.date).toEqual(new Date('2020-04-09T06:00:12.000Z'))
      expect(mempool.date.getTime()).toBeGreaterThan(confirmed.date.getTime())
    } finally {
      vi.useRealTimers()
    }
  })
})