import { useEffect, useState } from 'react'
import { useAuth } from '@renderer/contexts/AuthContext'
import { useWalletBalance } from '@renderer/hooks/useWalletBalance'
import { usePlatformAddresses } from '@renderer/hooks/usePlatformAddresses'
import { usePlatformCredits } from '@renderer/hooks/usePlatformCredits'
import { useShieldedSyncState } from '@renderer/hooks/useShielded'
import { useBalanceVisibility } from '@renderer/hooks/useBalanceVisibility'
import ShieldedUnlockModal from '@renderer/components/modal/ShieldedUnlockModal'
import { SHIELDED_SEGMENT_LABEL } from '@renderer/constants/dashboardAnalytics'
import { dashboardPage } from '@renderer/constants/dashboardPage'
import { ShieldedSyncPhase } from '@renderer/enums/ShieldedSyncPhase'
import { buildBalanceAllocation, formatAllocationAmount } from '@renderer/utils/dashboardAnalytics'
import { creditsToDash } from '@renderer/utils/balance'
import ChartCard from './ChartCard'

export default function BalanceAllocationChart(): React.JSX.Element {
  const { status } = useAuth()
  const walletId = status?.selectedWalletId ?? undefined
  const { balance, loading, err } = useWalletBalance(walletId)
  const { loading: platformLoading, err: platformError } = usePlatformAddresses(walletId)
  const platformCredits = usePlatformCredits(walletId)
  const shieldedSync = useShieldedSyncState(walletId)
  const { isBalanceVisible } = useBalanceVisibility()
  const [active, setActive] = useState<string | null>(null)
  const [syncOpen, setSyncOpen] = useState(false)
  const [syncStarting, setSyncStarting] = useState(false)
  const shieldedCredits = shieldedSync.phase === ShieldedSyncPhase.Done ? shieldedSync.balance : null
  const allocation = buildBalanceAllocation(balance.dash.amount, platformCredits, shieldedCredits ?? 0n)
  const selected = allocation.segments.find(segment => segment.label === active)
  const shieldedUnknown = shieldedCredits === null
  const shieldedSyncing = syncStarting || shieldedSync.phase === ShieldedSyncPhase.Syncing || shieldedSync.phase === ShieldedSyncPhase.Recovering
  const centreValue = selected
    ? shieldedUnknown ? formatAllocationAmount(selected.credits) : `${selected.share.toFixed(1)}%`
    : shieldedUnknown ? '—' : formatAllocationAmount(allocation.total)

  useEffect(() => {
    setSyncStarting(false)
  }, [shieldedSync.phase, shieldedSync.syncedAt])

  const message = !isBalanceVisible ? 'Amounts hidden'
    : loading || platformLoading ? 'Loading balances…'
    : err || platformError ? 'Balances unavailable' : null

  return (
    <ChartCard title="Current balances" description="Not affected by the selected period.">
      {message ? <div className="flex h-[227px] items-center justify-center text-center text-xs text-(--chart-muted)" role="status">{message}</div> : (
        <div className="mt-2 flex h-[215px] flex-col justify-between gap-2">
          <div className="relative size-30 shrink-0 self-center">
            <svg className="block size-full" viewBox="0 0 120 120" aria-hidden="true">
              <circle cx={60} cy={60} r={49} fill="none" stroke="var(--chart-grid)" strokeWidth={12} />
              {allocation.segments.filter(segment => segment.share > 0).map(segment => (
                <circle key={segment.label} cx={60} cy={60} r={49} fill="none" stroke={segment.color} strokeWidth={active === segment.label ? 15 : 12}
                  pathLength={100} strokeDasharray={`${segment.share} ${100 - segment.share}`} strokeDashoffset={-segment.offset}
                  transform="rotate(-90 60 60)" onPointerEnter={() => setActive(segment.label)} onPointerLeave={() => setActive(null)} />
              ))}
            </svg>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-[3px]" aria-hidden="true">
              <strong className="text-[15px] font-bold tabular-nums">{centreValue}</strong>
              <span className="text-[10px] text-(--chart-muted)">{selected ? selected.label : 'DASH total'}</span>
            </div>
          </div>
          <div className="flex flex-col gap-1" aria-label="Current balances in DASH">
            {allocation.segments.map(segment => shieldedUnknown && segment.label === SHIELDED_SEGMENT_LABEL ? (
              <div key={segment.label} className="flex items-center justify-between gap-2 py-[3px] text-[11px]">
                <span><i className="mr-1.5 inline-block size-[7px] rounded-[2px]" style={{ background: segment.color }} />{segment.label}</span>
                <span className="flex items-baseline gap-2.5">
                  <b className="font-semibold">—</b>
                  {shieldedSyncing
                    ? <small className="text-[10px] text-(--chart-muted)">{dashboardPage.shielded.syncing}</small>
                    : <button type="button" className="cursor-pointer text-[10px] font-semibold text-dash-brand hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--chart-core) dark:text-dash-mint" onClick={() => setSyncOpen(true)}>{dashboardPage.shielded.syncNotes}</button>}
                </span>
              </div>
            ) : (
              <button key={segment.label} type="button" className="flex items-center justify-between gap-2 rounded-sm py-[3px] text-left text-[11px] hover:bg-(--chart-grid) focus-visible:bg-(--chart-grid) focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--chart-core)" title={`${segment.label}: ${creditsToDash(segment.credits)} DASH${shieldedUnknown ? '' : ` · ${segment.share.toFixed(2)}%`}`}
                onPointerEnter={() => setActive(segment.label)} onPointerLeave={() => setActive(null)}
                onFocus={() => setActive(segment.label)} onBlur={() => setActive(null)} onClick={() => setActive(segment.label)}>
                <span><i className="mr-1.5 inline-block size-[7px] rounded-[2px]" style={{ background: segment.color }} />{segment.label}</span>
                <span className="flex items-baseline gap-2.5 tabular-nums"><b className="font-semibold">{formatAllocationAmount(segment.credits)} <small className="text-[10px] font-normal text-(--chart-muted)">DASH</small></b>{!shieldedUnknown && <small className="min-w-10 text-right text-[10px] font-normal text-(--chart-muted)">{segment.share > 0 && segment.share < 0.1 ? '<0.1' : segment.share.toFixed(1)}%</small>}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <ShieldedUnlockModal isOpen={syncOpen} onClose={() => setSyncOpen(false)} onStarted={() => setSyncStarting(true)} walletId={walletId ?? null} />
    </ChartCard>
  )
}
