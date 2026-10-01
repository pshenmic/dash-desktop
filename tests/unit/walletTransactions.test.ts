import { afterEach, describe, expect, it, vi } from 'vitest'
import type { WalletHistory } from '@renderer/api/types'
import type { WalletTransactionOwnership, WalletTxDto } from '@renderer/types/WalletTransaction'
import { AssetLockFundingKind } from '@renderer/enums/AssetLockFundingKind'
import { AssetLockFundingPhase } from '@renderer/enums/AssetLockFundingPhase'
import { assetLockInternalTransfer, mapWalletTransaction, mergeWalletTransactions } from '@renderer/utils/walletTransactions'
import { fetchTransactionOwnership } from '@renderer/hooks/useWalletTransactions'

function outgoingTransaction(): WalletTxDto {
  return {
    walletId: 'wallet-1', txid: 'outgoing', address: 'Xrecipient', direction: -1,
    inAmount: 200_000_000n, outAmount: 49_999_999n, transferAmount: 150_000_001n,
    usdAmount: '0.0', date: new Date('2026-08-19T09:00:00.000Z'), blockHeight: 0,
    size: 225, confirmations: 0, status: 'Locked', instantLocked: true, chainlocked: false, isLocal: true,
    vin: [{addr: 'Xsender', value: '2.00000000', n: 0, prevTxId: 'prev', prevVout: 0, sequence: 0}],
    vout: [
      {address: 'Xrecipient', value: '1.50000000', n: 0, spentTxId: '', spentIndex: 0, spentHeight: 0},
      {address: 'Xchange', value: '0.49999999', n: 1, spentTxId: '', spentIndex: 0, spentHeight: 0},
    ],
  }
}

function fundingHistory(): WalletHistory {
  const core = outgoingTransaction()
  core.outAmount = 99_937_876n
  core.transferAmount = 100_062_124n
  core.vout = [{...core.vout[0], address: '', value: '1.00062000'}, {...core.vout[1], value: '0.99937876'}]
  return {core: [core], platformFailed: false, platform: [{
    walletId: 'wallet-1', hash: 'FUNDINGABC', type: 'ADDRESS_FUNDING_FROM_ASSET_LOCK', date: core.date,
    blockHeight: 609422, status: 'SUCCESS', error: null, gasCredits: 22_626_920n,
    netCredits: 100_062_000_000n, amountCredits: 100_000_000_000n, sender: [],
    recipient: [{source: 'ownPlatform', amount: 100_000_000_000n}, {source: 'ownRemainder', amount: 62_000_000n}],
  }]}
}

function fundingOwnership(): WalletTransactionOwnership {
  return {
    walletId: 'wallet-1', core: new Set(['Xsender', 'Xchange']), platform: new Set(['ownPlatform', 'ownRemainder']),
    identities: new Set(), shielded: new Set(), funding: {
      phase: AssetLockFundingPhase.Done, kind: AssetLockFundingKind.Address, txid: 'outgoing', stHash: 'fundingabc',
      txHeight: 10, chainLockedHeight: 10, lockKind: null, toPlatformAddress: 'ownPlatform',
      identityIdentifier: null, amountDuffs: 100_062_000n, error: null,
    },
  }
}

