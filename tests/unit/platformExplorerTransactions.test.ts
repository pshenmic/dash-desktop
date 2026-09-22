import { describe, it, expect } from 'vitest'
import {
  addressTransitionToPlatformTransaction,
  mergePlatformTransactions,
  transferToPlatformTransaction,
} from '../../src/main/src/utils/platformExplorerTransactions'
import {
  PlatformExplorerAddressTransition,
  PlatformExplorerTransfer,
} from '../../src/main/src/types/PlatformExplorer'
import { PlatformTransaction } from '../../src/main/src/types/PlatformTransaction'

const WALLET = 'wallet-1'
const end = (source: string, amount: bigint): {source: string, amount: bigint} => ({source, amount})
// The one key the explorer reports in both encodings. platform_addresses holds
// only the bech32m form.
const OUR_ADDRESS = 'tdash1kq79z66rh34l4u2axlz3jv34zwshggnenul6cvwn'
const OUR_ADDRESS_BASE58 = 'yRpNvoc3hd66c3rNrPRGubVd9vGUoAVpZV'
const OUR_IDENTITY = '7YLm6o78TpqiauC9oQTGeXHwAeafzzkcxBGddjbRFL2x'

function transition(overrides: Partial<PlatformExplorerAddressTransition> = {}): PlatformExplorerAddressTransition {
  return {
    hash: 'AAAA',
    index: 17,
    blockHash: 'BBBB',
    blockHeight: 246835,
    type: 'ADDRESS_FUNDS_TRANSFER',
    batchType: null,
    timestamp: '2026-01-15T16:15:33.127Z',
    gasUsed: 704433560,
    status: 'SUCCESS',
    error: null,
    incoming: false,
    amount: '-100000000',
    base58Address: OUR_ADDRESS_BASE58,
    bech32mAddress: OUR_ADDRESS,
    addressesCount: 1,
    ...overrides,
  }
}

function transfer(overrides: Partial<PlatformExplorerTransfer> = {}): PlatformExplorerTransfer {
  return {
    amount: '1000000000',
    sender: null,
    recipient: OUR_IDENTITY,
    timestamp: '2025-01-12T08:07:25.094Z',
    txHash: 'CCCC',
    type: 'IDENTITY_CREATE',
    blockHash: 'DDDD',
    gasUsed: 120337200,
    ...overrides,
  }
}

describe('addressTransitionToPlatformTransaction', () => {
  it('keeps the signed net and reads gas as credits', () => {
    const row = addressTransitionToPlatformTransaction(transition(), WALLET)
    expect(row.netCredits).toBe(-100_000_000n)
    expect(row.gasCredits).toBe(704_433_560n)
    expect(row.sender).toEqual([end(OUR_ADDRESS, 100_000_000n)])
    expect(row.amountCredits).toBe(100_000_000n)
    expect(row.walletId).toBe(WALLET)
    expect(row.blockHeight).toBe(246835)
    expect(row.status).toBe('SUCCESS')
  })

  it('names our address in the encoding platform_addresses stores', () => {
    const row = addressTransitionToPlatformTransaction(transition(), WALLET)
    expect(row.sender).toEqual([end(OUR_ADDRESS, 100_000_000n)])
    expect(row.sender).not.toEqual([end(OUR_ADDRESS_BASE58, 100_000_000n)])
  })

  it('puts our address on the end the transition paid when it paid us', () => {
    const row = addressTransitionToPlatformTransaction(
      transition({ incoming: true, amount: '250000000' }),
      WALLET,
    )
    expect(row.recipient).toEqual([end(OUR_ADDRESS, 250_000_000n)])
    expect(row.sender).toEqual([])
    expect(row.amountCredits).toBe(250_000_000n)
  })

  it('reads the direction off the amount when the explorer omits it', () => {
    const row = addressTransitionToPlatformTransaction(
      transition({ incoming: null, amount: '20000000' }),
      WALLET,
    )
    expect(row.recipient).toEqual([end(OUR_ADDRESS, 20_000_000n)])
    expect(row.sender).toEqual([])
  })

  it('survives an absent amount, gas and timestamp', () => {
    const row = addressTransitionToPlatformTransaction(
      transition({ amount: null, gasUsed: null, timestamp: null, status: null }),
      WALLET,
    )
    expect(row.netCredits).toBe(0n)
    expect(row.gasCredits).toBe(0n)
    expect(row.date.getTime()).toBe(0)
    expect(row.status).toBeNull()
  })
})

describe('transferToPlatformTransaction', () => {
  it('signs the amount by which side of it we are', () => {
    const received = transferToPlatformTransaction(transfer(), OUR_IDENTITY, WALLET)
    expect(received.netCredits).toBe(1_000_000_000n)
    expect(received.recipient).toEqual([end(OUR_IDENTITY, 1_000_000_000n)])

    const sent = transferToPlatformTransaction(
      transfer({ sender: OUR_IDENTITY, recipient: 'someone-else' }),
      OUR_IDENTITY,
      WALLET,
    )
    expect(sent.netCredits).toBe(-1_000_000_000n)
    expect(sent.sender).toEqual([end(OUR_IDENTITY, 1_000_000_000n)])
    expect(sent.recipient).toEqual([end('someone-else', 1_000_000_000n)])
  })

  it('reports neither a block height nor a status, which the endpoint omits', () => {
    const row = transferToPlatformTransaction(transfer(), OUR_IDENTITY, WALLET)
    expect(row.blockHeight).toBeNull()
    expect(row.status).toBeNull()
  })
})

