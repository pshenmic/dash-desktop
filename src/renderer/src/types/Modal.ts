import type { ReactNode } from 'react'
import type { ModalActionTone } from '../enums/ModalActionTone'
import type { ModalSize } from '../enums/ModalSize'

export interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  description?: ReactNode
  size?: ModalSize
  dismissible?: boolean
  children: ReactNode
}

export interface ModalAction {
  label: ReactNode
  onClick: () => void
  disabled?: boolean
  loading?: boolean
}

export interface ModalActionsProps {
  primary: ModalAction
  secondary?: ModalAction
  tone?: ModalActionTone
}
