import { DestinationKind } from '../enums/DestinationKind'
import { SourceKind } from '../enums/SourceKind'
import type { SendDraft } from '../types/SendDraft'
import { initialSpecificSourcePreferences } from './specificSource'

const sendDrafts = new Map<string, SendDraft>()

export function createSendDraft(from: string | null = null, to: string | null = null): SendDraft {
  return {
    fromKind: Object.values(SourceKind).some(kind => kind === from) ? from as SourceKind : SourceKind.Core,
    toKind: Object.values(DestinationKind).some(kind => kind === to) ? to as DestinationKind : DestinationKind.CoreAddress,
    fromAddress: '',
    fromIdentity: '',
    toValue: '',
    amount: '',
    acked: false,
    specificSourcePreferences: initialSpecificSourcePreferences(),
  }
}

export function getOrCreateSendDraft(walletId: string | null, from: string | null, to: string | null): SendDraft {
  if (walletId == null) return createSendDraft(from, to)
  const existing = sendDrafts.get(walletId)
  if (existing != null) return existing
  const draft = createSendDraft(from, to)
  sendDrafts.set(walletId, draft)
  return draft
}

export function saveSendDraft(walletId: string, draft: SendDraft): void {
  sendDrafts.set(walletId, draft)
}

export function clearSendDraft(walletId: string): void {
  sendDrafts.delete(walletId)
}
