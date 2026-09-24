import { useId } from 'react'
import type { ChartCardProps } from '@renderer/types/DashboardAnalytics'
import DashboardHeading from './DashboardHeading'

export default function ChartCard({ title, description, children, className = '' }: ChartCardProps): React.JSX.Element {
  const titleId = useId()
  const descriptionId = useId()
  return (
    <section aria-labelledby={titleId} aria-describedby={descriptionId} className={`analytics-card dash-card-base ${className}`}>
      <header className="analytics-card-header">
        <DashboardHeading id={titleId} title={description}>{title}</DashboardHeading>
        <p id={descriptionId} className="sr-only">{description}</p>
      </header>
      {children}
    </section>
  )
}
