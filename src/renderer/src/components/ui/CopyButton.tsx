import { useEffect, useRef, useState } from 'react'
import { CopyIcon2 } from '@renderer/components/dash-ui-kit-enxtended/icons'
import { TooltipBubble } from '@renderer/components/dash-ui-kit-enxtended'
import type { CopyButtonProps } from '@renderer/types/CopyButton'

export default function CopyButton({ text, className = '', disabled = false, ariaLabel = 'Copy to clipboard' }: CopyButtonProps): React.JSX.Element {
  const [copiedRect, setCopiedRect] = useState<DOMRect | null>(null)
  const [feedback, setFeedback] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => clearTimeout(timer.current), [])

  const handleCopy = async (event: React.MouseEvent<HTMLButtonElement>): Promise<void> => {
    if (disabled) return
    const rect = event.currentTarget.getBoundingClientRect()
    try {
      await navigator.clipboard.writeText(text)
      setFeedback('Copied!')
    } catch {
      setFeedback('Could not copy to clipboard')
    }
    setCopiedRect(rect)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopiedRect(null), 1200)
  }

  return (
    <>
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={handleCopy}
        disabled={disabled}
        className={`size-5 rounded-[.3125rem] flex items-center justify-center dash-block-5 hover:opacity-80 transition-opacity duration-200 cursor-pointer disabled:pointer-events-none disabled:opacity-30 ${className}`}
      >
        <CopyIcon2 color={'currentColor'} className={'dash-text-default opacity-50'} />
      </button>
      <span role="status" className="sr-only">{feedback}</span>
      {copiedRect && <TooltipBubble rect={copiedRect} label={feedback} animate />}
    </>
  )
}
