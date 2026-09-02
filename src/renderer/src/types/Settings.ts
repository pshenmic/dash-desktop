import type { ReactNode } from 'react'

export interface SettingsDetailHeaderProps {
  primary: string
  secondary: string
}

export interface SettingsHubIconProps {
  icon: string
}

export interface SettingsSectionProps {
  title: string
  children: ReactNode
}

export interface SettingsRowProps {
  title: string
  description?: string
  control?: ReactNode
  actionLabel?: string
  pendingLabel?: string
  pending?: boolean
  disabled?: boolean
  destructive?: boolean
  onClick?: () => void
}
