import type { DashboardHeadingProps } from '@renderer/types/DashboardHeading'

export default function DashboardHeading({ as: Heading = 'h3', inverse = false, className = '', ...props }: DashboardHeadingProps): React.JSX.Element {
  return <Heading {...props} className={`dashboard-heading ${inverse ? 'dashboard-heading-inverse' : ''} ${className}`} />
}