describe('mapWalletTransaction', () => {
  it('maps a complete incoming transaction for the detail view', () => {
    const raw: WalletTxDto = {
      walletId: 'wallet-1',
      txid: '52061cb1e8bda9bc8083590be1daa3c6b30439724c0d2185e920f549d79fe247',
      address: 'XwalletOutput',
      direction: 1,
      inAmount: 0n,
      outAmount: 125000000n,
      transferAmount: 125000000n,
      usdAmount: '0.0',
      date: new Date('2026-08-19T08:00:00.000Z'),
      blockHeight: 2300000,
      size: 225,
      confirmations: 12,
      status: 'Locked',
      vin: [{addr: 'Xsender', value: '1.25010000', n: 0, prevTxId: 'prev', prevVout: 1, sequence: 0}],
      vout: [{address: 'XwalletOutput', value: '1.25000000', n: 0, spentTxId: '', spentIndex: 0, spentHeight: 0}],
      instantLocked: true,
      chainlocked: true,
      isLocal: null,
    }

    expect(mapWalletTransaction(raw)).toEqual({
      id: raw.txid,
      status: 'success',
      confirmations: 12,
      kind: 'core',
      blockHeight: 2300000,
      size: 225,
      title: 'Receive',
      subtitleLabel: 'from',
      labelValue: 'XwalletOutput',
      amount: 125000000n,
      usdAmount: '0.0',
      date: new Date('2026-08-19T08:00:00.000Z'),
      direction: 'in',
      vin: raw.vin,
      vout: raw.vout,
    })
  })

  it('maps pending outgoing transactions without changing their amount', () => {
    const raw: WalletTxDto = {
      walletId: 'wallet-1',
      txid: 'outgoing',
      address: 'Xrecipient',
      direction: -1,
      inAmount: 200000000n,
      outAmount: 50000000n,
      transferAmount: 150000000n,
      usdAmount: '0.0',
      date: new Date('2026-08-19T09:00:00.000Z'),
      blockHeight: 0,
      size: 200,
      confirmations: 0,
      status: 'Pending',
      vin: [],
      vout: [],
      instantLocked: false,
      chainlocked: false,
      isLocal: true,
    }

    const mapped = mapWalletTransaction(raw)

    expect(mapped).toMatchObject({
      status: 'pending',
      title: 'Send',
      subtitleLabel: 'to',
      amount: 150000000n,
      direction: 'out',
    })
  })

  it.each<[string, bigint]>([
    ['0.49999999', 1n],
    ['0.49998765', 1235n],
  ])('shows only the actual fee for transfers between owned wallets with change %s', (change, fee) => {
    const raw = outgoingTransaction()
    raw.vout[1].value = change
    const mapped = mapWalletTransaction(raw, new Set(['Xsender', 'Xrecipient', 'Xchange']))
    expect(mapped).toMatchObject({title: 'Internal transfer', direction: 'out', amount: fee, status: 'success'})
  })

  it('shows the same fee from the receiving owned wallet', () => {
    const raw = {...outgoingTransaction(), direction: 1, inAmount: 0n, outAmount: 150_000_000n, transferAmount: 150_000_000n}
    expect(mapWalletTransaction(raw, new Set(['Xsender', 'Xrecipient', 'Xchange'])))
      .toMatchObject({title: 'Internal transfer', direction: 'out', amount: 1n})
  })

  it('recognizes a current-wallet self transfer from complete wallet input and output totals', () => {
    const raw = {...outgoingTransaction(), outAmount: 199_999_999n, transferAmount: 1n}
    expect(mapWalletTransaction(raw)).toMatchObject({title: 'Internal transfer', direction: 'out', amount: 1n})
    expect(mapWalletTransaction(raw, new Set(['Xsender'])))
      .toMatchObject({title: 'Internal transfer', direction: 'out', amount: 1n})
  })

  it('calculates large decimal input fees without losing duffs through floating point', () => {
    const raw = outgoingTransaction()
    raw.inAmount = 9_007_199_254_740_993n
    raw.outAmount = 0n
    raw.transferAmount = raw.inAmount
    raw.vin[0].value = '90071992.54740993'
    raw.vout = [{...raw.vout[0], value: '90071992.54740990'}]
    expect(mapWalletTransaction(raw, new Set(['Xsender', 'Xrecipient'])))
      .toMatchObject({title: 'Internal transfer', amount: 3n})
  })

  it('keeps an external payment with owned change as Send', () => {
    const raw = outgoingTransaction()
    expect(mapWalletTransaction(raw, new Set(['Xsender', 'Xchange'])))
      .toMatchObject({title: 'Send', direction: 'out', amount: raw.transferAmount})
    expect(mapWalletTransaction(raw)).toMatchObject({title: 'Send', amount: raw.transferAmount})
  })

  it('does not classify a transaction with an external input as an internal transfer', () => {
    const raw = outgoingTransaction()
    raw.vin.push({...raw.vin[0], addr: 'Xexternal', value: '0.00000002', n: 1})
    expect(mapWalletTransaction(raw, new Set(['Xsender', 'Xrecipient', 'Xchange'])))
      .toMatchObject({title: 'Send', amount: raw.transferAmount})
  })

  it.each(['', '0', '-1', '1.000000001', '1e0', '1.', ' 2.00000000'])
    ('does not infer ownership or fees from an unresolved or invalid input amount %s', value => {
      const raw = {...outgoingTransaction(), outAmount: 199_999_999n}
      raw.vin[0].value = value
      expect(mapWalletTransaction(raw, new Set(['Xsender', 'Xrecipient', 'Xchange'])))
        .toMatchObject({title: 'Send', amount: raw.transferAmount})
    })

  it('does not use wallet totals to bypass unresolved input addresses', () => {
    const raw = {...outgoingTransaction(), outAmount: 199_999_999n}
    raw.vin[0].addr = ''
    expect(mapWalletTransaction(raw)).toMatchObject({title: 'Send', amount: raw.transferAmount})
  })

  it.each(['', '-0.1', '0.000000001', '1e1'])('does not infer fees from an invalid output amount %s', value => {
    const raw = outgoingTransaction()
    raw.vout[0].value = value
    expect(mapWalletTransaction(raw, new Set(['Xsender', 'Xrecipient', 'Xchange'])))
      .toMatchObject({title: 'Send', amount: raw.transferAmount})
  })

  it('does not treat positive addressless burn outputs as owned funds', () => {
    const raw = outgoingTransaction()
    raw.vout.push({...raw.vout[0], address: '', value: '0.00000001', n: 2})
    raw.outAmount = 200_000_000n
    expect(mapWalletTransaction(raw, new Set(['Xsender', 'Xrecipient', 'Xchange'])))
      .toMatchObject({title: 'Send', amount: raw.transferAmount})
  })

  it('allows a zero-value addressless output beside a verified internal payment', () => {
    const raw = outgoingTransaction()
    raw.vout.push({...raw.vout[0], address: '', value: '0.00000000', n: 2})
    expect(mapWalletTransaction(raw, new Set(['Xsender', 'Xrecipient', 'Xchange'])))
      .toMatchObject({title: 'Internal transfer', amount: 1n})
  })

  it('does not classify transactions without inputs or monetary outputs, or with outputs exceeding inputs', () => {
    const raw = outgoingTransaction()
    const owned = new Set(['Xsender', 'Xrecipient', 'Xchange'])
    expect(mapWalletTransaction({...raw, vin: []}, owned).title).toBe('Send')
    expect(mapWalletTransaction({...raw, vout: []}, owned).title).toBe('Send')
    expect(mapWalletTransaction({...raw, vout: [{...raw.vout[0], value: '0'}]}, owned).title).toBe('Send')
    expect(mapWalletTransaction({...raw, vout: [{...raw.vout[0], value: '3'}]}, owned).title).toBe('Send')
  })
})

