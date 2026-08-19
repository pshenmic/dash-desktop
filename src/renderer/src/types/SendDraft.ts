import { DestinationKind } from '../enums/DestinationKind'
import { SourceKind } from '../enums/SourceKind'
import type { SpecificSourcePreferences } from './SpecificSource'

export interface SendDraft {
  fromKind: SourceKind
  toKind: DestinationKind
  fromAddress: string
  fromIdentity: string
  toValue: string
  amount: string
  acked: boolean
  specificSourcePreferences: SpecificSourcePreferences
}
