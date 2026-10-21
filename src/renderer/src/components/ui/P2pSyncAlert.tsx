import { useState } from 'react'
import { API } from '@renderer/api'
import { Button, Text } from '@renderer/components/dash-ui-kit-enxtended'
import { ExclamationIcon } from '@renderer/components/dash-ui-kit-enxtended/icons'
import { toast } from '@renderer/components/ui/Toast'
import { P2P_SYNC_ALERT_TEXTS } from '@renderer/constants/connection'
import { useConnectionModeContext } from '@renderer/contexts/ConnectionModeContext'
import { useAuth } from '@renderer/contexts/AuthContext'
import type { P2pSyncAlertProps } from '@renderer/types/P2pSyncAlert'
import { setWalletSyncEnabled } from '@renderer/utils/connectionSettings'
import { getErrorMessage } from '@renderer/utils/error'
import { isWalletSyncInactive } from '@renderer/utils/walletSync'

export default function P2pSyncAlert({
  description = P2P_SYNC_ALERT_TEXTS.coreFundsDescription,
  className = '',
}: P2pSyncAlertProps): React.JSX.Element | null {
  const { showSyncWarning, setDesired } = useConnectionModeContext()
  const { status } = useAuth()
  const walletId = status?.selectedWalletId ?? null
  const paused = isWalletSyncInactive(status?.walletSync.phase)
  const [resuming, setResuming] = useState(false)
  if (resuming && !paused) setResuming(false)
  if (!showSyncWarning) return null

  const handleResume = async (): Promise<void> => {
    if (walletId === null || resuming) return
    setResuming(true)
    try {
      await API.startWalletSync(walletId)
      setWalletSyncEnabled(true)
    } catch (err) {
      setResuming(false)
      console.error('resume wallet sync failed', err)
      toast.error(`${P2P_SYNC_ALERT_TEXTS.resumeFailed} ${getErrorMessage(err)}`)
    }
  }

  return (
    <div className={`flex items-center justify-between gap-4 p-[.875rem] rounded-[.9375rem] border border-dash-orange/40 bg-dash-orange/8 dark:bg-dash-orange/10 ${className}`}>
      <div className={"flex flex-col gap-[.375rem]"}>
        <div className={"flex items-center gap-2"}>
          <ExclamationIcon size={16} className={"text-dash-orange"} />
          <Text size={14} weight={"extrabold"} className={"text-dash-orange!"}>
            {paused ? P2P_SYNC_ALERT_TEXTS.pausedTitle : P2P_SYNC_ALERT_TEXTS.waitingTitle}
          </Text>
        </div>
        <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"leading-[130%]"}>
          {description}
        </Text>
      </div>
      <div className={"flex shrink-0 items-center gap-2"}>
        {paused && (
          <Button
            type={"button"}
            onClick={() => { void handleResume() }}
            disabled={walletId === null || resuming}
            variant={"solid"}
            colorScheme={"primary"}
            size={"sm"}
            className={"min-h-0! py-2! rounded-[.75rem]"}
          >
            {resuming ? P2P_SYNC_ALERT_TEXTS.resuming : P2P_SYNC_ALERT_TEXTS.resume}
          </Button>
        )}
        <Button
          type={"button"}
          onClick={() => setDesired('rpc')}
          variant={"solid"}
          colorScheme={"lightBlue-mint"}
          size={"sm"}
          className={"min-h-0! py-2! rounded-[.75rem]"}
        >
          {P2P_SYNC_ALERT_TEXTS.useRpc}
        </Button>
      </div>
    </div>
  )
}