describe('mergePlatformTransactions', () => {
  it('folds the two sides of an identity funded from our own address into one internal row', () => {
    const hash = 'EEEE'
    const merged = mergePlatformTransactions([
      addressTransitionToPlatformTransaction(
        transition({ hash, type: 'IDENTITY_TOP_UP_FROM_ADDRESSES', amount: '-1000000000' }),
        WALLET,
      ),
      transferToPlatformTransaction(
        transfer({ txHash: hash, type: 'IDENTITY_TOP_UP_FROM_ADDRESSES', amount: '1000000000' }),
        OUR_IDENTITY,
        WALLET,
      ),
    ])

    expect(merged).toHaveLength(1)
    // Ours on both ends, so the wallet is out the fee and nothing else — and
    // the row still says which address funded which identity, and with how much.
    expect(merged[0].netCredits).toBe(0n)
    expect(merged[0].amountCredits).toBe(1_000_000_000n)
    expect(merged[0].sender).toEqual([end(OUR_ADDRESS, 1_000_000_000n)])
    expect(merged[0].recipient).toEqual([end(OUR_IDENTITY, 1_000_000_000n)])
  })

  it('keeps an end only one side of the transition names', () => {
    const hash = 'IIII'
    const merged = mergePlatformTransactions([
      addressTransitionToPlatformTransaction(transition({ hash, incoming: true, amount: '900' }), WALLET),
      transferToPlatformTransaction(
        transfer({ txHash: hash, amount: '900', sender: 'ExternalSenderIdentity', recipient: OUR_IDENTITY }),
        OUR_IDENTITY,
        WALLET,
      ),
    ])
    expect(merged[0].sender).toEqual([end('ExternalSenderIdentity', 900n)])
    // Both walks named an end this transition paid: our address, and the
    // identity the transfer endpoint reports.
    expect(merged[0].recipient).toEqual([end(OUR_ADDRESS, 900n), end(OUR_IDENTITY, 900n)])
  })

  // One transition pays several addresses and is paid by several, and each
  // walk only ever names the one address it asked about.
  it('collects every end the walks named, not just the first', () => {
    const hash = 'KKKK'
    const second = 'tdash1kzzz9z66rh34l4u2axlz3jv34zwshggnenul6cvw'
    const third = 'tdash1kyyy9z66rh34l4u2axlz3jv34zwshggnenul6cvw'
    const merged = mergePlatformTransactions([
      addressTransitionToPlatformTransaction(transition({ hash, amount: '-100000' }), WALLET),
      addressTransitionToPlatformTransaction(
        transition({ hash, amount: '-456766601000', bech32mAddress: second }),
        WALLET,
      ),
      addressTransitionToPlatformTransaction(
        transition({ hash, incoming: true, amount: '186061977000', bech32mAddress: third }),
        WALLET,
      ),
    ])

    expect(merged[0].sender).toEqual([end(OUR_ADDRESS, 100_000n), end(second, 456_766_601_000n)])
    expect(merged[0].recipient).toEqual([end(third, 186_061_977_000n)])
  })

  it('names one end once however many walks report it', () => {
    const hash = 'LLLL'
    const merged = mergePlatformTransactions([
      addressTransitionToPlatformTransaction(transition({ hash }), WALLET),
      addressTransitionToPlatformTransaction(transition({ hash }), WALLET),
    ])

    expect(merged[0].sender).toEqual([end(OUR_ADDRESS, 100_000_000n)])
  })

  it('never sums the amount of one transition twice', () => {
    const hash = 'JJJJ'
    const merged = mergePlatformTransactions([
      addressTransitionToPlatformTransaction(transition({ hash, amount: '-900' }), WALLET),
      transferToPlatformTransaction(transfer({ txHash: hash, amount: '900' }), OUR_IDENTITY, WALLET),
    ])
    expect(merged[0].amountCredits).toBe(900n)
  })

  it('never sums the gas of one transition twice', () => {
    const hash = 'FFFF'
    const merged = mergePlatformTransactions([
      addressTransitionToPlatformTransaction(transition({ hash, gasUsed: 500 }), WALLET),
      transferToPlatformTransaction(transfer({ txHash: hash, gasUsed: 500 }), OUR_IDENTITY, WALLET),
    ])
    expect(merged[0].gasCredits).toBe(500n)
  })

  it('takes the block height and status from whichever side reports them', () => {
    const hash = 'GGGG'
    const merged = mergePlatformTransactions([
      transferToPlatformTransaction(transfer({ txHash: hash }), OUR_IDENTITY, WALLET),
      addressTransitionToPlatformTransaction(transition({ hash, blockHeight: 999, status: 'SUCCESS' }), WALLET),
    ])
    expect(merged[0].blockHeight).toBe(999)
    expect(merged[0].status).toBe('SUCCESS')
  })

  it('leaves unrelated transitions alone and orders them newest first', () => {
    const rows: PlatformTransaction[] = [
      addressTransitionToPlatformTransaction(transition({ hash: 'OLD', timestamp: '2024-01-01T00:00:00.000Z' }), WALLET),
      addressTransitionToPlatformTransaction(transition({ hash: 'NEW', timestamp: '2026-01-01T00:00:00.000Z' }), WALLET),
    ]
    const merged = mergePlatformTransactions(rows)
    expect(merged.map((row) => row.hash)).toEqual(['NEW', 'OLD'])
  })

  it('does not mutate the rows handed to it', () => {
    const row = addressTransitionToPlatformTransaction(transition({ hash: 'HHHH' }), WALLET)
    mergePlatformTransactions([row, addressTransitionToPlatformTransaction(transition({ hash: 'HHHH' }), WALLET)])
    expect(row.netCredits).toBe(-100_000_000n)
  })
})
