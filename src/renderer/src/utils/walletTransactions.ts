import { WalletTxDto, WalletTxItem, WalletTxStatus } from '@renderer/types/WalletTransaction'

function mapWalletTransactionStatus(status: string, confirmations: number): WalletTxStatus {
  if (status === 'Failed' || status === 'Error') return 'failed'
  if (status === 'Locked') return 'success'
  if (confirmations >= 6) return 'success'
  return 'pending'
}

export function mapWalletTransaction(raw: WalletTxDto): WalletTxItem {
  const direction = raw.direction === 1 ? 'in' : 'out'

  return {
    id: raw.txid,
    status: mapWalletTransactionStatus(raw.status, raw.confirmations),
    confirmations: raw.confirmations,
    kind: 'core',
    blockHeight: raw.blockHeight,
    size: raw.size,
    title: direction === 'in' ? 'Receive' : 'Send',
    subtitleLabel: direction === 'in' ? 'from' : 'to',
    labelValue: raw.address,
    amount: raw.transferAmount,
    usdAmount: raw.usdAmount,
    date: new Date(raw.date),
    direction,
    vin: raw.vin,
    vout: raw.vout,
  }
}
