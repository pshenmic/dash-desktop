import type { ReactNode } from 'react'
import type { ModalSize } from '../enums/ModalSize'
import type { SignedActionDoneTone } from '../enums/SignedActionDoneTone'
import type { ModalAction } from './Modal'

export interface SignedActionEditStep {
  content: ReactNode
  continueLabel: string
  canContinue: boolean
}

export interface SignedActionControls {
  restart: () => void
  close: () => void
}

export interface SignedActionDetail {
  label: string
  value: ReactNode
}

export interface SignedActionHash {
  value: string
  label: string
  explorerUrl: string | null
}

export interface SignedActionDoneView {
  tone?: SignedActionDoneTone
  headline: ReactNode
  note?: ReactNode
  details?: SignedActionDetail[]
  body?: ReactNode
  hash?: SignedActionHash
  secondary?: ModalAction
}

export interface SignedActionResult<R> {
  value: R
}

export interface SignedActionModalProps<R> {
  open: boolean
  onClose: () => void
  title: string
  description?: ReactNode
  contextLine?: ReactNode
  edit?: SignedActionEditStep
  summary: ReactNode
  shortfall?: ReactNode
  confirmLabel: string
  confirmDisabled?: boolean
  pendingLabel: string
  run: (password: string) => Promise<R>
  renderDone: (result: R, controls: SignedActionControls) => SignedActionDoneView
  onDone?: (result: R) => void
  size?: ModalSize
}
