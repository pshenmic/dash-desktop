import React, { useMemo } from 'react'
import { useAuth } from '@renderer/contexts/AuthContext'
import { Text } from '@renderer/components/dash-ui-kit-enxtended'
import { WalletSyncPhase, WalletSyncStatus } from '@renderer/api/types'

interface PhaseInfo {
  label: string
  progress: number
  caption: string
}

function safeRatio(num: number, denom: number): number {
  if (!denom || denom <= 0) return 0
  return Math.max(0, Math.min(1, num / denom))
}

function describePhase(s: WalletSyncStatus): PhaseInfo {
  const { phase, tipHeight, estimatedChainHeight, cfheadersHeight, cfilterScanHeight } = s
  switch (phase) {
    case 'stopped':
      return { label: 'Sync stopped', progress: 0, caption: 'No sync running' }
    case 'idle':
      return { label: 'Idle', progress: 0, caption: 'Waiting to start' }
    case 'connecting':
      return { label: 'Connecting', progress: 0.02, caption: 'Discovering peers' }
    case 'syncing-headers':
      return {
        label: 'Syncing headers',
        progress: safeRatio(tipHeight, estimatedChainHeight) * 0.30,
        caption: `${tipHeight.toLocaleString()} / ${estimatedChainHeight.toLocaleString()} blocks`,
      }
    case 'synced-headers':
      return { label: 'Headers synced', progress: 0.30, caption: 'Preparing filter sync' }
    case 'syncing-cfcheckpt':
      return { label: 'Syncing filter checkpoints', progress: 0.33, caption: 'Negotiating cfilter peers' }
    case 'syncing-cfheaders':
      return {
        label: 'Syncing filter headers',
        progress: 0.33 + safeRatio(cfheadersHeight, tipHeight) * 0.37,
        caption: `${cfheadersHeight.toLocaleString()} / ${tipHeight.toLocaleString()}`,
      }
    case 'syncing-cfilters':
      return {
        label: 'Scanning filters',
        progress: 0.70 + safeRatio(cfilterScanHeight, tipHeight) * 0.30,
        caption: `${cfilterScanHeight.toLocaleString()} / ${tipHeight.toLocaleString()}`,
      }
    case 'synced':
      return { label: 'Synced', progress: 1, caption: `Chain tip at ${tipHeight.toLocaleString()}` }
  }
}

function formatEta(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms) || ms <= 0) return '—'
  const totalSec = Math.round(ms / 1000)
  if (totalSec < 60) return `${totalSec}s`
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  if (min < 60) return `${min}m ${sec}s`
  const hr = Math.floor(min / 60)
  return `${hr}h ${min % 60}m`
}

interface RowProps {
  label: string
  value: React.ReactNode
}

function Row({ label, value }: RowProps): React.JSX.Element {
  return (
    <>
      <Text size={10} weight="medium" color="brand" opacity={50}>{label}</Text>
      <Text size={10} weight="medium" color="brand">{value}</Text>
    </>
  )
}

export default function SyncProgressBar(): React.JSX.Element {
  const { status } = useAuth()
  const sync = status?.walletSync

  const info = useMemo<PhaseInfo>(() => {
    if (!sync) return { label: 'Sync stopped', progress: 0, caption: 'No sync running' }
    return describePhase(sync)
  }, [sync])

  const pct = Math.round(info.progress * 100)
  const phase: WalletSyncPhase = sync?.phase ?? 'stopped'
  const isComplete = phase === 'synced'
  const isError = Boolean(sync?.lastError)
  const isActive = !isComplete && phase !== 'stopped'
  const isIndeterminate = phase === 'connecting' || phase === 'synced-headers' || phase === 'syncing-cfcheckpt'

  const fillClass = isError ? 'bg-red-500' : isComplete ? 'bg-dash-mint' : 'bg-dash-brand'

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] select-none group">
      <div className="h-1.5 w-full bg-dash-primary-dark-blue/8 dark:bg-white/8 cursor-help overflow-hidden">
        <div
          className={`
            relative h-full ${fillClass}
            transition-[width] duration-1000 ease-linear
            ${isActive ? 'shadow-[0_0_8px_var(--color-dash-brand)]' : ''}
            overflow-hidden
          `}
          style={{ width: `${pct}%` }}
        >
          {isIndeterminate && (
            <div
              className="absolute inset-0 sync-shimmer"
              style={{
                background:
                  'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.45) 50%, transparent 100%)',
              }}
            />
          )}
        </div>
      </div>

      <div
        className={`
          hidden group-hover:block
          absolute z-50 left-1/2 top-full mt-2 -translate-x-1/2
          min-w-[20rem] max-w-[24rem]
          rounded-[.9375rem]
          dash-card-base dash-black-border
          shadow-[0_0_32px_0_rgba(0,0,0,0.12)]
          dark:backdrop-blur-xl
          px-4 py-3
        `}
      >
        <div className="flex flex-col gap-[.125rem] mb-2">
          <Text size={14} weight="medium" color="brand">
            {info.label}{isComplete ? '' : ` — ${pct}%`}
          </Text>
          <Text size={10} weight="medium" color="brand" opacity={50}>
            {info.caption}
          </Text>
        </div>

        <div className="grid grid-cols-2 gap-x-3 gap-y-1 mb-3">
          <Row
            label="Peers"
            value={(
              <>
                {sync?.peerCount ?? 0}
                {sync && sync.filterCapablePeerCount !== sync.peerCount
                  ? ` (${sync.filterCapablePeerCount} filter-capable)`
                  : ''}
              </>
            )}
          />
          <Row
            label="Chain tip"
            value={`${(sync?.tipHeight ?? 0).toLocaleString()} / ${(sync?.estimatedChainHeight ?? 0).toLocaleString()}`}
          />
          {phase === 'syncing-cfheaders' && (
            <Row label="Filter headers" value={(sync?.cfheadersHeight ?? 0).toLocaleString()} />
          )}
          {phase === 'syncing-cfilters' && (
            <Row label="Scanned filters" value={(sync?.cfilterScanHeight ?? 0).toLocaleString()} />
          )}
          {sync?.matchedBlocksPending ? (
            <Row label="Pending blocks" value={sync.matchedBlocksPending} />
          ) : null}
          <Row label="ETA" value={formatEta(sync?.phaseEtaMs)} />
        </div>

        {isError && (
          <div className="mb-2">
            <Text size={10} weight="medium" color="red">{sync?.lastError}</Text>
          </div>
        )}

        <Text size={10} weight="normal" color="brand" opacity={50}>
          Local node downloads block headers and compact filters to scan your wallet without
          trusting a third party. While syncing, balances and transactions are served by the
          Dash Insight API as a fallback. When sync completes, the wallet switches to local
          P2P data automatically. Use the Start / Stop / Restart button in the header to
          control sync manually.
        </Text>
      </div>
    </div>
  )
}
