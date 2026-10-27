import React, { useEffect, useRef, useState } from 'react'
import { RefreshIcon } from '@renderer/components/dash-ui-kit-extended/icons'
import { useRipple } from '@renderer/hooks/useRipple'
import { refreshActiveAsyncCaches, useAsyncRefreshFailures } from '@renderer/hooks/useAsyncWithCache'
import { toast } from '@renderer/components/ui/Toast'
import { REFRESH_DATA_LABEL, REFRESH_FAILED_MESSAGE } from '@renderer/constants/connection'

export default function RefreshButton(): React.JSX.Element {
  const [refreshing, setRefreshing] = useState(false)
  const { failedCount: noticedFailures } = useAsyncRefreshFailures()
  const unreportedFailures = useRef(0)
  const hoverNotification = useRipple()

  useEffect(() => {
    if (refreshing || unreportedFailures.current === 0) return
    if (noticedFailures === 0) toast.warning(REFRESH_FAILED_MESSAGE)
    unreportedFailures.current = 0
  }, [refreshing, noticedFailures])

  const handleClick = async (): Promise<void> => {
    if (refreshing) return
    setRefreshing(true)
    try {
      unreportedFailures.current = await refreshActiveAsyncCaches()
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <button
      onMouseEnter={hoverNotification.onMouseEnter}
      onMouseMove={hoverNotification.onMouseMove}
      onMouseLeave={hoverNotification.onMouseLeave}
      type={"button"}
      onClick={handleClick}
      disabled={refreshing}
      title={REFRESH_DATA_LABEL}
      className={`
        size-12
        overflow-hidden
        relative
        flex
        items-center
        justify-center
        cursor-pointer
        rounded-[.9375rem]
        dash-block
        dash-black-border
        focus:outline-none
        disabled:cursor-default
      `}
    >
      <RefreshIcon size={18} className={`dash-text-default ${refreshing ? 'animate-spin' : ''}`} />
    </button>
  )
}
