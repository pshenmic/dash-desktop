import { useState } from 'react'
import { Button, CheckIcon, Text } from '@renderer/components/dash-ui-kit-extended'
import { SettingsRow, SwitchControl } from '@renderer/components/pages/connectionSettings/SettingsControls'
import Spinner from '@renderer/components/ui/Spinner'
import { authTexts, WALLET_CREATE_SLOW_NOTICE_MS } from '@renderer/constants'
import {
  WALLET_CONNECTION_MODE_DETAILS,
  WALLET_CONNECTION_MODES,
} from '@renderer/constants/connection'
import { useDelayedVisible } from '@renderer/hooks/useDelayedVisible'
import type { ConnectionModeStepProps } from '@renderer/types/auth'

export default function ConnectionModeStep({
  mode,
  backgroundSyncEnabled,
  actionLabel,
  loadingNotice,
  onModeChange,
  onBackgroundSyncChange,
  onConfirm,
}: ConnectionModeStepProps): React.JSX.Element {
  const [loading, setLoading] = useState(false)
  const showSlowNotice = useDelayedVisible(loading, WALLET_CREATE_SLOW_NOTICE_MS)
  const texts = authTexts.connectionMode

  const handleConfirm = async (): Promise<void> => {
    if (loading) return
    setLoading(true)
    try {
      await onConfirm()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex w-full flex-col gap-5">
      <div role="radiogroup" aria-label="Wallet connection mode" className="grid grid-cols-2 gap-4">
        {WALLET_CONNECTION_MODES.map((connectionMode) => {
          const details = WALLET_CONNECTION_MODE_DETAILS[connectionMode]
          const selected = connectionMode === mode

          return (
            <button
              key={connectionMode}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={loading}
              onClick={() => onModeChange(connectionMode)}
              className={`
                relative flex cursor-pointer flex-col items-start rounded-[.9375rem] border p-5 text-left transition-colors
                disabled:cursor-wait disabled:opacity-50
                ${selected
                  ? 'border-dash-brand bg-dash-brand/6 dark:border-dash-mint dark:bg-dash-mint/6'
                  : 'border-dash-primary-dark-blue/20 dash-block hover:border-dash-brand/50 dark:border-white/20 dark:hover:border-dash-mint/50'}
              `}
            >
              <div className="flex w-full items-start justify-between gap-3">
                <div className="flex flex-col items-start gap-1">
                  <Text size={12} weight="bold" color="blue-mint" className="uppercase tracking-[0.08em]">
                    {details.highlight}
                  </Text>
                  <Text as="h2" size={20} weight="bold" color="brand">
                    {details.title}
                  </Text>
                </div>
                <span
                  className={`
                    flex size-6 shrink-0 items-center justify-center rounded-full border
                    ${selected
                      ? 'border-dash-brand bg-dash-brand text-white dark:border-dash-mint dark:bg-dash-mint dark:text-dash-primary-dark-blue'
                      : 'border-dash-primary-dark-blue/25 dark:border-white/25'}
                  `}
                >
                  {selected && <CheckIcon size={14} color="currentColor" className="[&_circle]:hidden" />}
                </span>
              </div>
              <Text size={14} weight="medium" color="brand" opacity={50} className="mt-4 leading-[150%]">
                {details.description}
              </Text>
            </button>
          )
        })}
      </div>

      {mode === 'rpc' && (
        <SettingsRow label={texts.backgroundSyncTitle}>
          <SwitchControl
            checked={backgroundSyncEnabled}
            label={texts.backgroundSyncTitle}
            onChange={onBackgroundSyncChange}
          />
        </SettingsRow>
      )}

      <Button
        type="button"
        colorScheme="primary"
        size="md"
        className="rounded-[.9375rem] p-4.5"
        disabled={loading}
        onClick={() => { void handleConfirm() }}
      >
        {loading ? <Spinner size={20} className="mx-auto" /> : actionLabel}
      </Button>

      {showSlowNotice && (
        <Text as="p" size={14} weight="medium" color="brand" opacity={50} className="text-center">
          {loadingNotice}
        </Text>
      )}
    </div>
  )
}
