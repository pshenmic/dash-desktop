import type { DashboardHeadingProps } from '@renderer/types/DashboardHeading'

export default function DashboardHeading({ as: Heading = 'h3', inverse = false, className = '', ...props }: DashboardHeadingProps): React.JSX.Element {
  return <Heading {...props} className={`m-0 text-sm leading-5 font-semibold tracking-normal normal-case ${inverse ? 'text-white' : 'text-dash-primary-dark-blue dark:text-white'} ${className}`} />
}
