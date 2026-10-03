import { AddressesIcon } from '@renderer/components/dash-ui-kit-enxtended/icons'
import { dashboardPage } from '@renderer/constants/dashboardPage'
import { STAT_FLOW_LABELS, STAT_SOURCE_CLASSES } from '@renderer/constants/dashboardStats'
import { useAuth } from '@renderer/contexts/AuthContext'
import { useAdresses } from '@renderer/hooks/useAdresses'
import { usePlatformAddresses } from '@renderer/hooks/usePlatformAddresses'
import { statShare, summarizeStatAddresses } from '@renderer/utils/dashboardStatCharts'
import StatCard from './StatCard'

export default function StatAddressUsage(): React.JSX.Element {
  const { status } = useAuth()
  const walletId = status?.selectedWalletId ?? undefined
  const core = useAdresses(walletId)
  const evo = usePlatformAddresses(walletId)
  const usage = summarizeStatAddresses([...core.receiving, ...core.change], evo.platformAddresses)

  return (
    <StatCard compact icon={AddressesIcon} label={dashboardPage.stats.addressesUsed} value={null}
      body={<div className="grid grid-cols-2 gap-3">
        {usage.map(item => {
          const { loading, err } = item.source === 'core' ? core : evo
          return <div key={item.source} className={STAT_SOURCE_CLASSES[item.source]}>
            <div className="mb-1 flex flex-col-reverse items-start justify-between gap-[3px] text-xs leading-[22px] tabular-nums">
              <span className="text-[11px] leading-4 text-(--stat-muted)" title={item.source === 'core' ? 'Receiving and change addresses' : 'Platform addresses with a balance or prior spending activity'}>
                <i className="mr-1 inline-block size-[5px] rounded-full bg-(--stat-series)" aria-hidden="true" />{STAT_FLOW_LABELS[item.source]}
              </span>
              {loading || err
                ? <span className="text-[11px] leading-4 text-(--stat-muted)">{loading ? 'Loading…' : 'Unavailable'}</span>
                : <span><strong className="text-lg font-bold">{item.used}</strong><span className="text-[11px] leading-4 text-(--stat-muted)"> / {item.total}</span></span>}
            </div>
            {!loading && !err && <div className="h-1 overflow-hidden rounded-sm bg-(--stat-track)" aria-hidden="true">
              <span className="block h-full rounded-[inherit] bg-(--stat-series)" style={{ width: `${statShare(item.used, item.total)}%` }} />
            </div>}
          </div>
        })}
      </div>} />
  )
}
