import {useCallback, useEffect, useId, useLayoutEffect, useRef, useState} from 'react'
import {createPortal} from 'react-dom'
import type {InfoTooltipProps} from '@renderer/types/InfoTooltip'
import {InfoCircleIcon} from '../icons'

export function InfoTooltip({
  content,
  ariaLabel = 'Show information',
  side = 'right',
  className = '',
  tooltipClassName = '',
}: InfoTooltipProps): React.JSX.Element {
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null)
  const [position, setPosition] = useState<{left: number; top: number} | null>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const hoveredRef = useRef(false)
  const focusedRef = useRef(false)
  const tooltipId = useId()

  const show = useCallback((target: HTMLElement) => {
    setPosition(null)
    setAnchorRect(target.getBoundingClientRect())
  }, [])

  const hide = useCallback(() => {
    setAnchorRect(null)
    setPosition(null)
  }, [])

  useLayoutEffect(() => {
    if (!anchorRect || !tooltipRef.current) return

    const tooltipRect = tooltipRef.current.getBoundingClientRect()
    let left = anchorRect.left + anchorRect.width / 2 - tooltipRect.width / 2
    let top = side === 'top'
      ? anchorRect.top - tooltipRect.height - 8
      : anchorRect.bottom + 8

    if (side === 'right') {
      left = anchorRect.right + 10
      top = anchorRect.top + anchorRect.height / 2 - tooltipRect.height / 2
      if (left + tooltipRect.width > window.innerWidth - 8) {
        left = anchorRect.left - tooltipRect.width - 10
      }
    }

    setPosition({
      left: Math.max(8, Math.min(left, window.innerWidth - tooltipRect.width - 8)),
      top: Math.max(8, Math.min(top, window.innerHeight - tooltipRect.height - 8)),
    })
  }, [anchorRect, side])

  useEffect(() => {
    if (!anchorRect) return
    window.addEventListener('resize', hide)
    window.addEventListener('scroll', hide, true)
    return () => {
      window.removeEventListener('resize', hide)
      window.removeEventListener('scroll', hide, true)
    }
  }, [anchorRect, hide])

  return (
    <>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-describedby={anchorRect ? tooltipId : undefined}
        onMouseEnter={(event) => {
          hoveredRef.current = true
          show(event.currentTarget)
        }}
        onMouseLeave={() => {
          hoveredRef.current = false
          if (!focusedRef.current) hide()
        }}
        onFocus={(event) => {
          focusedRef.current = true
          show(event.currentTarget)
        }}
        onBlur={() => {
          focusedRef.current = false
          if (!hoveredRef.current) hide()
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') hide()
        }}
        className={`
          inline-flex size-5 shrink-0 cursor-help items-center justify-center rounded-full
          text-dash-primary-dark-blue/45 transition-colors hover:text-dash-brand
          focus:outline-none focus:ring-2 focus:ring-dash-brand/30
          dark:text-white/45 dark:hover:text-dash-mint dark:focus:ring-dash-mint/30
          ${className}
        `}
      >
        <InfoCircleIcon size={18} color="currentColor" />
      </button>

      {anchorRect && createPortal(
        <div
          ref={tooltipRef}
          id={tooltipId}
          role="tooltip"
          style={{
            position: 'fixed',
            left: position?.left ?? 0,
            top: position?.top ?? 0,
            visibility: position ? 'visible' : 'hidden',
          }}
          className="pointer-events-none z-[1000]"
        >
          <div
            className={`
              max-w-[22rem] whitespace-normal rounded-[.875rem]
              border border-dash-primary-dark-blue/10 bg-white px-4 py-3
              text-[12px] font-medium leading-[1.4] text-dash-primary-dark-blue/70
              shadow-[0_16px_40px_rgba(12,28,51,0.18)]
              dark:border-white/10 dark:bg-[#2f5e9e]/95 dark:text-white/75
              ${tooltipClassName}
            `}
          >
            {content}
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}

export type {InfoTooltipProps} from '@renderer/types/InfoTooltip'
export default InfoTooltip
