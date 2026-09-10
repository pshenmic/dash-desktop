import { DestinationKind } from '../enums/DestinationKind'
import { SourceKind } from '../enums/SourceKind'
import type { CoinControlSelection } from './CoinControl'
import type { TransferOperation } from '../enums/TransferOperation'

export interface SendRecipientDraft {
  id: string
  address: string
  amount: string
}

export interface AdvancedSendRoute {
  recipients: SendRecipientDraft[]
  subtractFee: boolean
  feeRecipientId: string | null
  changeAddress?: string
  customChangeEnabled?: boolean
}

export interface SendDraft {
  fromKind: SourceKind
  toKind: DestinationKind
  fromAddress: string
  fromIdentity: string
  toValue: string
  amount: string
  acked: boolean
  coinControl: CoinControlSelection
  advanced: boolean
  advancedRoutes: Partial<Record<TransferOperation, AdvancedSendRoute>>
}
