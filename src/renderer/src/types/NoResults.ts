import type { ReactNode } from 'react'
import type { NoResultsTone } from '../enums/NoResultsTone'

interface NoResultsDetails {
  description?: ReactNode
  action?: ReactNode
  tone?: NoResultsTone
}

export type NoResultsProps = NoResultsDetails & (
  | { title: ReactNode; noResults?: never }
  | { noResults: string; title?: never }
)
