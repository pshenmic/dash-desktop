import { describe, expect, it } from 'vitest'
import { WalletTxDto } from '@renderer/types/WalletTransaction'
import { mapWalletTransaction } from '@renderer/utils/walletTransactions'

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
})
