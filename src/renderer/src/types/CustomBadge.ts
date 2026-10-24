import type { ReactNode } from 'react'
import type { BadgeProps } from '@renderer/components/dash-ui-kit-enxtended/badge'

export type CustomBadgeVariant = 'default' | 'error' | 'muted' | 'accent'

export type CustomBadgeColors = Pick<BadgeProps, 'variant' | 'color' | 'colorLight' | 'colorDark' | 'className'>

export interface CustomBadgeProps {
  variant?: CustomBadgeVariant
  text: string
  icon?: ReactNode
  size?: BadgeProps['size']
  className?: string
}
