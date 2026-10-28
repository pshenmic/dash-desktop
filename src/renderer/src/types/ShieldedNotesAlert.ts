export interface ShieldedNotesAlertProps {
  walletId: string | null | undefined
  onSync: () => void
  syncing?: boolean
  required?: boolean
}
