import { describe, expect, it } from 'vitest'
import {
  keyBoundsLabel,
  keyLabel,
  keyRequestLabel,
  keysMatchingVariant,
  nextIdentityKeyId,
  projectedKeyIds,
  validateKeySelection,
  variantOfRequest,
  variantRequest,
} from '../../src/renderer/src/utils/identityKeyRequests'
import { IdentityKeyPurpose, IdentityKeySecurityLevel, IdentityKeyVariant } from '../../src/renderer/src/enums/IdentityKeys'
import { DASHPAY_KEY_BOUNDS } from '../../src/renderer/src/constants/dashPay'
import { IDENTITY_KEY_PURPOSE_LABELS, IDENTITY_KEY_VARIANTS } from '../../src/renderer/src/constants/identityKeys'
import type { IdentityKeyDto } from '../../src/renderer/src/api/types'

function key(keyId: number, purpose: string, securityLevel: string, overrides: Partial<IdentityKeyDto> = {}): IdentityKeyDto {
  return { keyId, purpose, securityLevel, keyType: 'ECDSA_SECP256K1', disabled: false, contractBounds: null, ...overrides }
}

const DEFAULT_KEYS = [
  key(0, 'AUTHENTICATION', 'MASTER'),
  key(1, 'AUTHENTICATION', 'CRITICAL'),
  key(2, 'AUTHENTICATION', 'HIGH'),
  key(3, 'ENCRYPTION', 'MEDIUM', { contractBounds: DASHPAY_KEY_BOUNDS }),
  key(4, 'DECRYPTION', 'MEDIUM', { contractBounds: DASHPAY_KEY_BOUNDS }),
  key(5, 'TRANSFER', 'CRITICAL'),
]

const VALID_PAIRINGS = new Set([
  'AUTHENTICATION:CRITICAL',
  'AUTHENTICATION:HIGH',
  'AUTHENTICATION:MEDIUM',
  'ENCRYPTION:MEDIUM',
  'DECRYPTION:MEDIUM',
  'TRANSFER:CRITICAL',
])

describe('identity key variants', () => {
  it('offers only pairings Drive accepts and never a MASTER key', () => {
    for (const variant of Object.values(IdentityKeyVariant)) {
      const request = variantRequest(variant)
      expect(VALID_PAIRINGS.has(`${request.purpose}:${request.securityLevel}`)).toBe(true)
    }
  })

  it('binds only the DashPay variants to the contactRequest document', () => {
    expect(variantRequest(IdentityKeyVariant.EncDashPay)).toEqual({
      purpose: IdentityKeyPurpose.Encryption,
      securityLevel: IdentityKeySecurityLevel.Medium,
      contractBounds: DASHPAY_KEY_BOUNDS,
    })
    expect(variantRequest(IdentityKeyVariant.Enc).contractBounds).toBeNull()
    expect(variantRequest(IdentityKeyVariant.AuthHigh)).toEqual({
      purpose: IdentityKeyPurpose.Authentication,
      securityLevel: IdentityKeySecurityLevel.High,
      contractBounds: null,
    })
  })

  it('lists eight distinct variants with the DashPay ones first', () => {
    const definitions = Object.values(IDENTITY_KEY_VARIANTS)
    expect(definitions).toHaveLength(8)
    expect(definitions.slice(0, 2).map(entry => entry.variant)).toEqual([IdentityKeyVariant.EncDashPay, IdentityKeyVariant.DecDashPay])
    expect(new Set(definitions.map(entry => JSON.stringify(variantRequest(entry.variant)))).size).toBe(8)
  })

  it('maps a request back to its variant', () => {
    for (const variant of Object.values(IdentityKeyVariant)) {
      expect(variantOfRequest(variantRequest(variant))).toBe(variant)
    }
    expect(variantOfRequest({ purpose: IdentityKeyPurpose.Transfer, securityLevel: IdentityKeySecurityLevel.Medium, contractBounds: null })).toBeNull()
  })

  it('counts the enabled keys an identity already has of a variant', () => {
    const keys = [...DEFAULT_KEYS, key(6, 'ENCRYPTION', 'MEDIUM'), key(7, 'AUTHENTICATION', 'HIGH', { disabled: true })]
    expect(keysMatchingVariant(keys, IdentityKeyVariant.EncDashPay)).toBe(1)
    expect(keysMatchingVariant(keys, IdentityKeyVariant.Enc)).toBe(1)
    expect(keysMatchingVariant(keys, IdentityKeyVariant.AuthHigh)).toBe(1)
    expect(keysMatchingVariant(keys, IdentityKeyVariant.AuthMedium)).toBe(0)
  })
})

