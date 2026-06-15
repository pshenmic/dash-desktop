import { useEffect, useRef, useState } from 'react'
import { CopyIcon2 } from '@renderer/components/dash-ui-kit-enxtended/icons'
import { TooltipBubble } from '@renderer/components/dash-ui-kit-enxtended'

type CopyButtonProps = {
  text: string
  className?: string
}

export default function CopyButton({ text, className = '' }: CopyButtonProps): React.JSX.Element {
  const [copiedRect, setCopiedRect] = useState<DOMRect | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => clearTimeout(timer.current), [])

  const handleCopy = (event: React.MouseEvent<HTMLButtonElement>): void => {
    navigator.clipboard.writeText(text)
    setCopiedRect(event.currentTarget.getBoundingClientRect())
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopiedRect(null), 1200)
  }

  return (
    <>
      <button
        onClick={handleCopy}
        className={`size-5 rounded-[.3125rem] flex items-center justify-center dash-block-5 hover:opacity-80 transition-opacity duration-200 cursor-pointer ${className}`}
      >
        <CopyIcon2 color={'currentColor'} className={'dash-text-default opacity-50'} />
      </button>
      {copiedRect && <TooltipBubble rect={copiedRect} label={"Copied!"} animate />}
    </>
  )
}
