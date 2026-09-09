import { DestinationKind } from '../enums/DestinationKind'
import { SourceKind } from '../enums/SourceKind'
import type { CoinControlSelection } from './CoinControl'

export interface SendDraft {
  fromKind: SourceKind
  toKind: DestinationKind
  fromAddress: string
  fromIdentity: string
  toValue: string
  amount: string
  acked: boolean
  coinControl: CoinControlSelection
}
