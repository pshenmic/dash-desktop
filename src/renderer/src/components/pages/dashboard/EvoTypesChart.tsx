import type { DashboardAnalytics } from '@renderer/types/DashboardAnalytics'
import ChartCard from './ChartCard'
import { summarizeEvoTypes } from '@renderer/utils/dashboardAnalytics'

export default function EvoTypesChart({ types, evoCount }: Pick<DashboardAnalytics, 'types' | 'evoCount'>): React.JSX.Element {
  const groups = summarizeEvoTypes(types)
  const maximum = groups.reduce((max, item) => Math.max(max, item.count), 0)
  return (
    <ChartCard title="Evo transaction types" description="Transaction count and share by type · all statuses">
      {types.length === 0 ? <div className="flex h-[227px] items-center justify-center text-center text-xs text-(--chart-muted)">No Evo transactions in this period</div> : (
        <div className="mt-2 h-[215px] space-y-2.5 overflow-y-auto pr-[5px] pb-1 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--chart-core)" tabIndex={0} role="region" aria-label="Evo transaction counts by type">
          {groups.map(item => (
            <div key={item.type}>
              <div className="mb-[5px] flex justify-between gap-2 text-[11px]"><span className="wrap-anywhere">{item.label}</span><span className="whitespace-nowrap tabular-nums"><b>{item.count.toLocaleString('en-US')}</b><small className="inline-block w-[34px] text-right text-[10px] text-(--chart-muted)">{Math.round(item.count / evoCount * 100)}%</small></span></div>
              <div className="h-[5px] overflow-hidden rounded-[3px] bg-(--chart-evo)/10" aria-hidden="true"><div className="h-full rounded-[inherit] bg-(--chart-evo)" style={{ width: `${item.count / maximum * 100}%` }} /></div>
            </div>
          ))}
        </div>
      )}
    </ChartCard>
  )
}
