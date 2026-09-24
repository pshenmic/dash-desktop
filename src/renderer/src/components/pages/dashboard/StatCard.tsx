import SensitiveValue from '@renderer/components/ui/SensitiveValue'
import type { StatCardProps } from '@renderer/types/DashboardStats'
import DashboardHeading from './DashboardHeading'

export default function StatCard({
  icon: Icon,
  iconSize = 14,
  label,
  value,
  sub,
  hidden = false,
  tone = 'brand',
  body,
  children,
  footer
}: StatCardProps): React.JSX.Element {
  return (
    <div className={`stat-card stat-tone-${tone} dash-card-base`}>
      <div className="stat-heading">
        <span className="stat-icon" aria-hidden="true">
          <Icon size={iconSize} color={"currentColor"} />
        </span>
        <DashboardHeading>{label}</DashboardHeading>
      </div>
      <div className="stat-body">
        {body ?? <>
          <div className="stat-value-row">
            <div className="stat-value">
              <SensitiveValue hidden={hidden} size={"card"}>
                {value}
              </SensitiveValue>
            </div>
          </div>
          {(sub !== undefined || hidden) && (
            <div className="stat-sub">
              <SensitiveValue hidden={hidden} size={"subtext"} label={"Statistic detail hidden"}>
                {sub}
              </SensitiveValue>
            </div>
          )}
        </>}
      </div>
      {children && <div className="stat-visual">{children}</div>}
      {footer && <div className="stat-footer">{footer}</div>}
    </div>
  )
}
