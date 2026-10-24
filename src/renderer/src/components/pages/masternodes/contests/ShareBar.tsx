import { PERCENT_SCALE, SHARE_BAR_FILL_CLASS, SHARE_BAR_TRACK_CLASS } from '@renderer/constants/nameContests'
import type { ShareBarProps } from '@renderer/types/NameContests'

export default function ShareBar({ share, className = '' }: ShareBarProps): React.JSX.Element {
  return (
    <div aria-hidden={'true'} className={className}>
      <div className={SHARE_BAR_TRACK_CLASS}>
        <div className={SHARE_BAR_FILL_CLASS} style={{ width: `${share * PERCENT_SCALE}%` }} />
      </div>
    </div>
  )
}
