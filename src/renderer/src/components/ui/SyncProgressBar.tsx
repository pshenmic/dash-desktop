import {useMemo} from 'react'
import {useAuth} from '@renderer/contexts/AuthContext'
import {Text} from '@renderer/components/dash-ui-kit-enxtended'
import {WalletSyncPhase, WalletSyncStatus} from '@renderer/api/types'
import {SyncProgressPhaseInfo} from '@renderer/types/connection'
import {formatSyncEta, isWalletSyncInactive} from '@renderer/utils/walletSync'
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

export default function SyncProgressBar(): React.JSX.Element {
  const {status} = useAuth()
  const sync = status?.walletSync
  const phase = sync?.phase ?? WalletSyncPhase.Stopped
  const info = useMemo<SyncProgressPhaseInfo>(
    () => sync
      ? describePhase(sync)
      : {label: 'Sync stopped', caption: 'No sync running', progress: 0, current: 0, total: 0},
    [sync],
  )
  const percent = Number((info.progress * 100).toFixed(2))
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

  return (
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
        aria-describedby="sync-progress-tooltip"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        tabIndex={0}
      >
        <Text size={12} weight="medium" color="brand" className="whitespace-nowrap">
          <span className="opacity-50">Synchronized Progress: </span><span className="font-bold">{percent.toFixed(2)}%</span>
        </Text>
        <SyncProgressTooltip sync={sync} phase={phase} info={info} percent={percent} />
      </div>
      <Text size={12} weight="medium" color="brand" className="whitespace-nowrap text-right tabular-nums">
        <span className="opacity-50">Time Remaining: </span><span className="font-bold">{formatSyncEta(sync?.phaseEtaMs)}</span>
      </Text>
    </div>
  )
}
