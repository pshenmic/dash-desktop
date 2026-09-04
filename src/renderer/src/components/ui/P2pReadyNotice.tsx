import { useState } from 'react'
import { Button, CheckIcon, Text } from '@renderer/components/dash-ui-kit-enxtended'
import { P2P_READY_PROMPT } from '@renderer/constants/connection'
import { useAuth } from '@renderer/contexts/AuthContext'
import { useConnectionModeContext } from '@renderer/contexts/ConnectionModeContext'
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
    <div
      role="status"
      aria-live="polite"
      className="mx-12 mb-4 flex flex-wrap items-center justify-between gap-4 rounded-[.875rem] border border-dash-brand/20 bg-dash-brand/6 px-4 py-3 dark:border-dash-mint/20 dark:bg-dash-mint/6"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-dash-brand text-white dark:bg-dash-mint dark:text-dash-primary-dark-blue">
          <CheckIcon size={18} color="currentColor" className="[&_circle]:hidden" />
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <Text size={14} weight="bold" color="brand">
            {P2P_READY_PROMPT.title}
          </Text>
          <Text size={12} weight="medium" color="brand" opacity={50}>
            {P2P_READY_PROMPT.description}
          </Text>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleDismiss}
          className="cursor-pointer rounded-[.625rem] px-3 py-2 text-xs font-bold text-dash-primary-dark-blue/55 transition-colors hover:text-dash-primary-dark-blue dark:text-white/55 dark:hover:text-white"
        >
          {P2P_READY_PROMPT.dismiss}
        </button>
        <Button
          type="button"
          size="sm"
          colorScheme="primary"
          onClick={handleSwitch}
          className="min-h-0! rounded-[.625rem] px-3 py-2 text-xs!"
        >
          {P2P_READY_PROMPT.confirm}
        </Button>
      </div>
    </div>
  )
}