describe('linked local asset lock funding', () => {
  it('uses actual L1 fee and observed L2 gas despite explorer gross credits cancelling the lock', () => {
    const history = fundingHistory()
    const ownership = fundingOwnership()
    const funding = assetLockInternalTransfer(history, ownership)!
    expect(funding).toEqual({walletId: 'wallet-1', txid: 'outgoing', stHash: 'FUNDINGABC', coreFeeDuffs: 124n, platformFeeCredits: 22_626_920n})
    const core = mapWalletTransaction(history.core[0], ownership.core, funding)
    const platform = {...history.platform[0], internalTransferFeeCredits: funding.platformFeeCredits}
    expect(mergeWalletTransactions([core], [platform])).toEqual(expect.arrayContaining([
      expect.objectContaining({kind: 'core', title: 'Internal transfer', amount: 124n, direction: 'out'}),
      expect.objectContaining({kind: 'platform', title: 'Internal transfer', amount: 22_626_920n, direction: 'out'}),
    ]))
    expect(history.core[0].transferAmount).toBe(100_062_124n)
    expect(history.platform[0].amountCredits).toBe(100_000_000_000n)
  })

  it.each(['missing state', 'unfinished', 'other kind', 'error', 'txid', 'stHash', 'wallet', 'external destination', 'burn amount'])
    ('leaves history unchanged without matching successful local funding proof: %s', mismatch => {
      const history = fundingHistory()
      const ownership = fundingOwnership()
      const funding = ownership.funding!
      if (mismatch === 'missing state') delete ownership.funding
      if (mismatch === 'unfinished') funding.phase = AssetLockFundingPhase.Resumable
      if (mismatch === 'other kind') funding.kind = AssetLockFundingKind.Shielded
      if (mismatch === 'error') funding.error = 'failed'
      if (mismatch === 'txid') funding.txid = 'another'
      if (mismatch === 'stHash') funding.stHash = 'another'
      if (mismatch === 'wallet') history.platform[0].walletId = 'other'
      if (mismatch === 'external destination') ownership.platform.delete('ownPlatform')
      if (mismatch === 'burn amount') funding.amountDuffs = 100_062_001n
      expect(assetLockInternalTransfer(history, ownership)).toBeNull()
      expect(mapWalletTransaction(history.core[0], ownership.core).title).toBe('Send')
    })

  it.each(['external input', 'unresolved input', 'external change', 'extra burn', 'missing remainder', 'duplicate recipient', 'foreign recipient', 'wrong net', 'failed', 'unconfirmed', 'missing gas', 'oversized gas'])
    ('rejects incomplete or inconsistent linked transaction data: %s', mismatch => {
      const history = fundingHistory()
      const core = history.core[0]
      const platform = history.platform[0]
      if (mismatch === 'external input') core.vin[0].addr = 'external'
      if (mismatch === 'unresolved input') core.vin[0].value = ''
      if (mismatch === 'external change') core.vout[1].address = 'external'
      if (mismatch === 'extra burn') core.vout.push({...core.vout[0], n: 2})
      if (mismatch === 'missing remainder') platform.recipient.pop()
      if (mismatch === 'duplicate recipient') platform.recipient[1].source = platform.recipient[0].source
      if (mismatch === 'foreign recipient') platform.recipient[1].source = 'external'
      if (mismatch === 'wrong net') platform.netCredits -= 1n
      if (mismatch === 'failed') platform.status = 'FAIL'
      if (mismatch === 'unconfirmed') platform.blockHeight = null
      if (mismatch === 'missing gas') platform.gasCredits = 0n
      if (mismatch === 'oversized gas') platform.gasCredits = platform.netCredits
      expect(assetLockInternalTransfer(history, fundingOwnership())).toBeNull()
    })
})

