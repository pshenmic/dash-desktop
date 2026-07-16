import { Text } from '@renderer/components/dash-ui-kit-enxtended'
import { IconProps } from '@renderer/components/dash-ui-kit-enxtended/icons'

interface StatCardProps {
  icon: React.FC<IconProps>
  iconSize?: number
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  hidden?: boolean
}

export default function StatCard({
  icon: Icon,
  iconSize = 14,
  label,
  value,
  sub,
  hidden = false
}: StatCardProps): React.JSX.Element {
  const blur = hidden ? 'blur-sm select-none pointer-events-none' : ''

  return (
    <div className={"flex flex-col gap-3 p-[.9375rem] rounded-3xl dash-card-base shadow-[0_0_32px_0_rgba(12,28,51,0.08)]"}>
      <div className={"flex items-center gap-2.5"}>
        <span className={"flex size-[1.875rem] shrink-0 items-center justify-center rounded-full bg-dash-brand/12 dark:bg-dash-mint/12 dash-text-primary"}>
          <Icon size={iconSize} color={"currentColor"} />
        </span>
        <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"leading-[120%]"}>
          {label}
        </Text>
      </div>
      <div className={"flex flex-col gap-1"}>
        <Text size={20} weight={"extrabold"} color={"brand"} className={`leading-[120%] ${blur}`}>
          {value}
        </Text>
        {sub !== undefined && (
          <Text size={10} weight={"medium"} color={"brand"} opacity={30} className={`leading-[120%] ${blur}`}>
            {sub}
          </Text>
        )}
      </div>
    </div>
  )
}
