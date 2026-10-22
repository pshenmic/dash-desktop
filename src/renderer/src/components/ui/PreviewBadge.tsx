import { useId, useRef, useState } from 'react'
import { Tooltip } from '@renderer/components/dash-ui-kit-enxtended'
import CustomBadge from '@renderer/components/ui/CustomBadge'
import { useClickOutside } from '@renderer/hooks/useClickOutside'
import { PREVIEW_BADGE_COPY } from '@renderer/constants/masternodePreview'
import { PREVIEW_BADGE_BUTTON_CLASS, PREVIEW_BADGE_POPOVER_CLASS } from '@renderer/constants/previewBadge'
import type { PreviewBadgeProps } from '@renderer/types/PreviewBadge'

export default function PreviewBadge({ controls }: PreviewBadgeProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const popoverId = useId()
  useClickOutside(rootRef, () => setOpen(false))

  const closeOnEscape = (event: React.KeyboardEvent): void => {
    if (event.key !== 'Escape' || !open) return
    event.stopPropagation()
    setOpen(false)
    buttonRef.current?.focus()
  }

  return (
    <div ref={rootRef} className={'relative inline-flex shrink-0'} onKeyDown={closeOnEscape}>
      <Tooltip label={open ? undefined : PREVIEW_BADGE_COPY.tooltip}>
        <button
          ref={buttonRef}
          type={'button'}
          aria-expanded={open}
          aria-controls={open ? popoverId : undefined}
          onClick={() => setOpen(value => !value)}
          className={PREVIEW_BADGE_BUTTON_CLASS}
        >
          <CustomBadge variant={'muted'} text={PREVIEW_BADGE_COPY.label} />
        </button>
      </Tooltip>
      {open && <div id={popoverId} className={PREVIEW_BADGE_POPOVER_CLASS}>{controls}</div>}
    </div>
  )
}
