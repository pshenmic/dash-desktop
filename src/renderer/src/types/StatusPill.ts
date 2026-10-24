import type { ReactNode } from 'react'
import type { StatusPillTone } from '../enums/StatusPillTone'

export interface StatusPillProps {
  tone: StatusPillTone
  children: ReactNode
  loading?: boolean
}