describe('transaction ownership', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('includes existing same-network wallet addresses and identities while excluding other networks', async () => {
    const api = {
      getAllWallets: vi.fn().mockResolvedValue([
        {walletId: 'wallet-a', network: 'testnet'},
        {walletId: 'wallet-b', network: 'testnet'},
        {walletId: 'wallet-main', network: 'mainnet'},
      ]),
      getAddresses: vi.fn(async (walletId: string) => ({
        receiving: [{walletId, address: `${walletId}-receive`}, {walletId: 'wallet-other', address: 'foreign-row'}],
        change: [{walletId, address: `${walletId}-change`}],
      })),
      getPlatformAddresses: vi.fn(async (walletId: string) => [{platformAddress: `${walletId}-platform`}]),
      getIdentities: vi.fn(async (walletId: string) => [{identifier: `${walletId}-identity`}]),
      getShieldedAddresses: vi.fn(async (walletId: string) => [`${walletId}-shielded`]),
    }
    vi.stubGlobal('window', {electronAPI: api})
    expect(await fetchTransactionOwnership('wallet-a')).toEqual({
      walletId: 'wallet-a',
      core: new Set(['wallet-a-receive', 'wallet-a-change', 'wallet-b-receive', 'wallet-b-change']),
      platform: new Set(['wallet-a-platform', 'wallet-b-platform']),
      identities: new Set(['wallet-a-identity', 'wallet-b-identity']),
      shielded: new Set(['wallet-a-shielded', 'wallet-b-shielded']),
    })
    for (const endpoint of [api.getAddresses, api.getPlatformAddresses, api.getIdentities, api.getShieldedAddresses]) {
      expect(endpoint.mock.calls.map(call => call[0])).toEqual(['wallet-a', 'wallet-b'])
    }
  })

  it('keeps successful ownership reads and leaves rejected or unavailable address classes unknown', async () => {
    const api = {
      getAllWallets: vi.fn().mockResolvedValue([
        {walletId: 'wallet-a', network: 'testnet'}, {walletId: 'wallet-b', network: 'testnet'},
      ]),
      getAddresses: vi.fn(async (walletId: string) => {
        if (walletId === 'wallet-b') throw new Error('offline')
        return {receiving: [{walletId, address: 'Xsender'}], change: [{walletId, address: 'Xchange'}]}
      }),
      getPlatformAddresses: vi.fn().mockRejectedValue(new Error('offline')),
      getIdentities: vi.fn(async (walletId: string) => [{identifier: `${walletId}-identity`}]),
      getShieldedAddresses: vi.fn().mockResolvedValue(null),
    }
    vi.stubGlobal('window', {electronAPI: api})
    const ownership = await fetchTransactionOwnership('wallet-a')
    expect(ownership).toEqual({
      walletId: 'wallet-a', core: new Set(['Xsender', 'Xchange']), platform: new Set(),
      identities: new Set(['wallet-a-identity', 'wallet-b-identity']), shielded: new Set(),
    })
    const raw = outgoingTransaction()
    expect(mapWalletTransaction(raw, ownership.core)).toMatchObject({title: 'Send', amount: raw.transferAmount})
  })

  it('loads only the selected wallet funding state and links it after ownership reads', async () => {
    const expected = fundingOwnership()
    const api = {
      getAllWallets: vi.fn().mockResolvedValue([{walletId: 'wallet-1', network: 'testnet'}, {walletId: 'wallet-2', network: 'testnet'}]),
      getAddresses: vi.fn(async (walletId: string) => ({receiving: [{walletId, address: 'Xsender'}], change: [{walletId, address: 'Xchange'}]})),
      getPlatformAddresses: vi.fn().mockResolvedValue([{platformAddress: 'ownPlatform'}, {platformAddress: 'ownRemainder'}]),
      getIdentities: vi.fn().mockResolvedValue([]), getShieldedAddresses: vi.fn().mockResolvedValue(null),
      getAssetLockFundingState: vi.fn().mockResolvedValue(expected.funding),
    }
    vi.stubGlobal('window', {electronAPI: api})
    const ownership = await fetchTransactionOwnership('wallet-1')
    expect(ownership).toEqual(expected)
    expect(api.getAssetLockFundingState).toHaveBeenCalledExactlyOnceWith('wallet-1')
    expect(assetLockInternalTransfer(fundingHistory(), ownership)).toMatchObject({coreFeeDuffs: 124n, platformFeeCredits: 22_626_920n})
    api.getAssetLockFundingState.mockRejectedValueOnce(new Error('unavailable'))
    expect(assetLockInternalTransfer(fundingHistory(), await fetchTransactionOwnership('wallet-1'))).toBeNull()
  })
})
