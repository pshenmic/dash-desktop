import { useState } from 'react'
import { API } from '@renderer/api'
import { Button } from '@renderer/components/dash-ui-kit-enxtended'
import { ExclamationIcon } from '@renderer/components/dash-ui-kit-enxtended/icons'
import Alert from '@renderer/components/ui/Alert'
import { toast } from '@renderer/components/ui/Toast'
import { P2P_SYNC_ALERT_TEXTS } from '@renderer/constants/connection'
import { useConnectionModeContext } from '@renderer/contexts/ConnectionModeContext'
import { useAuth } from '@renderer/contexts/AuthContext'
import { AlertTone } from '@renderer/enums/AlertTone'
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
    <Alert
      tone={AlertTone.Warning}
      icon={<ExclamationIcon size={16} color={"currentColor"} />}
      title={paused ? P2P_SYNC_ALERT_TEXTS.pausedTitle : P2P_SYNC_ALERT_TEXTS.waitingTitle}
      description={description}
      className={className}
      actions={
        <>
          {paused && (
            <Button
              type={"button"}
              onClick={() => { void handleResume() }}
              disabled={walletId === null || resuming}
              variant={"solid"}
              colorScheme={"primary"}
              size={"compact"}
            >
              {resuming ? P2P_SYNC_ALERT_TEXTS.resuming : P2P_SYNC_ALERT_TEXTS.resume}
            </Button>
          )}
          <Button
            type={"button"}
            onClick={() => setDesired('rpc')}
            variant={"solid"}
            colorScheme={"lightBlue-mint"}
            size={"compact"}
          >
            {P2P_SYNC_ALERT_TEXTS.useRpc}
          </Button>
        </>
      }
    />
  )
}
