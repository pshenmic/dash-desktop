import type { ReactNode } from 'react'

export interface PasswordFieldProps {
  id: string
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  error?: string | null
  hint?: ReactNode
  label?: string
  disabled?: boolean
  className?: string
}
