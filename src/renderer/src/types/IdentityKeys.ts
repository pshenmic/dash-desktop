import type { IdentityKeyPurpose, IdentityKeySecurityLevel, IdentityKeyVariant } from '@renderer/enums/DashPay'

export interface IdentityKeyVariantDefinition {
  variant: IdentityKeyVariant
  purpose: IdentityKeyPurpose
  securityLevel: IdentityKeySecurityLevel
  dashPayBound: boolean
  caption: string | null
}

export interface KeySelectionCheck {
  used: number
  slotsLeft: number
  leftAfter: number
  overLimit: boolean
  empty: boolean
}

export interface KeyBoundsLabel {
  text: string
  isDashPay: boolean
}
