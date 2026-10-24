import type { MetricRowProps } from '@renderer/types/DashboardStats'

export default function MetricRow({ lead, value, aside, asideClassName = '' }: MetricRowProps): React.JSX.Element {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
      {lead}
      {value}
      {aside !== undefined && <div className={`ml-auto ${asideClassName}`}>{aside}</div>}
    </div>
  )
}
