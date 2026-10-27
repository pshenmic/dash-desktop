import type { ReactNode } from 'react'

export interface WizardStep {
  label: string
  content: ReactNode
  canAdvance?: boolean
}

export interface TransferWizardProps {
  steps: WizardStep[]
  onSubmit: () => void
  submitLabel?: string
  submitDisabled?: boolean
  onStepChange?: (index: number) => void
}
