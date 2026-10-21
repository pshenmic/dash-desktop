import { ChevronIcon, Text } from '@renderer/components/dash-ui-kit-enxtended'
import type { PageHeaderProps } from '@renderer/types/PageHeader'

export default function PageHeader({
  title,
  subtitle,
  actions,
  icon,
  onBack,
  backLabel,
  className = '',
}: PageHeaderProps): React.JSX.Element {
  return (
    <header className={`mb-8 flex items-end justify-between gap-6 pt-2 ${className}`}>
      <div className={"flex min-w-0 flex-col gap-3"}>
        <div className={"flex items-center gap-3"}>
          {onBack && (
            <button
              type={"button"}
              onClick={onBack}
              aria-label={backLabel}
              title={backLabel}
              className={"flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-[.625rem] dash-block dash-text-default hover:bg-dash-primary-dark-blue/8 dark:hover:bg-white/8"}
            >
              <ChevronIcon size={14} color={"currentColor"} className={"rotate-90"} />
            </button>
          )}
          {icon}
          <Text as={"h1"} reset size={40} weight={"medium"} color={"brand"} className={"leading-[125%] tracking-[-0.03em]"}>
            {title}
          </Text>
        </div>
        <Text as={"p"} reset size={12} weight={"medium"} color={"brand"} opacity={50} className={"max-w-152.5 leading-[120%]"}>
          {subtitle}
        </Text>
      </div>
      {actions && <div className={"flex shrink-0 items-center gap-3"}>{actions}</div>}
    </header>
  )
}
