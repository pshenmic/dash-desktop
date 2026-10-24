import type { ReactNode } from 'react'

export interface PhaseProgressStep {
  key: string
  label: string
  extra?: ReactNode
}

export interface PhaseProgressListProps {
  phases: ReadonlyArray<PhaseProgressStep>
  current: number
  className?: string
}
