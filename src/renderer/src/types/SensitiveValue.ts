import type { ReactNode } from 'react'

export type SensitiveValueSize = 'hero' | 'card' | 'sidebar' | 'compact' | 'subtext'

export type SensitiveValueTone = 'default' | 'accent' | 'inverse'

export interface SensitiveValueProps {
  children: ReactNode
  hidden: boolean
  size: SensitiveValueSize
  tone?: SensitiveValueTone
  label?: string
  className?: string
}
