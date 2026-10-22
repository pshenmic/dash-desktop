import { Text } from '@renderer/components/dash-ui-kit-enxtended'
import {
  CONTENDER_OPTION_BASE,
  CONTENDER_OPTION_DISABLED,
  CONTENDER_OPTION_IDLE,
  CONTENDER_OPTION_SELECTED,
  RADIO_DOT_BASE,
  RADIO_DOT_IDLE,
  RADIO_DOT_SELECTED,
} from '@renderer/constants/nameContests'
import type { ContenderOptionProps } from '@renderer/types/NameContests'
import { formatShare } from '@renderer/utils/contestVoting'
import ShareBar from './ShareBar'

export default function ContenderOption({
  selected,
  disabled,
  focusable,
  onSelect,
  onKeyDown,
  icon,
  title,
  badge,
  caption,
  votes,
  share,
  ref,
}: ContenderOptionProps): React.JSX.Element {
  return (
    <button
      ref={ref}
      type={'button'}
      role={'radio'}
      aria-checked={selected}
      disabled={disabled}
      tabIndex={focusable ? 0 : -1}
      onClick={onSelect}
      onKeyDown={onKeyDown}
      className={`${CONTENDER_OPTION_BASE} ${selected ? CONTENDER_OPTION_SELECTED : CONTENDER_OPTION_IDLE} ${disabled ? CONTENDER_OPTION_DISABLED : ''}`}
    >
      <span aria-hidden={'true'} className={`${RADIO_DOT_BASE} ${selected ? RADIO_DOT_SELECTED : RADIO_DOT_IDLE}`} />
      {icon}
      <span className={'flex min-w-0 flex-1 flex-col gap-1'}>
        <span className={'flex min-w-0 items-center gap-2'}>
          <Text size={14} weight={'medium'} color={'brand'} className={'min-w-0 wrap-anywhere'}>{title}</Text>
          {badge}
        </span>
        {caption}
        <ShareBar share={share} className={'mt-0.5 w-full'} />
      </span>
      <span className={'flex shrink-0 flex-col items-end gap-0.5'}>
        <Text size={16} weight={'bold'} color={'brand'} className={'tabular-nums'}>{votes}</Text>
        <Text size={10} weight={'medium'} color={'brand'} opacity={50} className={'tabular-nums'}>{formatShare(share)}</Text>
      </span>
    </button>
  )
}
