import type { ReactNode } from 'react'

export type DashpayTab = 'overview' | 'names' | 'contacts'
export type DashpayScenario = 'ready' | 'new' | 'unnamed' | 'pending' | 'empty' | 'loading' | 'error'
export type DashpayNameStatus = 'registered' | 'voting' | 'locked' | 'lost'
export type DashpayContactStatus = 'contact' | 'incoming' | 'outgoing'
export type DemoTone = 'blue' | 'mint' | 'amber' | 'red' | 'neutral'

export interface DashpayIdentity {
  id: string
  label: string
  credits: bigint
}

export interface DashpayName {
  id: string
  identityId: string
  label: string
  status: DashpayNameStatus
  endsAt?: string
}

export interface DashpayPerson {
  id: string
  username: string
  displayName: string
  bio: string
}

export interface DashpayContact {
  identityId: string
  personId: string
  status: DashpayContactStatus
}

export interface DashpayDemoState {
  scenario: DashpayScenario
  identities: DashpayIdentity[]
  selectedIdentityId: string
  names: DashpayName[]
  contacts: DashpayContact[]
}

export type DashpayDemoAction =
  | { type: 'scenario'; scenario: DashpayScenario }
  | { type: 'selectIdentity'; identityId: string }
  | { type: 'createIdentity' }
  | { type: 'registerName'; label: string }
  | { type: 'sendRequest'; personId: string }
  | { type: 'acceptRequest'; personId: string }
  | { type: 'ignoreRequest'; personId: string }

export interface DashpayNameCheck {
  label: string
  normalizedLabel: string
  status: 'invalid' | 'taken' | 'available' | 'contested' | 'locked'
  message: string
}

export interface DashpayDemoContextValue {
  state: DashpayDemoState
  identity: DashpayIdentity | null
  selectIdentity: (identityId: string) => void
  setScenario: (scenario: DashpayScenario) => void
  createIdentity: () => void
  registerName: (label: string) => void
  sendRequest: (personId: string) => void
  acceptRequest: (personId: string) => void
  ignoreRequest: (personId: string) => void
}

export interface DemoChildrenProps {
  children: ReactNode
}

export interface DemoModalProps extends DemoChildrenProps {
  title: string
  description?: string
  onClose: () => void
  wide?: boolean
}

export interface DemoBadgeProps extends DemoChildrenProps {
  tone?: DemoTone
}

export interface DemoCardProps extends DemoChildrenProps {
  className?: string
}

export interface DemoEmptyProps {
  title: string
  description: string
  action?: ReactNode
}

export interface DemoAvatarProps {
  label: string
  large?: boolean
}

export interface DemoNoticeProps extends DemoChildrenProps {
  tone?: DemoTone
}

export interface DashpayNamesProps {
  initialSearch?: string
  onContact: () => void
}

export interface DashpayRegisterNameProps {
  onClose: () => void
  onRegistered?: () => void
}

export interface DashpayPersonModalProps {
  person: DashpayPerson
  onClose: () => void
}

export interface DashpayOverviewProps {
  onRegister: () => void
  onJoin: () => void
  onTab: (tab: DashpayTab) => void
  onSearch: (query: string) => void
}
