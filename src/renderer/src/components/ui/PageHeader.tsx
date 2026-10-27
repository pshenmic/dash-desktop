import { ArrowIcon, Text } from '@renderer/components/dash-ui-kit-extended'
import type { PageHeaderProps } from '@renderer/types/PageHeader'
import { isEmphasizedCopy } from '@renderer/utils/pageHeader'

export default function PageHeader({
  title,
  subtitle,
  titleAddon,
  actions,
  actionsFooter,
  icon,
  id,
  onBack,
  backLabel,
  className = '',
}: PageHeaderProps): React.JSX.Element {
  const sub = onBack !== undefined
  return (
    <header className={`mb-7 flex items-start justify-between gap-6 ${sub ? '' : 'pt-2'} ${className}`}>
      <div className={`flex min-w-0 flex-col ${sub ? 'gap-2' : 'gap-3'}`}>
        <div className={`flex items-center ${sub ? 'gap-4' : 'gap-3'}`}>
          {sub && (
            <button
              type={"button"}
              onClick={onBack}
              aria-label={backLabel}
              title={backLabel}
              className={"flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg dash-block dash-text-default outline-none hover:bg-dash-primary-dark-blue/8 dark:hover:bg-white/8 focus-visible:ring-2 focus-visible:ring-dash-brand dark:focus-visible:ring-dash-mint"}
            >
              <ArrowIcon size={16} color={"currentColor"} />
            </button>
          )}
          {icon}
          <div className={"flex min-w-0 flex-wrap items-center gap-3"}>
            <Text as={"h1"} reset size={sub ? 24 : 32} weight={"medium"} color={"brand"} className={"leading-[125%] tracking-[-0.03em]"}>
              <span id={id}>{title}</span>
            </Text>
            {titleAddon}
          </div>
        </div>
        {subtitle && (
          <Text as={"p"} reset size={12} weight={"medium"} color={"brand"} opacity={50} className={"max-w-152.5 leading-[120%]"}>
            {isEmphasizedCopy(subtitle) ? <>{subtitle.lead}<strong>{subtitle.emphasis}</strong>{subtitle.tail}</> : subtitle}
          </Text>
        )}
      </div>
      {actions && (
        <div className={"flex shrink-0 flex-col items-end gap-2"}>
          <div className={`flex items-center gap-3 ${sub ? 'h-8' : 'h-10'}`}>{actions}</div>
          {actionsFooter}
        </div>
      )}
    </header>
  )
}
