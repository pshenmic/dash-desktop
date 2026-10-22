import { CreditsIcon, Text } from '@renderer/components/dash-ui-kit-enxtended'
import { ANALYTICS_METER, ANALYTICS_PLACEHOLDER } from '@renderer/constants/dashboardAnalytics'
import { dashboardPage } from '@renderer/constants/dashboardPage'
import type { DashboardAnalytics } from '@renderer/types/DashboardAnalytics'
import ChartCard from './ChartCard'
import { formatShare, summarizeEvoTypes } from '@renderer/utils/dashboardAnalytics'

export default function EvoTypesChart({ types, evoCount }: Pick<DashboardAnalytics, 'types' | 'evoCount'>): React.JSX.Element {
  const groups = summarizeEvoTypes(types)
  const maximum = groups.reduce((max, item) => Math.max(max, item.count), 0)
  const labels = dashboardPage.analytics.evoTypes
  return (
    <ChartCard title={labels.title} icon={CreditsIcon} description={labels.description}>
      {types.length === 0 ? (
        <div className={`${ANALYTICS_PLACEHOLDER} flex-1 py-8`}>
          <Text size={12} weight="medium" color="brand" opacity={50}>{labels.empty}</Text>
        </div>
      ) : (
        <div className="flex flex-col gap-3" role="region" aria-label={labels.region}>
          {groups.map(item => (
            <div key={item.type} className="flex flex-col gap-1.5">
              <div className="flex justify-between gap-2">
                <Text size={12} weight="medium" color="brand" className="leading-[120%] wrap-anywhere">{item.label}</Text>
                <span className="flex shrink-0 items-baseline gap-2">
                  <Text size={12} weight="bold" color="brand" className="tabular-nums">{item.count.toLocaleString('en-US')}</Text>
                  <Text size={12} weight="medium" color="brand" opacity={50} className="w-10 text-right tabular-nums">{`${formatShare(item.count / evoCount * 100)}%`}</Text>
                </span>
              </div>
              <div className={ANALYTICS_METER.evo.track} aria-hidden="true">
                <div className={ANALYTICS_METER.evo.fill} style={{ width: `${item.count / maximum * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </ChartCard>
  )
}
