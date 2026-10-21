import type { ReactNode } from 'react'

export interface PageHeaderProps {
  title: string
  subtitle: string
  actions?: ReactNode
  icon?: ReactNode
  onBack?: () => void
  backLabel?: string
  className?: string
}
