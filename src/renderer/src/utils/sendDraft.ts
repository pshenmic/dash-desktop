import { DestinationKind } from '../enums/DestinationKind'
import { SourceKind } from '../enums/SourceKind'
import type { AdvancedSendRoute, SendDraft } from '../types/SendDraft'
import type { TransferOperation } from '../enums/TransferOperation'
import { automaticCoinControl, normalizeCoinControlSelection } from './coinControl'
import { resolveOperation } from './transferMatrix'

const sendDrafts = new Map<string, SendDraft>()

function sourceKind(value: string | null): SourceKind | undefined {
  return Object.values(SourceKind).find(kind => kind === value)
}

function destinationKind(value: string | null): DestinationKind | undefined {
  return Object.values(DestinationKind).find(kind => kind === value)
}

export function createSendDraft(from: string | null = null, to: string | null = null): SendDraft {
  return {
    fromKind: sourceKind(from) ?? SourceKind.Core,
    toKind: destinationKind(to) ?? DestinationKind.CoreAddress,
    fromAddress: '',
    fromIdentity: '',
    toValue: '',
    amount: '',
    acked: false,
    coinControl: automaticCoinControl(),
    advanced: false,
    advancedRoutes: {},
  }
}

function withLinkedRecipient(draft: SendDraft, recipient: string): SendDraft {
  const fromKind = resolveOperation(draft.fromKind, draft.toKind) == null ? SourceKind.Core : draft.fromKind
  const operation = resolveOperation(fromKind, draft.toKind)
  const linked = {...draft, fromKind, acked: false}
  if (!draft.advanced || operation == null) return {...linked, toValue: recipient}
  const route = getAdvancedSendRoute(linked, operation)
  const [first, ...rest] = route.recipients
  return {
    ...linked,
    advancedRoutes: {...linked.advancedRoutes, [operation]: {...route, recipients: [{...first, address: recipient}, ...rest]}},
  }
}

export function getOrCreateSendDraft(walletId: string | null, from: string | null, to: string | null, recipient: string | null = null): SendDraft {
  const existing = walletId == null ? undefined : sendDrafts.get(walletId)
  const fromKind = sourceKind(from)
  const toKind = destinationKind(to)
  const base = existing == null
    ? createSendDraft(from, to)
    : {
        ...existing,
        ...(fromKind != null && {fromKind}),
        ...(toKind != null && {toKind}),
      }
  const draft = recipient == null ? base : withLinkedRecipient(base, recipient.trim())
  if (walletId == null) return draft
  draft.coinControl = normalizeCoinControlSelection(draft.coinControl, resolveOperation(draft.fromKind, draft.toKind))
  sendDrafts.set(walletId, draft)
  return draft
}

export function saveSendDraft(walletId: string, draft: SendDraft): void {
  sendDrafts.set(walletId, draft)
}

export function clearSendDraft(walletId: string): void {
  sendDrafts.delete(walletId)
}

export function getAdvancedSendRoute(draft: SendDraft, operation: TransferOperation | null): AdvancedSendRoute {
  return (operation == null ? undefined : draft.advancedRoutes[operation]) ?? {
    recipients: [{id: 'first', address: '', amount: ''}],
    subtractFee: false,
    feeRecipientId: null,
  }
}

export function setSendAdvanced(draft: SendDraft, advanced: boolean): SendDraft {
  const operation = resolveOperation(draft.fromKind, draft.toKind)
  if (!advanced || operation == null || draft.advancedRoutes[operation]) return {...draft, advanced}
  return {
    ...draft,
    advanced,
    advancedRoutes: {
      ...draft.advancedRoutes,
      [operation]: {
        recipients: [{id: 'first', address: draft.toValue, amount: draft.amount}],
        subtractFee: false,
        feeRecipientId: null,
      },
    },
  }
}

export function resetCurrentSendRoute(draft: SendDraft): SendDraft {
  const operation = resolveOperation(draft.fromKind, draft.toKind)
  const advancedRoutes = {...draft.advancedRoutes}
  if (draft.advanced && operation != null) delete advancedRoutes[operation]
  return {...draft, toValue: '', amount: '', acked: false, coinControl: automaticCoinControl(), advancedRoutes}
}
