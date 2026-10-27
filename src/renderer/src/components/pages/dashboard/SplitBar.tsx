import { ANALYTICS_SERIES } from '@renderer/constants/dashboardAnalytics'
import type { SplitBarProps } from '@renderer/types/DashboardAnalytics'

export default function SplitBar({ segments, active = null, onActive }: SplitBarProps): React.JSX.Element {
  return (
    <div className="flex h-2 w-full gap-0.5" aria-hidden="true">
      {segments.filter(segment => segment.share > 0).map(segment => (
        <span
          key={segment.key}
          className={`min-w-1 first:rounded-l-full last:rounded-r-full transition-opacity ${ANALYTICS_SERIES[segment.series].fill} ${active !== null && active !== segment.key ? 'opacity-40' : ''}`}
          style={{ width: `${segment.share}%` }}
          onPointerEnter={() => onActive?.(segment.key)}
          onPointerLeave={() => onActive?.(null)}
        />
      ))}
    </div>
  )
}
