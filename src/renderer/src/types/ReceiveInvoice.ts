import type { Network } from '../api/types'

export interface ReceiveInvoice {
  addressLabel: string
  address: string
  amount: string | null
  paymentLink: string | null
  network: Network | null
}

export interface ReceiveInvoiceQr {
  path: string
  modules: number
}

export interface ReceiveQrProps {
  value: string
  invoice: ReceiveInvoice
}
