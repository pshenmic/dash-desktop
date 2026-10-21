import type { CoreRecipient, PlatformRecipient } from '../api/types'
import { AUTOMATIC_SOURCE_LABELS } from '../constants/sendPages'
import { DestinationKind } from '../enums/DestinationKind'
import { ShieldedSpendKind } from '../enums/ShieldedSpendKind'
import { SourceKind } from '../enums/SourceKind'
import { TxEndpointKind } from '../enums/TxEndpointKind'
import type { CoinControlSelection } from '../types/CoinControl'
import type { TxSummaryEndpoint } from '../types/TxSummary'

export function sourceEndpoint(source: SourceKind, selection: CoinControlSelection, selectionSummary: string, identityId?: string): TxSummaryEndpoint {
  if (source === SourceKind.Identity) return { value: identityId ?? '', kind: TxEndpointKind.Address }
  switch (selection.kind) {
    case 'automatic':
      return { value: AUTOMATIC_SOURCE_LABELS[source], kind: TxEndpointKind.Label }
    case 'coreAddress':
    case 'platformAddress':
      return { value: selection.address, kind: TxEndpointKind.Address }
    case 'shieldedAddress':
      return { value: selection.address, kind: TxEndpointKind.Shielded }
    default:
      return { value: selectionSummary, kind: TxEndpointKind.Label }
  }
}

export function destinationEndpoint(destination: DestinationKind, display: string): TxSummaryEndpoint {
  if (destination === DestinationKind.NewIdentity) return { value: display, kind: TxEndpointKind.Label }
  if (destination === DestinationKind.Shielded) return { value: display, kind: TxEndpointKind.Shielded }
  return { value: display, kind: TxEndpointKind.Address }
}

export function recipientEndpoints(recipients: PlatformRecipient[], feeOutputIndex?: number): TxSummaryEndpoint[] {
  return recipients.map((recipient, index) => ({
    value: recipient.address,
    kind: TxEndpointKind.Address,
    amount: recipient.amountCredits,
    paysFee: index === feeOutputIndex,
  }))
}

export function coreRecipientEndpoints(recipients: CoreRecipient[]): TxSummaryEndpoint[] {
  return recipients.map(recipient => ({
    value: recipient.address,
    kind: TxEndpointKind.Address,
    amount: recipient.amountDuffs,
  }))
}

export function shieldedSpendEndpoints(kind: ShieldedSpendKind, toValue: string, recipients?: PlatformRecipient[]): TxSummaryEndpoint[] {
  if (recipients) {
    return recipients.map(recipient => ({
      value: recipient.address,
      kind: TxEndpointKind.Shielded,
      amount: recipient.amountCredits,
    }))
  }
  return [{ value: toValue, kind: kind === ShieldedSpendKind.IdentityCreate ? TxEndpointKind.Label : TxEndpointKind.Address }]
}
