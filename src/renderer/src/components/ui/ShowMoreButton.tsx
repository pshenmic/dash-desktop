import { SHOW_MORE_BUTTON_CLASS, SHOW_MORE_LABEL } from '@renderer/constants/showMoreButton'
import type { ShowMoreButtonProps } from '@renderer/types/ShowMoreButton'

export default function ShowMoreButton({ remaining, onClick, ref }: ShowMoreButtonProps): React.JSX.Element {
  return (
    <button ref={ref} type={'button'} onClick={onClick} className={SHOW_MORE_BUTTON_CLASS}>
      {`${SHOW_MORE_LABEL} · ${remaining}`}
    </button>
  )
}
