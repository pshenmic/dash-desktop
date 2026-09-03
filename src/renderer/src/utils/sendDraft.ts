import { DestinationKind } from '../enums/DestinationKind'
import { SourceKind } from '../enums/SourceKind'
import type { SendDraft } from '../types/SendDraft'

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
  }
}

export function getOrCreateSendDraft(walletId: string | null, from: string | null, to: string | null): SendDraft {
  if (walletId == null) return createSendDraft(from, to)
  const existing = sendDrafts.get(walletId)
  const fromKind = sourceKind(from)
  const toKind = destinationKind(to)
  const draft = existing == null
    ? createSendDraft(from, to)
    : {
        ...existing,
        ...(fromKind != null && {fromKind}),
        ...(toKind != null && {toKind}),
      }
  sendDrafts.set(walletId, draft)
  return draft
}

export function saveSendDraft(walletId: string, draft: SendDraft): void {
  sendDrafts.set(walletId, draft)
}

export function clearSendDraft(walletId: string): void {
  sendDrafts.delete(walletId)
}
