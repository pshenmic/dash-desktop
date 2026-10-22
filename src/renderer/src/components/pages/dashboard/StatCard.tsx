import SensitiveValue from '@renderer/components/ui/SensitiveValue'
import { STAT_TONE_CLASSES } from '@renderer/constants/dashboardStats'
import { SURFACE_PANEL } from '@renderer/constants/surfaces'
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
  footer,
  compact = false,
  className = ''
}: StatCardProps): React.JSX.Element {
  return (
    <div className={`min-w-0 ${SURFACE_PANEL} ${STAT_TONE_CLASSES[tone]} ${compact ? 'flex flex-col gap-2.5' : 'grid grid-cols-1 grid-rows-[auto_1fr_auto] gap-x-3.5 gap-y-2'} ${className}`}>
      <div className="col-span-full flex items-center gap-2">
        <span className={`flex shrink-0 items-center justify-center rounded-lg text-(--stat-accent) ${compact ? 'size-[22px]' : 'size-7 bg-(--stat-accent)/12'}`} aria-hidden="true">
          <Icon size={iconSize} color={"currentColor"} />
        </span>
        <DashboardHeading className="text-xs! leading-[18px]!">{label}</DashboardHeading>
      </div>
      <div className={`flex flex-col gap-[3px] ${compact ? 'min-h-[50px]' : 'col-start-1 row-start-2 justify-center'}`}>
        {body ?? <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className={`font-extrabold tabular-nums wrap-anywhere ${compact ? 'text-lg leading-[22px] tracking-[-0.25px]' : 'text-xl leading-[1.25] tracking-[-0.4px]'}`}>
              <SensitiveValue hidden={hidden} size={"card"}>
                {value}
              </SensitiveValue>
            </div>
          </div>
          {(sub !== undefined || hidden) && (
            <div className="text-xs leading-4 text-(--stat-muted)">
              <SensitiveValue hidden={hidden} size={"subtext"} label={"Statistic detail hidden"}>
                {sub}
              </SensitiveValue>
            </div>
          )}
        </>}
      </div>
      {children && <div className="col-span-full row-start-3 min-w-0 self-end">{children}</div>}
      {footer && <div className="col-span-full row-start-3">{footer}</div>}
    </div>
  )
}
