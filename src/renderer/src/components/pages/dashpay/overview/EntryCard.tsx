import { ArrowIcon, Text } from '@renderer/components/dash-ui-kit-extended'
import { ENTRY_CARD_CLASS } from '@renderer/constants/dashPayOverview'
import { ICON_CHIP } from '@renderer/constants/surfaces'
import type { EntryCardProps } from '@renderer/types/DashPayOverview'

export default function EntryCard({ icon, title, caption, disabled = false, onClick }: EntryCardProps): React.JSX.Element {
  return (
    <button type={'button'} disabled={disabled} onClick={onClick} className={ENTRY_CARD_CLASS}>
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
