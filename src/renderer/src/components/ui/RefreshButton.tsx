import React, { useEffect, useRef, useState } from 'react'
import { RefreshIcon } from '@renderer/components/dash-ui-kit-extended/icons'
import { useRipple } from '@renderer/hooks/useRipple'
import { useLocation } from 'react-router-dom'
import { refreshActiveAsyncCaches, useAsyncRefreshFailures } from '@renderer/hooks/useAsyncWithCache'
import { refreshDashPay } from '@renderer/hooks/useDashPayRefresh'
import { useAuth } from '@renderer/contexts/AuthContext'
import { DASHPAY_ROUTES } from '@renderer/constants/dashPay'
import { toast } from '@renderer/components/ui/Toast'
import { REFRESH_DATA_LABEL, REFRESH_FAILED_MESSAGE } from '@renderer/constants/connection'

export default function RefreshButton(): React.JSX.Element {
  const [refreshing, setRefreshing] = useState(false)
  const { failedCount: noticedFailures } = useAsyncRefreshFailures()
  const unreportedFailures = useRef(0)
  const hoverNotification = useRipple()
  const { pathname } = useLocation()
  const { status } = useAuth()
  const walletId = status?.selectedWalletId ?? null
  const onDashPay = pathname.startsWith(DASHPAY_ROUTES.root)

  useEffect(() => {
    if (refreshing || unreportedFailures.current === 0) return
    if (noticedFailures === 0) toast.warning(REFRESH_FAILED_MESSAGE)
    unreportedFailures.current = 0
  }, [refreshing, noticedFailures])

  const handleClick = async (): Promise<void> => {
    if (refreshing) return
    setRefreshing(true)
    try {
      const dashPayFailures = walletId != null && onDashPay ? await refreshDashPay(walletId).then(() => 0, () => 1) : 0
      unreportedFailures.current = dashPayFailures + await refreshActiveAsyncCaches()
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
