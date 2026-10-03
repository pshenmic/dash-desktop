import type { ReactNode } from 'react'

export interface SettingsRowProps {
  title: string
  description: string
  control?: ReactNode
  actionLabel?: string
  pendingLabel?: string
  pending?: boolean
  disabled?: boolean
  destructive?: boolean
  onClick?: () => void
}
