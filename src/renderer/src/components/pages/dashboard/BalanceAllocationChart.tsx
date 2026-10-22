import { useEffect, useState } from 'react'
import { Text, WalletIcon } from '@renderer/components/dash-ui-kit-enxtended'
import { useAuth } from '@renderer/contexts/AuthContext'
import { useWalletBalance } from '@renderer/hooks/useWalletBalance'
import { usePlatformAddresses } from '@renderer/hooks/usePlatformAddresses'
import { usePlatformCredits } from '@renderer/hooks/usePlatformCredits'
import { useShieldedSyncState } from '@renderer/hooks/useShielded'
import { useBalanceVisibility } from '@renderer/hooks/useBalanceVisibility'
import ShieldedUnlockModal from '@renderer/components/modal/ShieldedUnlockModal'
import DashBigNumber from '@renderer/components/ui/DashBigNumber'
import { DASH_UNIT } from '@renderer/constants/balance'
import { ALLOCATION_AMOUNT_FLOOR, ANALYTICS_FOCUS, ANALYTICS_PLACEHOLDER, ANALYTICS_PULSE, ANALYTICS_SERIES, SHIELDED_SEGMENT_LABEL } from '@renderer/constants/dashboardAnalytics'
import { dashboardPage } from '@renderer/constants/dashboardPage'
import { ShieldedSyncPhase } from '@renderer/enums/ShieldedSyncPhase'
import { buildBalanceAllocation, formatAllocationAmount, formatShare } from '@renderer/utils/dashboardAnalytics'
import { creditsToDash } from '@renderer/utils/balance'
import ChartCard from './ChartCard'
import SplitBar from './SplitBar'

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
  const labels = dashboardPage.analytics.balances
  const pending = loading || platformLoading
  const message = !isBalanceVisible ? dashboardPage.analytics.amountsHidden : !pending && (err || platformError) ? labels.unavailable : null

  useEffect(() => {
    setSyncStarting(false)
  }, [shieldedSync.phase, shieldedSync.syncedAt])

  const amount = (credits: bigint): React.JSX.Element => {
    const value = formatAllocationAmount(credits)
    return <>{value === ALLOCATION_AMOUNT_FLOOR ? value : <DashBigNumber>{value}</DashBigNumber>}<span className="font-medium"> {DASH_UNIT}</span></>
  }
  const headline = selected
    ? shieldedUnknown ? amount(selected.credits) : `${formatShare(selected.share)}%`
    : shieldedUnknown ? '—' : amount(allocation.total)

  return (
    <ChartCard title={labels.title} icon={WalletIcon} description={labels.description}>
      {message ? (
        <div className={`${ANALYTICS_PLACEHOLDER} flex-1`} role="status">
          <Text size={12} weight="medium" color="brand" opacity={50}>{message}</Text>
        </div>
      ) : pending ? (
        <div className={`${ANALYTICS_PULSE} min-h-52 flex-1`} role="status">
          <span className="sr-only">{labels.loading}</span>
        </div>
      ) : (
        <>
          <div className="flex items-baseline justify-between gap-2">
            <Text as="div" size={20} weight="extrabold" color="brand" className="leading-[140%]">{headline}</Text>
            <Text size={12} weight="medium" color="brand" opacity={50} className="leading-[120%]">{selected ? selected.label : `${DASH_UNIT} ${labels.total}`}</Text>
          </div>
          {allocation.total > 0n
            ? <SplitBar segments={allocation.segments.map(segment => ({ key: segment.label, share: segment.share, series: segment.series }))} active={active} onActive={setActive} />
            : <div className="h-2 rounded-full dash-block-5" aria-hidden="true" />}
          <div className="mt-1 flex flex-col gap-0.5" aria-label={`${labels.title} in ${DASH_UNIT}`}>
            {allocation.segments.map(segment => {
              const swatch = (
                <span className="flex min-w-0 items-center gap-2">
                  <span className={`size-2 shrink-0 rounded-[2px] ${ANALYTICS_SERIES[segment.series].fill}`} aria-hidden="true" />
                  <Text size={12} weight="medium" color="brand" className="truncate">{segment.label}</Text>
                </span>
              )
              return shieldedUnknown && segment.label === SHIELDED_SEGMENT_LABEL ? (
                <div key={segment.label} className="-mx-2 grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3 px-2 py-1.5">
                  {swatch}
                  <span className="flex items-baseline gap-2.5">
                    <Text size={12} weight="bold" color="brand">—</Text>
                    {shieldedSyncing
                      ? <Text size={12} weight="medium" color="brand" opacity={50}>{dashboardPage.shielded.syncing}</Text>
                      : (
                        <button type="button" className={`cursor-pointer rounded-sm hover:opacity-80 ${ANALYTICS_FOCUS}`} onClick={() => setSyncOpen(true)}>
                          <Text size={12} weight="bold" color="blue-mint">{dashboardPage.shielded.syncNotes}</Text>
                        </button>
                      )}
                  </span>
                </div>
              ) : (
                <button
                  key={segment.label}
                  type="button"
                  className={`-mx-2 grid grid-cols-[minmax(0,1fr)_auto_2.5rem] items-baseline gap-3 rounded-[.625rem] px-2 py-1.5 text-left hover:bg-dash-primary-dark-blue/6 dark:hover:bg-white/5 ${ANALYTICS_FOCUS} ${active === segment.label ? 'dash-block-5' : ''}`}
                  title={`${segment.label}: ${creditsToDash(segment.credits)} ${DASH_UNIT}${shieldedUnknown ? '' : ` · ${segment.share.toFixed(2)}%`}`}
                  onPointerEnter={() => setActive(segment.label)}
                  onPointerLeave={() => setActive(null)}
                  onFocus={() => setActive(segment.label)}
                  onBlur={() => setActive(null)}
                  onClick={() => setActive(segment.label)}
                >
                  {swatch}
                  <Text size={12} weight="bold" color="brand" className="tabular-nums">{amount(segment.credits)}</Text>
                  <Text size={12} weight="medium" color="brand" opacity={50} className="text-right tabular-nums">{shieldedUnknown ? '' : `${formatShare(segment.share)}%`}</Text>
                </button>
              )
            })}
          </div>
        </>
      )}
      <ShieldedUnlockModal isOpen={syncOpen} onClose={() => setSyncOpen(false)} onStarted={() => setSyncStarting(true)} walletId={walletId ?? null} />
    </ChartCard>
  )
}
