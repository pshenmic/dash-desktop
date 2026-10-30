import { ExclamationIcon } from '@renderer/components/dash-ui-kit-extended/icons'
import Alert from '@renderer/components/ui/Alert'
import RetryButton from '@renderer/components/ui/RetryButton'
import { DATA_REFRESH_STALE_MESSAGE } from '@renderer/constants/connection'
import { AlertTone } from '@renderer/enums/AlertTone'
import { useAsyncRefreshFailures } from '@renderer/hooks/useAsyncWithCache'

export default function DataRefreshNotice(): React.JSX.Element | null {
  const { failedCount, retryFailed } = useAsyncRefreshFailures()

  if (failedCount === 0) return null

  return (
    <Alert
      tone={AlertTone.Warning}
      icon={<ExclamationIcon size={16} color={"currentColor"} />}
      title={DATA_REFRESH_STALE_MESSAGE}
      actions={<RetryButton onRetry={retryFailed} />}
      className={"mx-12 mb-4"}
    />
  )
}
