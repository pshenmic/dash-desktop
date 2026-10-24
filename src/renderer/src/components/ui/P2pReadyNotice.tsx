import { useState } from 'react'
import { Button, CheckIcon } from '@renderer/components/dash-ui-kit-enxtended'
import Alert from '@renderer/components/ui/Alert'
import { P2P_READY_PROMPT } from '@renderer/constants/connection'
import { useAuth } from '@renderer/contexts/AuthContext'
import { useConnectionModeContext } from '@renderer/contexts/ConnectionModeContext'
import { AlertTone } from '@renderer/enums/AlertTone'
import {
  dismissP2pSwitchPrompt,
  isP2pSwitchPromptDismissed,
} from '@renderer/utils/connectionSettings'
import { shouldOfferP2pSwitch } from '@renderer/utils/walletSync'

export default function P2pReadyNotice(): React.JSX.Element | null {
  const { status } = useAuth()
  const { desired, setDesired } = useConnectionModeContext()
  const [hiddenWalletId, setHiddenWalletId] = useState<string | null>(null)
  const selectedWalletId = status?.selectedWalletId ?? null
  const sync = status?.walletSync
  const dismissed = selectedWalletId !== null
    && (hiddenWalletId === selectedWalletId || isP2pSwitchPromptDismissed(selectedWalletId))

  const visible = shouldOfferP2pSwitch(
    desired,
    sync?.phase,
    sync?.walletId,
    selectedWalletId,
    dismissed,
  )

  if (!visible || selectedWalletId === null) return null

  const handleSwitch = (): void => {
    setDesired('p2p')
  }

  const handleDismiss = (): void => {
    dismissP2pSwitchPrompt(selectedWalletId)
    setHiddenWalletId(selectedWalletId)
  }

  return (
    <Alert
      tone={AlertTone.Info}
      icon={<CheckIcon size={16} color="currentColor" className="[&_circle]:hidden" />}
      title={P2P_READY_PROMPT.title}
      className="mx-12 mb-4"
      actions={
        <>
          <Button type="button" size="compact" colorScheme="primary-light" onClick={handleDismiss}>
            {P2P_READY_PROMPT.dismiss}
          </Button>
          <Button type="button" size="compact" colorScheme="primary" onClick={handleSwitch}>
            {P2P_READY_PROMPT.confirm}
          </Button>
        </>
      }
    />
  )
}
