import type { DashboardAnalytics } from '@renderer/types/DashboardAnalytics'
import ChartCard from './ChartCard'
import { summarizeEvoTypes } from '@renderer/utils/dashboardAnalytics'

export default function EvoTypesChart({ types, evoCount }: Pick<DashboardAnalytics, 'types' | 'evoCount'>): React.JSX.Element {
  const groups = summarizeEvoTypes(types)
  const maximum = groups.reduce((max, item) => Math.max(max, item.count), 0)
  return (
    <ChartCard title="Evo transaction types" description="Transaction count and share by type · all statuses">
      {types.length === 0 ? <div className="chart-empty">No Evo transactions in this period</div> : (
        <div className="evo-types" tabIndex={0} role="region" aria-label="Evo transaction counts by type">
          {groups.map(item => (
            <div key={item.type} className="evo-type-row">
              <div className="evo-type-label"><span>{item.label}</span><span><b>{item.count.toLocaleString('en-US')}</b><small>{Math.round(item.count / evoCount * 100)}%</small></span></div>
              <div className="evo-type-track" aria-hidden="true"><div style={{ width: `${item.count / maximum * 100}%` }} /></div>
            </div>
          ))}
        </div>
      )}
    </ChartCard>
  )
}
