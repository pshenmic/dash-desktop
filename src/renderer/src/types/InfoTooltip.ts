import type { ReactNode } from 'react'

export interface InfoTooltipProps {
  content: ReactNode
  ariaLabel?: string
  side?: 'right' | 'top' | 'bottom'
  className?: string
  tooltipClassName?: string
}
