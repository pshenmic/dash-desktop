export interface DismissAssetLockFundingModalProps {
  isOpen: boolean
  busy: boolean
  onClose: () => void
  onConfirm: () => Promise<void>
}
