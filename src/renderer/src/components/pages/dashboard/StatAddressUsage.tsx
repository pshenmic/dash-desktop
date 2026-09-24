import { AddressesIcon } from '@renderer/components/dash-ui-kit-enxtended/icons'
import { dashboardPage } from '@renderer/constants/dashboardPage'
import { STAT_FLOW_LABELS } from '@renderer/constants/dashboardStats'
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
    <StatCard icon={AddressesIcon} label={dashboardPage.stats.addressesUsed} value={null}
      body={<div className="stat-address-usage">
        {usage.map(item => {
          const { loading, err } = item.source === 'core' ? core : evo
          return <div key={item.source} className={`stat-flow-${item.source}`}>
            <div className="stat-address-label">
              <span className="stat-flow-label" title={item.source === 'core' ? 'Receiving and change addresses' : 'Platform addresses with a balance or prior spending activity'}>
                <i aria-hidden="true" />{STAT_FLOW_LABELS[item.source]}
              </span>
              {loading || err
                ? <span className="stat-sub">{loading ? 'Loading…' : 'Unavailable'}</span>
                : <span><strong>{item.used}</strong><span className="stat-sub"> / {item.total}</span></span>}
            </div>
            {!loading && !err && <div className="stat-address-track" aria-hidden="true">
              <span style={{ width: `${statShare(item.used, item.total)}%` }} />
            </div>}
          </div>
        })}
      </div>} />
  )
}
