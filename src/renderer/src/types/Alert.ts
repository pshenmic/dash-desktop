import type { ReactNode } from 'react'
import type { AlertTone } from '../enums/AlertTone'

export interface AlertProps {
  tone: AlertTone
  icon: ReactNode
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  className?: string
}

export interface AlertToneStyles {
  surface: string
  accent: string
  title: string
}
