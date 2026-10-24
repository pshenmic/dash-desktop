import { Text } from '@renderer/components/dash-ui-kit-enxtended'
import { AddressesIcon } from '@renderer/components/dash-ui-kit-enxtended/icons'
import { ANALYTICS_METER } from '@renderer/constants/dashboardAnalytics'
import { dashboardPage } from '@renderer/constants/dashboardPage'
import { STAT_SOURCE_KIND } from '@renderer/constants/dashboardStats'
import { useAuth } from '@renderer/contexts/AuthContext'
import { useAdresses } from '@renderer/hooks/useAdresses'
import { usePlatformAddresses } from '@renderer/hooks/usePlatformAddresses'
import { statShare, summarizeStatAddresses } from '@renderer/utils/dashboardStatCharts'
import ChartCard from './ChartCard'
import MetricRow from './MetricRow'
import SourceBadge from './SourceBadge'

export default function StatAddressUsage(): React.JSX.Element {
  const { status } = useAuth()
  const walletId = status?.selectedWalletId ?? undefined
  const core = useAdresses(walletId)
  const evo = usePlatformAddresses(walletId)
  const usage = summarizeStatAddresses([...core.receiving, ...core.change], evo.platformAddresses)
  const labels = dashboardPage.stats

  return (
    <ChartCard title={labels.addressesUsed} icon={AddressesIcon}>
      <div className="flex flex-col gap-2">
        {usage.map(item => {
          const { loading, err } = item.source === 'core' ? core : evo
          const meter = ANALYTICS_METER[item.source]
          return (
            <MetricRow
              key={item.source}
              lead={<SourceBadge kind={STAT_SOURCE_KIND[item.source]} />}
              value={(
                <div title={item.source === 'core' ? labels.coreAddressesTitle : labels.evoAddressesTitle}>
                  {loading || err
                    ? <Text size={12} weight="medium" color="brand" opacity={50} className="leading-[120%]">{loading ? labels.loading : labels.unavailable}</Text>
                    : (
                      <Text as="div" size={16} weight="bold" color="brand" className="leading-[140%]">
                        {item.used.toLocaleString('en-US')}
                        <Text size={12} weight="medium" color="brand" opacity={50}>{` / ${item.total.toLocaleString('en-US')}`}</Text>
                      </Text>
                    )}
                </div>
              )}
              aside={loading || err ? undefined : (
                <div className={meter.track} aria-hidden="true">
                  <div className={meter.fill} style={{ width: `${statShare(item.used, item.total)}%` }} />
                </div>
              )}
              asideClassName="min-w-16 flex-1 self-center"
            />
          )
        })}
      </div>
    </ChartCard>
  )
}
