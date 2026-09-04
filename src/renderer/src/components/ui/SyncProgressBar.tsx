import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useAuth } from '@renderer/contexts/AuthContext'
import { Text } from '@renderer/components/dash-ui-kit-enxtended'
import { WalletSyncPhase, WalletSyncStatus } from '@renderer/api/types'
import type { SyncProgressBarProps, SyncProgressPhaseInfo } from '@renderer/types/connection'
import {
  SYNC_PROGRESS_COMPLETE_HOLD_MS,
  SYNC_PROGRESS_FADE_MS,
  WALLET_SYNC_PHASE_LABELS,
} from '@renderer/constants/connection'
import { formatSyncEta, isWalletSyncInactive } from '@renderer/utils/walletSync'
import SyncProgressTooltip from './SyncProgressTooltip'

function safeRatio(current: number, total: number): number {
  if (total <= 0) return 0
  return Math.max(0, Math.min(1, current / total))
}

function describePhase(sync: WalletSyncStatus): SyncProgressPhaseInfo {
  const {phase, tipHeight, estimatedChainHeight, cfheadersHeight, cfilterScanHeight} = sync

  switch (phase) {
    case WalletSyncPhase.Stopped:
      return {label: 'Sync stopped', caption: 'No sync running', progress: 0, current: 0, total: estimatedChainHeight}
    case WalletSyncPhase.Idle:
      return {label: 'Waiting to Synchronize Wallet Data', caption: 'Waiting to start', progress: 0, current: 0, total: estimatedChainHeight}
    case WalletSyncPhase.Connecting:
      return {label: 'Connecting to Peers', caption: 'Discovering peers', progress: 0.02, current: 0, total: estimatedChainHeight}
    case WalletSyncPhase.SyncingHeaders:
      return {
        label: 'Syncing Wallet Data',
        caption: `${tipHeight.toLocaleString('en-US')} / ${estimatedChainHeight.toLocaleString('en-US')} blocks`,
        progress: safeRatio(tipHeight, estimatedChainHeight) * 0.30,
        current: tipHeight,
        total: estimatedChainHeight,
      }
    case WalletSyncPhase.SyncedHeaders:
      return {label: 'Syncing Wallet Data', caption: 'Preparing filter sync', progress: 0.30, current: tipHeight, total: tipHeight}
    case WalletSyncPhase.SyncingCfcheckpt:
      return {label: 'Syncing Wallet Data', caption: 'Negotiating compact-filter peers', progress: 0.33, current: cfilterScanHeight, total: tipHeight}
    case WalletSyncPhase.SyncingCfheaders:
      return {
        label: 'Syncing Wallet Data',
        caption: `${cfheadersHeight.toLocaleString('en-US')} / ${tipHeight.toLocaleString('en-US')} filter headers`,
        progress: 0.33 + safeRatio(cfheadersHeight, tipHeight) * 0.37,
        current: cfheadersHeight,
        total: tipHeight,
      }
    case WalletSyncPhase.SyncingCfilters:
      return {
        label: 'Syncing Wallet Data',
        caption: `${cfilterScanHeight.toLocaleString('en-US')} / ${tipHeight.toLocaleString('en-US')} filters`,
        progress: 0.70 + safeRatio(cfilterScanHeight, tipHeight) * 0.30,
        current: cfilterScanHeight,
        total: tipHeight,
      }
    case WalletSyncPhase.Synced:
      return {label: 'Wallet Data Synced', caption: `Chain tip at ${tipHeight.toLocaleString('en-US')}`, progress: 1, current: tipHeight, total: tipHeight}
  }
}

