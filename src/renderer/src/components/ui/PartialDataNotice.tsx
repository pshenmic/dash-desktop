import RetryButton from '@renderer/components/ui/RetryButton'
import StatusChip from '@renderer/components/ui/StatusChip'
import { PARTIAL_DATA_NOTICE } from '@renderer/constants/partialDataNotice'
import { useConnectionModeContext } from '@renderer/contexts/ConnectionModeContext'
import { refreshActiveAsyncCaches } from '@renderer/hooks/useAsyncWithCache'
import type { PartialDataNoticeProps } from '@renderer/types/PartialDataNotice'

export default function PartialDataNotice({ platformFailed = false }: PartialDataNoticeProps): React.JSX.Element | null {
  const { showSyncWarning } = useConnectionModeContext()

  if (!showSyncWarning && !platformFailed) return null

  return (
    <div className={"flex flex-wrap items-center gap-2"}>
      {showSyncWarning && <StatusChip>{PARTIAL_DATA_NOTICE.p2pSync}</StatusChip>}
      {platformFailed && (
        <StatusChip action={<RetryButton onRetry={refreshActiveAsyncCaches} />}>
          {PARTIAL_DATA_NOTICE.platformHistory}
        </StatusChip>
      )}
    </div>
  )
}
