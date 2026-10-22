import { useId } from 'react'
import { Text } from '@renderer/components/dash-ui-kit-enxtended'
import { ICON_CHIP, SURFACE_PANEL } from '@renderer/constants/surfaces'
import type { ChartCardProps } from '@renderer/types/DashboardAnalytics'
import DashboardHeading from './DashboardHeading'

export default function ChartCard({ title, icon: Icon, description, children, className = '' }: ChartCardProps): React.JSX.Element {
  const titleId = useId()
  const descriptionId = useId()
  return (
    <section aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined} className={`flex min-w-0 flex-col gap-3 ${SURFACE_PANEL} ${className}`}>
      <header className="flex min-h-[1.875rem] items-center gap-2.5">
        <span className={ICON_CHIP} aria-hidden="true">
          <Icon size={14} color="currentColor" />
        </span>
        <DashboardHeading id={titleId}>{title}</DashboardHeading>
      </header>
      {description && (
        <p id={descriptionId}>
          <Text size={12} weight="medium" color="brand" opacity={50} className="leading-[120%]">{description}</Text>
        </p>
      )}
      {children}
    </section>
  )
}