describe('validateKeySelection', () => {
  const variants = Object.values(IdentityKeyVariant)

  it('allows up to six keys in one transaction', () => {
    expect(validateKeySelection(variants.slice(0, 2))).toEqual({ count: 2, atLimit: false, overLimit: false, empty: false })
    expect(validateKeySelection(variants.slice(0, 6))).toEqual({ count: 6, atLimit: true, overLimit: false, empty: false })
  })

  it('flags a selection over the limit and an empty one', () => {
    expect(validateKeySelection(variants.slice(0, 7))).toMatchObject({ count: 7, overLimit: true })
    expect(validateKeySelection([])).toMatchObject({ count: 0, empty: true, atLimit: false })
  })
})

describe('nextIdentityKeyId', () => {
  it('continues after the highest key id, with no cap', () => {
    expect(nextIdentityKeyId([])).toBe(0)
    expect(nextIdentityKeyId(DEFAULT_KEYS)).toBe(6)
    expect(nextIdentityKeyId([key(0, 'AUTHENTICATION', 'MASTER'), key(41, 'AUTHENTICATION', 'MEDIUM')])).toBe(42)
  })
})

describe('key labels', () => {
  it('labels known values case-insensitively and falls back to the raw string', () => {
    expect(keyLabel('encryption', IDENTITY_KEY_PURPOSE_LABELS)).toBe('Encryption')
    expect(keyLabel('VOTING', IDENTITY_KEY_PURPOSE_LABELS)).toBe('VOTING')
  })

  it('names a request with its bound contract', () => {
    expect(keyRequestLabel(variantRequest(IdentityKeyVariant.EncDashPay))).toBe('Encryption · Medium · DashPay')
    expect(keyRequestLabel(variantRequest(IdentityKeyVariant.AuthHigh))).toBe('Authentication · High')
  })

  it('names a request bound to another contract by its full id', () => {
    const contractBounds = { contractId: 'GWRSAVFMjXx8HpQFaNJMqBV7MBgMK4br5UESsB4S31Ec', documentType: 'domain' }
    expect(keyRequestLabel({ ...variantRequest(IdentityKeyVariant.AuthHigh), contractBounds }))
      .toBe('Authentication · High · GWRSAVFMjXx8HpQFaNJMqBV7MBgMK4br5UESsB4S31Ec')
  })

  it('labels DashPay bounds, other contracts by full id, and no bounds as null', () => {
    expect(keyBoundsLabel(DASHPAY_KEY_BOUNDS)).toEqual({ text: 'DashPay · contactRequest', isDashPay: true })
    expect(keyBoundsLabel({ contractId: 'GWRSAVFMjXx8HpQFaNJMqBV7MBgMK4br5UESsB4S31Ec', documentType: 'domain' }))
      .toEqual({ text: 'GWRSAVFMjXx8HpQFaNJMqBV7MBgMK4br5UESsB4S31Ec · domain', isDashPay: false })
    expect(keyBoundsLabel({ contractId: 'GWRSAVFMjXx8HpQFaNJMqBV7MBgMK4br5UESsB4S31Ec', documentType: null }))
      .toEqual({ text: 'GWRSAVFMjXx8HpQFaNJMqBV7MBgMK4br5UESsB4S31Ec', isDashPay: false })
    expect(keyBoundsLabel(null)).toBeNull()
  })
})

describe('projectedKeyIds', () => {
  it('continues after the highest existing key id', () => {
    expect(projectedKeyIds(DEFAULT_KEYS, 2)).toEqual([6, 7])
    expect(projectedKeyIds([key(0, 'AUTHENTICATION', 'MASTER'), key(9, 'TRANSFER', 'CRITICAL')], 2)).toEqual([10, 11])
    expect(projectedKeyIds([], 0)).toEqual([])
  })
})
