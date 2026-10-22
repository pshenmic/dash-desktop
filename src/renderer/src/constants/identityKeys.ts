import { IdentityKeyPurpose, IdentityKeySecurityLevel, IdentityKeyVariant } from '@renderer/enums/DashPay'
import type { IdentityKeyVariantDefinition } from '@renderer/types/IdentityKeys'

export const IDENTITY_KEY_TYPE_ECDSA = 'ECDSA_SECP256K1'

export const IDENTITY_KEY_LABEL_SEPARATOR = ' · '

export const DASHPAY_BOUNDS_LABEL = 'DashPay'

const DASHPAY_BOUND_CAPTION = 'Bound to DashPay contact requests'

const UNBOUND_CAPTION = 'Not bound'

export const IDENTITY_KEY_VARIANTS: Record<IdentityKeyVariant, IdentityKeyVariantDefinition> = {
  [IdentityKeyVariant.EncDashPay]: { variant: IdentityKeyVariant.EncDashPay, purpose: IdentityKeyPurpose.Encryption, securityLevel: IdentityKeySecurityLevel.Medium, dashPayBound: true, caption: DASHPAY_BOUND_CAPTION },
  [IdentityKeyVariant.DecDashPay]: { variant: IdentityKeyVariant.DecDashPay, purpose: IdentityKeyPurpose.Decryption, securityLevel: IdentityKeySecurityLevel.Medium, dashPayBound: true, caption: DASHPAY_BOUND_CAPTION },
  [IdentityKeyVariant.AuthCritical]: { variant: IdentityKeyVariant.AuthCritical, purpose: IdentityKeyPurpose.Authentication, securityLevel: IdentityKeySecurityLevel.Critical, dashPayBound: false, caption: null },
  [IdentityKeyVariant.AuthHigh]: { variant: IdentityKeyVariant.AuthHigh, purpose: IdentityKeyPurpose.Authentication, securityLevel: IdentityKeySecurityLevel.High, dashPayBound: false, caption: null },
  [IdentityKeyVariant.AuthMedium]: { variant: IdentityKeyVariant.AuthMedium, purpose: IdentityKeyPurpose.Authentication, securityLevel: IdentityKeySecurityLevel.Medium, dashPayBound: false, caption: null },
  [IdentityKeyVariant.Enc]: { variant: IdentityKeyVariant.Enc, purpose: IdentityKeyPurpose.Encryption, securityLevel: IdentityKeySecurityLevel.Medium, dashPayBound: false, caption: UNBOUND_CAPTION },
  [IdentityKeyVariant.Dec]: { variant: IdentityKeyVariant.Dec, purpose: IdentityKeyPurpose.Decryption, securityLevel: IdentityKeySecurityLevel.Medium, dashPayBound: false, caption: UNBOUND_CAPTION },
  [IdentityKeyVariant.Transfer]: { variant: IdentityKeyVariant.Transfer, purpose: IdentityKeyPurpose.Transfer, securityLevel: IdentityKeySecurityLevel.Critical, dashPayBound: false, caption: 'Credit transfers and withdrawals' },
}

export const IDENTITY_KEY_PURPOSE_LABELS: Record<string, string> = {
  AUTHENTICATION: 'Authentication',
  ENCRYPTION: 'Encryption',
  DECRYPTION: 'Decryption',
  TRANSFER: 'Transfer',
}

export const IDENTITY_KEY_LEVEL_LABELS: Record<string, string> = {
  MASTER: 'Master',
  CRITICAL: 'Critical',
  HIGH: 'High',
  MEDIUM: 'Medium',
}

export const IDENTITY_KEY_TYPE_LABELS: Record<string, string> = {
  ECDSA_SECP256K1: 'ECDSA secp256k1',
  BLS12_381: 'BLS12-381',
  ECDSA_HASH160: 'ECDSA hash160',
  BIP13_SCRIPT_HASH: 'BIP13 script hash',
  EDDSA_25519_HASH160: 'EdDSA 25519 hash160',
}

export const IDENTITY_KEY_TABLE_GRID = 'grid-cols-[2.5rem_minmax(0,1.1fr)_minmax(0,.8fr)_minmax(0,1fr)_minmax(0,1.5fr)_5rem]'
