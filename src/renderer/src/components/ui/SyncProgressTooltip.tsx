import { Text } from '@renderer/components/dash-ui-kit-enxtended'
import { WALLET_SYNC_PHASE_LABELS } from '@renderer/constants/connection'
import { WalletSyncPhase } from '@renderer/api/types'
import type { SyncProgressTooltipProps } from '@renderer/types/connection'
import { formatSyncEta } from '@renderer/utils/walletSync'

export default function SyncProgressTooltip({
  sync,
  phase,
  info,
  percent,
}: SyncProgressTooltipProps): React.JSX.Element {
  const isComplete = phase === WalletSyncPhase.Synced

  return (
    <div
      id="sync-progress-tooltip"
      role="tooltip"
      className={`
        pointer-events-none absolute bottom-full left-1/2 z-50 mb-3 hidden -translate-x-1/2
        min-w-[20rem] max-w-[24rem] rounded-[.9375rem]
        border border-dash-primary-dark-blue/12 bg-white px-4 py-3
        shadow-[0_0_32px_0_rgba(0,0,0,0.12)]
        dark:border-white/12 dark:bg-[#315c96]
        group-hover:block group-focus:block
      `}
    >
      <div className="mb-2 flex flex-col gap-[.125rem]">
        <Text size={14} weight="medium" color="brand">
          {WALLET_SYNC_PHASE_LABELS[phase]}{isComplete ? '' : ` — ${percent}%`}
        </Text>
        <Text size={10} weight="medium" color="brand" opacity={50}>
          {info.caption}
        </Text>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-x-3 gap-y-1">
        <Text size={10} weight="medium" color="brand" opacity={50}>Peers</Text>
        <Text size={10} weight="medium" color="brand">
          {sync?.peerCount ?? 0}
          {sync && sync.filterCapablePeerCount !== sync.peerCount
            ? ` (${sync.filterCapablePeerCount} filter-capable)`
            : ''}
        </Text>
        <Text size={10} weight="medium" color="brand" opacity={50}>Lock peers</Text>
        <Text size={10} weight="medium" color="brand">{sync?.lockPeerCount ?? 0}</Text>
        <Text size={10} weight="medium" color="brand" opacity={50}>Chain tip</Text>
        <Text size={10} weight="medium" color="brand">
          {(sync?.tipHeight ?? 0).toLocaleString('en-US')} / {(sync?.estimatedChainHeight ?? 0).toLocaleString('en-US')}
        </Text>
        {phase === WalletSyncPhase.SyncingCfheaders && (
          <>
            <Text size={10} weight="medium" color="brand" opacity={50}>Filter headers</Text>
            <Text size={10} weight="medium" color="brand">{(sync?.cfheadersHeight ?? 0).toLocaleString('en-US')}</Text>
          </>
        )}
        {phase === WalletSyncPhase.SyncingCfilters && (
          <>
            <Text size={10} weight="medium" color="brand" opacity={50}>Scanned filters</Text>
            <Text size={10} weight="medium" color="brand">{(sync?.cfilterScanHeight ?? 0).toLocaleString('en-US')}</Text>
          </>
        )}
        {Boolean(sync?.matchedBlocksPending) && (
          <>
            <Text size={10} weight="medium" color="brand" opacity={50}>Pending blocks</Text>
            <Text size={10} weight="medium" color="brand">{sync?.matchedBlocksPending}</Text>
          </>
        )}
        <Text size={10} weight="medium" color="brand" opacity={50}>ETA</Text>
        <Text size={10} weight="medium" color="brand">{formatSyncEta(sync?.phaseEtaMs)}</Text>
      </div>

      {sync?.lastError && (
        <Text as="div" size={10} weight="medium" color="red" className="mb-2">
          {sync.lastError}
        </Text>
      )}

    </div>
  )
}