export default function SyncProgressBar({ variant = 'floating' }: SyncProgressBarProps): React.JSX.Element {
  const { status } = useAuth()
  const sync = status?.walletSync
  const phase = sync?.phase ?? WalletSyncPhase.Stopped
  const tooltipId = useId()
  const info = useMemo<SyncProgressPhaseInfo>(
    () => sync
      ? describePhase(sync)
      : { label: 'Sync stopped', caption: 'No sync running', progress: 0, current: 0, total: 0 },
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

  const compactPercent = Number((info.progress * 100).toFixed(2))
  const syncInactive = isWalletSyncInactive(phase)
  const hasError = Boolean(sync?.lastError)
  const isSynced = phase === WalletSyncPhase.Synced && !hasError
  const inProgress = !syncInactive && !isSynced && !hasError
  const statusLabel = hasError
    ? 'Error'
    : isSynced
      ? 'Connected'
      : syncInactive
        ? 'Stopped'
        : 'In Progress'
  const statusClassName = hasError
    ? 'text-red-700 dark:text-red-400'
    : isSynced
      ? 'text-emerald-600 dark:text-dash-mint'
      : ''

  if (variant === 'compact') return (
    <div className="relative grid h-12 grid-cols-[1fr_1.25fr_1fr] items-center rounded-[.9375rem] border border-dash-primary-dark-blue/12 bg-dash-primary-dark-blue/3 px-[.875rem] dark:border-white/12 dark:bg-white/3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-dash-primary-dark-blue/5 dark:bg-white/5" aria-hidden="true">
          {isSynced ? (
            <span className="size-3 rounded-full bg-emerald-500 shadow-[0_0_6px_currentColor] text-emerald-500 dark:bg-dash-mint dark:text-dash-mint" />
          ) : (
            <span className={`size-3 rounded-full border border-current border-t-transparent ${hasError ? 'text-red-700 dark:text-red-400' : 'dash-text-default'} ${inProgress ? 'animate-spin' : ''}`} />
          )}
        </span>
        <Text size={12} weight="medium" color="brand" className="whitespace-nowrap">
          <span className="opacity-50">Status: </span><span className={`font-bold ${statusClassName}`}>{statusLabel}</span>
        </Text>
      </div>
      <div
        className="group cursor-help text-center tabular-nums outline-none"
        role="progressbar"
        aria-label="Synchronized progress"
        aria-describedby={tooltipId}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={compactPercent}
        tabIndex={0}
      >
        <Text size={12} weight="medium" color="brand" className="whitespace-nowrap">
          <span className="opacity-50">Synchronized Progress: </span><span className="font-bold">{compactPercent.toFixed(2)}%</span>
        </Text>
        <SyncProgressTooltip
          sync={sync}
          phase={phase}
          info={info}
          percent={compactPercent}
          tooltipId={tooltipId}
          variant="compact"
        />
      </div>
      <Text size={12} weight="medium" color="brand" className="whitespace-nowrap text-right tabular-nums">
        <span className="opacity-50">Time Remaining: </span><span className="font-bold">{formatSyncEta(sync?.phaseEtaMs)}</span>
      </Text>
    </div>
  )

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
        group select-none rounded-[1.25rem] outline-none
        border border-dash-primary-dark-blue/12 dark:border-white/12
        bg-white/95 dark:bg-[#315c96]/95 backdrop-blur-xl
        px-5 py-3
        cursor-help
        shadow-[0_16px_48px_rgba(12,28,51,0.2)]
        transition-opacity duration-300 ease-out
        ${fading ? 'opacity-0' : 'opacity-100'}
      `}
      aria-describedby={tooltipId}
      tabIndex={0}
    >
      <div className="mb-2 flex items-center justify-between gap-5">
        <Text size={14} weight="medium" color="brand">
          {displayInfo.label} - <span className="opacity-[.48]">{percent}%</span>
        </Text>
        <Text size={14} weight="medium" color="brand" className="shrink-0 tabular-nums">
          {displayInfo.current.toLocaleString('en-US')}
          <span className="opacity-40"> / {displayInfo.total.toLocaleString('en-US')}</span>
        </Text>
      </div>

      <div
        className="relative h-1 w-full rounded-full bg-dash-primary-dark-blue/10 dark:bg-dash-mint/20"
        role="progressbar"
        aria-label={WALLET_SYNC_PHASE_LABELS[phase]}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <div className="h-full w-full overflow-hidden rounded-full">
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

        <SyncProgressTooltip
          sync={sync}
          phase={phase}
          info={displayInfo}
          percent={percent}
          tooltipId={tooltipId}
          variant="floating"
        />
      </div>

      {sync?.lastError && (
        <Text as="div" size={10} weight="medium" color="red" className="mt-2">
          {sync.lastError}
        </Text>
      )}
    </div>
  )
}
