import { useState } from 'react'
import { Text } from '@renderer/components/dash-ui-kit-extended'
import { RefreshIcon } from '@renderer/components/dash-ui-kit-extended/icons'
import { RETRY_LABEL, RETRY_PENDING_LABEL } from '@renderer/constants/retryButton'
import type { RetryButtonProps } from '@renderer/types/RetryButton'

export default function RetryButton({
  onRetry,
  label = RETRY_LABEL,
  pendingLabel = RETRY_PENDING_LABEL,
  iconOnly = false,
  disabled = false,
  className = '',
}: RetryButtonProps): React.JSX.Element {
  const [pending, setPending] = useState(false)
  const currentLabel = pending ? pendingLabel : label

  const handleClick = async (): Promise<void> => {
    setPending(true)
    try {
      await onRetry()
    } finally {
      setPending(false)
    }
  }

  return (
    <button
      type={"button"}
      onClick={() => { void handleClick() }}
      disabled={disabled || pending}
      aria-label={iconOnly ? currentLabel : undefined}
      title={iconOnly ? label : undefined}
      className={`inline-flex shrink-0 cursor-pointer items-center text-dash-brand transition-opacity enabled:hover:opacity-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-brand/40 disabled:cursor-default disabled:opacity-50 dark:text-dash-mint dark:focus-visible:ring-dash-mint/40 ${iconOnly ? 'size-5 justify-center rounded-[.3125rem] dash-block-5' : 'gap-1 self-start rounded-md'} ${className}`}
    >
      <RefreshIcon size={12} color={"currentColor"} className={pending ? 'animate-spin' : ''} />
      {!iconOnly && (
        <Text size={12} weight={"bold"} color={"blue-mint"}>
          {currentLabel}
        </Text>
      )}
    </button>
  )
}
