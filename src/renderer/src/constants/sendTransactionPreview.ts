import type { PreviewRole } from '../api/types'
import type { SendPreviewState } from '../types/SendTransactionPreview'

export const SEND_PREVIEW_INITIAL_STATE: SendPreviewState = {
  requestId: null,
  loading: false,
  error: null,
  data: null,
}

export const SEND_PREVIEW_ROLE_LABELS: Partial<Record<PreviewRole, string>> = {
  feeInput: 'Pays fee',
  change: 'Change',
  credit: 'Asset lock credit',
}
