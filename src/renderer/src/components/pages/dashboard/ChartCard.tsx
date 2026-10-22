import { useId } from 'react'
import { SURFACE_PANEL } from '@renderer/constants/surfaces'
import type { ChartCardProps } from '@renderer/types/DashboardAnalytics'
import DashboardHeading from './DashboardHeading'

export default function ChartCard({ title, description, children, className = '' }: ChartCardProps): React.JSX.Element {
  const titleId = useId()
  const descriptionId = useId()
  return (
    <section aria-labelledby={titleId} aria-describedby={descriptionId} className={`min-w-0 ${SURFACE_PANEL} ${className}`}>
      <header>
        <DashboardHeading id={titleId} title={description}>{title}</DashboardHeading>
        <p id={descriptionId} className="sr-only">{description}</p>
      </header>
      {children}
    </section>
  )
}
