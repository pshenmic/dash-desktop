import type { HTMLAttributes } from 'react'

export interface DashboardHeadingProps extends HTMLAttributes<HTMLHeadingElement> {
  as?: 'h2' | 'h3'
  inverse?: boolean
}
