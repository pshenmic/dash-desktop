import { QrCodeIcon } from '@renderer/components/dash-ui-kit-enxtended/icons'
import type { QrButtonProps } from '@renderer/types/QrButton'

export default function QrButton({ onClick, className = '', ariaLabel, iconSize }: QrButtonProps): React.JSX.Element {
  return (
    <button
      type={'button'}
      onClick={onClick}
      aria-label={ariaLabel}
      className={`size-5 rounded-[.3125rem] flex items-center justify-center dash-block-5 hover:opacity-80 transition-opacity duration-200 cursor-pointer ${className}`}
    >
      <QrCodeIcon size={iconSize} color={'currentColor'} className={'dash-text-default opacity-50'} />
    </button>
  )
}
