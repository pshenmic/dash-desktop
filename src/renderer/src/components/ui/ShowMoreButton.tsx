import { SHOW_MORE_LABEL } from '@renderer/constants/showMoreButton'
import { CHIP_ACTION } from '@renderer/constants/surfaces'
import type { ShowMoreButtonProps } from '@renderer/types/ShowMoreButton'

export default function ShowMoreButton({ remaining, onClick, ref }: ShowMoreButtonProps): React.JSX.Element {
  return (
    <button ref={ref} type={'button'} onClick={onClick} className={`self-center ${CHIP_ACTION} font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-brand/40 dark:focus-visible:ring-dash-mint/40`}>
      {`${SHOW_MORE_LABEL} · ${remaining}`}
    </button>
  )
}
