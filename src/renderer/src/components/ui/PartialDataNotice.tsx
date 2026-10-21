import { useState } from 'react'
import { Text } from '@renderer/components/dash-ui-kit-enxtended'
import { RefreshIcon } from '@renderer/components/dash-ui-kit-enxtended/icons'
import StatusChip from '@renderer/components/ui/StatusChip'
import { PARTIAL_DATA_NOTICE } from '@renderer/constants/partialDataNotice'
import { useConnectionModeContext } from '@renderer/contexts/ConnectionModeContext'
import { refreshActiveAsyncCaches } from '@renderer/hooks/useAsyncWithCache'
import type { PartialDataNoticeProps } from '@renderer/types/PartialDataNotice'

export default function PartialDataNotice({ platformFailed = false }: PartialDataNoticeProps): React.JSX.Element | null {
  const { showSyncWarning } = useConnectionModeContext()
  const [retrying, setRetrying] = useState(false)

  if (!showSyncWarning && !platformFailed) return null

  const retry = async (): Promise<void> => {
    setRetrying(true)
    try {
      await refreshActiveAsyncCaches()
    } finally {
      setRetrying(false)
    }
  }

  return (
    <div className={"flex flex-wrap items-center gap-2"}>
      {showSyncWarning && <StatusChip>{PARTIAL_DATA_NOTICE.p2pSync}</StatusChip>}
      {platformFailed && (
        <StatusChip
          action={
            <button
              type={"button"}
              onClick={() => { void retry() }}
              disabled={retrying}
              className={"flex cursor-pointer items-center gap-1 text-dash-brand transition-opacity hover:opacity-75 disabled:cursor-default disabled:opacity-50 dark:text-dash-mint"}
            >
              <RefreshIcon size={12} color={"currentColor"} className={retrying ? 'animate-spin' : ''} />
              <Text size={12} weight={"bold"} color={"blue-mint"}>{PARTIAL_DATA_NOTICE.retry}</Text>
            </button>
          }
        >
          {PARTIAL_DATA_NOTICE.platformHistory}
        </StatusChip>
      )}
    </div>
  )
}
