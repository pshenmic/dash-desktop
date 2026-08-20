import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@renderer/contexts/AuthContext'
import { Text } from '@renderer/components/dash-ui-kit-enxtended'
import { WalletSyncPhase, WalletSyncStatus } from '@renderer/api/types'
import { SyncProgressPhaseInfo } from '@renderer/types/connection'
import { SYNC_PROGRESS_COMPLETE_HOLD_MS, SYNC_PROGRESS_FADE_MS } from '@renderer/constants/connection'

function safeRatio(current: number, total: number): number {
  if (total <= 0) return 0
  return Math.max(0, Math.min(1, current / total))
}

function describePhase(sync: WalletSyncStatus): SyncProgressPhaseInfo {
  const { phase, tipHeight, estimatedChainHeight, cfheadersHeight, cfilterScanHeight } = sync

  switch (phase) {
    case WalletSyncPhase.Stopped:
      return { label: 'Sync stopped', progress: 0, current: 0, total: estimatedChainHeight }
    case WalletSyncPhase.Idle:
      return { label: 'Waiting to Synchronize Wallet Data', progress: 0, current: 0, total: estimatedChainHeight }
    case WalletSyncPhase.Connecting:
      return { label: 'Connecting to Peers', progress: 0.02, current: 0, total: estimatedChainHeight }
    case WalletSyncPhase.SyncingHeaders:
      return {
        label: 'Synchronizing Wallet Data',
        progress: safeRatio(tipHeight, estimatedChainHeight) * 0.30,
        current: tipHeight,
        total: estimatedChainHeight,
      }
    case WalletSyncPhase.SyncedHeaders:
      return { label: 'Synchronizing Wallet Data', progress: 0.30, current: tipHeight, total: tipHeight }
    case WalletSyncPhase.SyncingCfcheckpt:
      return { label: 'Synchronizing Wallet Data', progress: 0.33, current: cfilterScanHeight, total: tipHeight }
    case WalletSyncPhase.SyncingCfheaders:
      return {
        label: 'Synchronizing Wallet Data',
        progress: 0.33 + safeRatio(cfheadersHeight, tipHeight) * 0.37,
        current: cfheadersHeight,
        total: tipHeight,
      }
    case WalletSyncPhase.SyncingCfilters:
      return {
        label: 'Synchronizing Wallet Data',
        progress: 0.70 + safeRatio(cfilterScanHeight, tipHeight) * 0.30,
        current: cfilterScanHeight,
        total: tipHeight,
      }
    case WalletSyncPhase.Synced:
      return { label: 'Wallet Data Synchronized', progress: 1, current: tipHeight, total: tipHeight }
  }
}

export default function SyncProgressBar(): React.JSX.Element {
  const { status } = useAuth()
  const sync = status?.walletSync
  const phase = sync?.phase ?? WalletSyncPhase.Stopped
  const info = useMemo<SyncProgressPhaseInfo>(
    () => sync
      ? describePhase(sync)
      : { label: 'Sync stopped', progress: 0, current: 0, total: 0 },
    [sync],
  )
  const lastWalletId = useRef(sync?.walletId ?? null)
  const lastCfilterInfo = useRef<SyncProgressPhaseInfo | null>(null)

  if (lastWalletId.current !== (sync?.walletId ?? null)) {
    lastWalletId.current = sync?.walletId ?? null
    lastCfilterInfo.current = null
  }

  if (phase === WalletSyncPhase.SyncingCfilters && info.current > 0) {
    lastCfilterInfo.current = info
  }

  const displayInfo = (
    (phase === WalletSyncPhase.SyncingCfilters || phase === WalletSyncPhase.Synced)
    && info.current === 0
    && lastCfilterInfo.current !== null
  )
    ? {
        ...info,
        progress: phase === WalletSyncPhase.Synced ? 1 : lastCfilterInfo.current.progress,
        current: lastCfilterInfo.current.current,
        total: lastCfilterInfo.current.total,
      }
    : info

  const isComplete = phase === WalletSyncPhase.Synced
  const [visible, setVisible] = useState(!isComplete)
  const [fading, setFading] = useState(false)

  useEffect(() => {
    if (!isComplete) {
      setVisible(true)
      setFading(false)
      return
    }
    if (!visible) return

    const fadeTimer = setTimeout(() => setFading(true), SYNC_PROGRESS_COMPLETE_HOLD_MS)
    const hideTimer = setTimeout(
      () => setVisible(false),
      SYNC_PROGRESS_COMPLETE_HOLD_MS + SYNC_PROGRESS_FADE_MS,
    )

    return () => {
      clearTimeout(fadeTimer)
      clearTimeout(hideTimer)
    }
  }, [isComplete, visible])

  if (!visible) return <></>

  const percent = Math.round(displayInfo.progress * 100)
  const isIndeterminate = phase === WalletSyncPhase.Connecting
    || phase === WalletSyncPhase.SyncedHeaders
    || phase === WalletSyncPhase.SyncingCfcheckpt
  const fillClass = sync?.lastError ? 'bg-red-500' : 'bg-dash-brand dark:bg-dash-mint'

  return (
    <div
      className={`
        fixed bottom-6 left-[calc(16.125rem+3rem)] right-12 z-40 translate-x-3
        select-none rounded-[1.5rem]
        border border-dash-primary-dark-blue/12 dark:border-white/12
        bg-white/95 dark:bg-[#315c96]/95 backdrop-blur-xl
        px-6 py-4
        shadow-[0_16px_48px_rgba(12,28,51,0.2)]
        transition-opacity duration-300 ease-out
        ${fading ? 'opacity-0' : 'opacity-100'}
      `}
    >
      <div className="mb-3 flex items-center justify-between gap-6">
        <Text size={16} weight="medium" color="brand">
          {displayInfo.label} - <span className="opacity-[.48]">{percent}%</span>
        </Text>
        <Text size={16} weight="medium" color="brand" className="shrink-0 tabular-nums">
          {displayInfo.current.toLocaleString('en-US')}
          <span className="opacity-40"> / {displayInfo.total.toLocaleString('en-US')}</span>
        </Text>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-dash-primary-dark-blue/10 dark:bg-dash-mint/20">
        <div
          className={`
            relative h-full overflow-hidden rounded-full ${fillClass}
            transition-[width] duration-1000 ease-linear
          `}
          style={{ width: `${percent}%` }}
        >
          {isIndeterminate && (
            <div
              className="absolute inset-0 sync-shimmer"
              style={{
                background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.45) 50%, transparent 100%)',
              }}
            />
          )}
        </div>
      </div>

      {sync?.lastError && (
        <Text as="div" size={10} weight="medium" color="red" className="mt-2">
          {sync.lastError}
        </Text>
      )}
    </div>
  )
}
