import type { DashpayContactStatus, DashpayPerson, DemoTone } from './dashpayDemo'

export interface DashpayContactTab {
  status: DashpayContactStatus
  label: string
  title: string
  description: string
  emptyTitle: string
  emptyDescription: string
}

export interface DashpayContactPresentation {
  label: string
  description: string
  tone: DemoTone
}

export interface DashpayContactRowProps {
  person: DashpayPerson
  status: DashpayContactStatus | null
  owned: boolean
  onOpen: () => void
  onAccept?: () => void
  onIgnore?: () => void
}
