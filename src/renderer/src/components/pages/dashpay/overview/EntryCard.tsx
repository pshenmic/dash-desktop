import { ArrowIcon, Text } from '@renderer/components/dash-ui-kit-extended'
import { ICON_CHIP, SURFACE_SECTION } from '@renderer/constants/surfaces'
import type { EntryCardProps } from '@renderer/types/DashPayOverview'

export default function EntryCard({ icon, title, caption, disabled = false, onClick }: EntryCardProps): React.JSX.Element {
  return (
    <button type={'button'} disabled={disabled} onClick={onClick} className={`group relative flex items-center gap-3 text-left cursor-pointer ${SURFACE_SECTION} transition-colors enabled:hover:dash-block-accent-5 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-brand/40 dark:focus-visible:ring-dash-mint/40`}>
      <span className={ICON_CHIP}>{icon}</span>
      <span className={'flex min-w-0 flex-col gap-0.5'}>
        <Text reset size={14} weight={'bold'} color={'brand'} className={'truncate'}>{title}</Text>
        <Text reset size={12} weight={'medium'} color={'brand'} opacity={50} className={'truncate'}>{caption}</Text>
      </span>
      <ArrowIcon
        size={9}
        color={'currentColor'}
        className={'ml-auto shrink-0 rotate-180 dash-text-primary transition-transform group-enabled:group-hover:translate-x-0.5'}
      />
    </button>
  )
}
