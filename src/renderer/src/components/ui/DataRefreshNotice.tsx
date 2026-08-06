import { useState } from 'react'
import { Text } from '@renderer/components/dash-ui-kit-enxtended'
import { RefreshIcon } from '@renderer/components/dash-ui-kit-enxtended/icons'
import { useAsyncRefreshFailures } from '@renderer/hooks/useAsyncWithCache'

export default function DataRefreshNotice(): React.JSX.Element | null {
  const { failedCount, retryFailed } = useAsyncRefreshFailures()
  const [retrying, setRetrying] = useState(false)

  if (failedCount === 0) return null

  const handleRetry = async (): Promise<void> => {
    if (retrying) return
    setRetrying(true)
    try {
      await retryFailed()
    } finally {
      setRetrying(false)
    }
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={"mx-12 mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[.875rem] dash-block-3 px-4 py-3"}
    >
      <div className={"flex items-center gap-2.5"}>
        <span className={"size-2 shrink-0 rounded-full bg-dash-orange"} />
        <Text size={12} weight={"medium"} color={"brand"} opacity={70}>
          Some data could not be refreshed and may be out of date. Check your connection and try again.
        </Text>
      </div>
      <button
        type="button"
        onClick={() => { void handleRetry() }}
        disabled={retrying}
        className={"flex cursor-pointer items-center gap-2 rounded-[.625rem] px-3 py-1.5 text-dash-brand transition-opacity hover:opacity-75 disabled:cursor-default disabled:opacity-50 dark:text-dash-mint"}
      >
        <RefreshIcon size={14} className={retrying ? 'animate-spin' : ''} />
        <Text size={12} weight={"bold"} color={"blue-mint"}>
          {retrying ? 'Refreshing...' : 'Try again'}
        </Text>
      </button>
    </div>
  )
}
