import { useId } from 'react'
import type { ChartCardProps } from '@renderer/types/DashboardAnalytics'
import DashboardHeading from './DashboardHeading'

export default function ChartCard({ title, description, children, className = '' }: ChartCardProps): React.JSX.Element {
  const titleId = useId()
  const descriptionId = useId()
  return (
    <section aria-labelledby={titleId} aria-describedby={descriptionId} className={`min-w-0 rounded-3xl p-4 shadow-[0_0_32px_#0c1c3308] dash-card-base ${className}`}>
      <header>
        <DashboardHeading id={titleId} title={description}>{title}</DashboardHeading>
        <p id={descriptionId} className="sr-only">{description}</p>
      </header>
      {children}
    </section>
  )
}
