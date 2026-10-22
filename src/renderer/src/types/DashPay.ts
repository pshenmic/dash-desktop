import type { DashPayContactDto, IdentityKeyRequestDto } from '@renderer/api/types'
import type { IdentityApiDto } from '@renderer/hooks/useIdentities'
import type { ActiveIdentitySource, ContactSegment, DashPayReadiness, DashPaySetupStep, SetupStepState } from '@renderer/enums/DashPay'
import type { ListGroup } from './ListWindow'

export interface DashPayReadinessInfo {
  readiness: DashPayReadiness
  canSend: boolean
  canRegister: boolean
  missingKeys: IdentityKeyRequestDto[]
  slotsUsed: number
  slotsLeft: number
}

export interface ActiveIdentityInput {
  identities: IdentityApiDto[]
  requested: string | null
  stored: string | null
}

export interface ActiveIdentityResolution {
  identity: IdentityApiDto | null
  source: ActiveIdentitySource
}

export interface ContactRowModel {
  contact: DashPayContactDto
  name: string | null
  extraNames: number
  isWalletIdentity: boolean
  payable: boolean
  lastActivity: number
}

export type ContactGroup = ListGroup<DashPayContactDto>

export type ContactSegmentCounts = Record<ContactSegment, number>

export interface PaymentTotals {
  sent: bigint
  received: bigint
}

export interface DashPayNavigationState {
  returnTo?: string
}

export interface SetupStepModel {
  step: DashPaySetupStep
  state: SetupStepState
  caption: string
}

export interface RegistrationReturnDestination {
  path: string
  backLabel: string
}
