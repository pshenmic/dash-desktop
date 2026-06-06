import React, { useRef } from 'react'
import { API } from '@renderer/api'
import { useAuth } from '@renderer/contexts/AuthContext'
import { Text } from '@renderer/components/dash-ui-kit-enxtended'
import { WalletSyncPhase } from '@renderer/api/types'
import { SYNC_ACTION_LABELS } from '@renderer/constants/connection'

type Action = 'start' | 'stop' | 'restart'

function actionForPhase(phase: WalletSyncPhase | undefined): Action {
  switch (phase) {
    case undefined:
    case 'stopped':
    case 'idle':
      return 'start'
    case 'synced':
      return 'restart'
    default:
      return 'stop'
  }
}

interface ActionSpec {
  label: string
  glyph: React.JSX.Element
  run: (walletId: string) => Promise<unknown>
}

const ACTIONS: Record<Action, ActionSpec> = {
  start: {
    label: SYNC_ACTION_LABELS.start,
    glyph: (
      <svg width={14} height={14} viewBox="0 0 14 14" fill="none" className="dash-text-default">
        <path d="M4 2.5 L11 7 L4 11.5 Z" fill="currentColor" />
      </svg>
    ),
    run: (walletId) => API.startWalletSync(walletId),
  },
  stop: {
    label: SYNC_ACTION_LABELS.stop,
    glyph: (
      <svg width={14} height={14} viewBox="0 0 14 14" fill="none" className="dash-text-default">
        <rect x="3" y="3" width="8" height="8" rx="1" fill="currentColor" />
      </svg>
    ),
    run: () => API.stopWalletSync(),
  },
  restart: {
    label: SYNC_ACTION_LABELS.restart,
    glyph: (
      <svg width={14} height={14} viewBox="0 0 14 14" fill="none" className="dash-text-default">
        <path d="M11.5 7a4.5 4.5 0 1 1-1.32-3.18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
        <path d="M11 1.5 L11 4 L8.5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    ),
    run: async (walletId) => {
      await API.stopWalletSync()
      await API.startWalletSync(walletId)
    },
  },
}

export default function SyncControlButton(): React.JSX.Element | null {
  const { status } = useAuth()
  const phase = status?.walletSync.phase
  const walletId = status?.selectedWalletId ?? null
  const inFlight = useRef(false)

  if (walletId === null) return null

  const action = actionForPhase(phase)
  const spec = ACTIONS[action]

  const handleClick = async (): Promise<void> => {
    if (inFlight.current) return
    inFlight.current = true
    try {
      await spec.run(walletId)
    } catch (err) {
      console.error('sync control failed', err)
    } finally {
      inFlight.current = false
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      title={spec.label}
      className={`
        relative
        flex items-center gap-2 px-4 h-12
        rounded-[.9375rem]
        dash-block-3 dash-black-border
        cursor-pointer focus:outline-none
        hover:bg-dash-primary-dark-blue/5 dark:hover:bg-white/5
      `}
    >
      {spec.glyph}
      <Text size={14} weight="medium" color="brand">{spec.label}</Text>
    </button>
  )
}
