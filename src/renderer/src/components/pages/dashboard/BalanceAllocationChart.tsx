import { useState } from 'react'
import { useAuth } from '@renderer/contexts/AuthContext'
import { useWalletBalance } from '@renderer/hooks/useWalletBalance'
import { usePlatformAddresses } from '@renderer/hooks/usePlatformAddresses'
import { usePlatformCredits } from '@renderer/hooks/usePlatformCredits'
import { useShieldedCredits } from '@renderer/hooks/useShielded'
import { useBalanceVisibility } from '@renderer/hooks/useBalanceVisibility'
import { buildBalanceAllocation, formatAllocationAmount } from '@renderer/utils/dashboardAnalytics'
import { creditsToDash } from '@renderer/utils/balance'
import ChartCard from './ChartCard'

export default function BalanceAllocationChart(): React.JSX.Element {
  const { status } = useAuth()
  const walletId = status?.selectedWalletId ?? undefined
  const { balance, loading, err } = useWalletBalance(walletId)
  const { loading: platformLoading, err: platformError } = usePlatformAddresses(walletId)
  const platformCredits = usePlatformCredits(walletId)
  const shieldedCredits = useShieldedCredits(walletId)
  const { isBalanceVisible } = useBalanceVisibility()
  const [active, setActive] = useState<string | null>(null)
  const allocation = buildBalanceAllocation(balance.dash.amount, platformCredits, shieldedCredits ?? 0n)
  const selected = allocation.segments.find(segment => segment.label === active)
  const message = !isBalanceVisible ? 'Amounts hidden'
    : loading || platformLoading ? 'Loading balances…'
    : err || platformError ? 'Balances unavailable'
    : shieldedCredits === null ? 'Sync shielded balance to view allocation' : null

  return (
    <ChartCard title="Current balances" description="Current distribution across Core, Platform and Shielded · independent of the selected period">
      {message ? <div className="chart-hidden" role="status">{message}</div> : (
        <div className="balance-allocation">
          <div className="allocation-donut">
            <svg viewBox="0 0 120 120" aria-hidden="true">
              <circle cx={60} cy={60} r={49} fill="none" stroke="var(--chart-grid)" strokeWidth={12} />
              {allocation.segments.filter(segment => segment.share > 0).map(segment => (
                <circle key={segment.label} cx={60} cy={60} r={49} fill="none" stroke={segment.color} strokeWidth={active === segment.label ? 15 : 12}
                  pathLength={100} strokeDasharray={`${segment.share} ${100 - segment.share}`} strokeDashoffset={-segment.offset}
                  transform="rotate(-90 60 60)" onPointerEnter={() => setActive(segment.label)} onPointerLeave={() => setActive(null)} />
              ))}
            </svg>
            <div className="allocation-center" aria-hidden="true">
              <strong>{selected ? `${selected.share.toFixed(1)}%` : formatAllocationAmount(allocation.total)}</strong>
              <span>{selected ? selected.label : 'DASH total'}</span>
            </div>
          </div>
          <div className="allocation-legend" aria-label="Current balances in DASH">
            {allocation.segments.map(segment => (
              <button key={segment.label} type="button" className="allocation-row" title={`${segment.label}: ${creditsToDash(segment.credits)} DASH · ${segment.share.toFixed(2)}%`}
                onPointerEnter={() => setActive(segment.label)} onPointerLeave={() => setActive(null)}
                onFocus={() => setActive(segment.label)} onBlur={() => setActive(null)} onClick={() => setActive(segment.label)}>
                <span><i style={{ background: segment.color }} />{segment.label}</span>
                <span><b>{formatAllocationAmount(segment.credits)} <small>DASH</small></b><small>{segment.share > 0 && segment.share < 0.1 ? '<0.1' : segment.share.toFixed(1)}%</small></span>
              </button>
            ))}
          </div>
        </div>
      )}
    </ChartCard>
  )
}
