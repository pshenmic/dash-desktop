import type { PreviewUnit } from '../api/types'
import type { TxEndpointKind } from '../enums/TxEndpointKind'

export interface TxSummaryEndpoint {
  value: string
  kind: TxEndpointKind
  amount?: bigint
  paysFee?: boolean
}

export interface TxSummaryLine {
  label: string
  amount: bigint | null
  unit: PreviewUnit
}

export interface TxSummaryProps {
  unit: PreviewUnit
  amount?: bigint
  amountLabel?: string
  from?: TxSummaryEndpoint
  to: TxSummaryEndpoint[]
  toLabel?: string
  fees?: TxSummaryLine[]
  total?: bigint | null
  details?: TxSummaryLine[]
  className?: string
}

export interface TxAmountProps {
  amount: bigint
  unit: PreviewUnit
  hero?: boolean
}

export interface TxLineProps {
  line: TxSummaryLine
}

export interface TxEndpointProps {
  endpoint: TxSummaryEndpoint
  unit: PreviewUnit
  showAmount: boolean
}

export interface VisibleRecipients<T> {
  visible: T[]
  hidden: number
}
