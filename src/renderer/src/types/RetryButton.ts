export interface RetryButtonProps {
  onRetry: () => void | Promise<unknown>
  label?: string
  pendingLabel?: string
  iconOnly?: boolean
  disabled?: boolean
  className?: string
}
