import { describe, expect, it } from 'vitest'
import {
  identityKeysCountLabel,
  keysAddedLabel,
  keySelectionLabel,
  keysOnIdentityLabel,
  keyVariantTitle,
  presetKeyVariants,
  projectedKeyLabel,
  sortedIdentityKeys,
  toggleKeyVariant,
} from '../../src/renderer/src/utils/identityKeySetup'
import { IdentityKeyVariant } from '../../src/renderer/src/enums/IdentityKeys'
import { DASHPAY_KEY_BOUNDS } from '../../src/renderer/src/constants/dashPay'
import { IDENTITY_KEY_VARIANTS, KEY_VARIANT_GROUPS } from '../../src/renderer/src/constants/identityKeys'
import type { IdentityKeyDto } from '../../src/renderer/src/api/types'

function key(keyId: number, purpose: string, securityLevel: string, overrides: Partial<IdentityKeyDto> = {}): IdentityKeyDto {
  return { keyId, purpose, securityLevel, keyType: 'ECDSA_SECP256K1', data: '', readOnly: false, disabledAt: null, contractBounds: null, ...overrides }
}

const BASE_KEYS = [
  key(0, 'AUTHENTICATION', 'MASTER'),
  key(1, 'AUTHENTICATION', 'CRITICAL'),
  key(2, 'AUTHENTICATION', 'HIGH'),
  key(3, 'TRANSFER', 'CRITICAL'),
]

describe('key selection copy', () => {
  it('states the per-transaction limit, then how much of it is used', () => {
    expect(keySelectionLabel(0)).toBe('Up to 6 keys per transaction')
    expect(keySelectionLabel(2)).toBe('2 of 6 selected')
    expect(keySelectionLabel(6)).toBe('6 of 6 selected · limit per transaction')
  })

  it('counts keys on an identity', () => {
    expect(identityKeysCountLabel(1)).toBe('1 key')
    expect(identityKeysCountLabel(7)).toBe('7 keys')
  })
})

describe('key table order', () => {
  it('sorts by key id without mutating the input', () => {
    const keys = [key(2, 'AUTHENTICATION', 'HIGH'), key(0, 'AUTHENTICATION', 'MASTER'), key(1, 'VOTING', 'MEDIUM')]
    expect(sortedIdentityKeys(keys).map(entry => entry.keyId)).toEqual([0, 1, 2])
    expect(keys.map(entry => entry.keyId)).toEqual([2, 0, 1])
  })
})

describe('key variant selection', () => {
  it('keeps the selection in variant order', () => {
    const first = toggleKeyVariant([], IdentityKeyVariant.Transfer, true)
    const second = toggleKeyVariant(first, IdentityKeyVariant.EncDashPay, true)
    expect(second).toEqual([IdentityKeyVariant.EncDashPay, IdentityKeyVariant.Transfer])
    expect(toggleKeyVariant(second, IdentityKeyVariant.Transfer, false)).toEqual([IdentityKeyVariant.EncDashPay])
  })

  it('ignores a duplicate check', () => {
    expect(toggleKeyVariant([IdentityKeyVariant.Dec], IdentityKeyVariant.Dec, true)).toEqual([IdentityKeyVariant.Dec])
  })

  it('presets exactly the DashPay keys that are missing', () => {
    expect(presetKeyVariants(BASE_KEYS)).toEqual([IdentityKeyVariant.EncDashPay, IdentityKeyVariant.DecDashPay])
    expect(presetKeyVariants([key(0, 'AUTHENTICATION', 'MASTER')]))
      .toEqual([IdentityKeyVariant.EncDashPay, IdentityKeyVariant.DecDashPay, IdentityKeyVariant.AuthHigh])
  })

  it('presets nothing when unbound encryption keys already satisfy DashPay', () => {
    const keys = [...BASE_KEYS, key(4, 'ENCRYPTION', 'MEDIUM'), key(5, 'DECRYPTION', 'MEDIUM')]
    expect(presetKeyVariants(keys)).toEqual([])
  })

  it('presets AUTH HIGH when the only authentication key is a hash160 key', () => {
    const keys = [
      key(0, 'AUTHENTICATION', 'MASTER'),
      key(1, 'AUTHENTICATION', 'HIGH', { keyType: 'ECDSA_HASH160' }),
      key(2, 'ENCRYPTION', 'MEDIUM', { contractBounds: DASHPAY_KEY_BOUNDS }),
      key(3, 'DECRYPTION', 'MEDIUM', { contractBounds: DASHPAY_KEY_BOUNDS }),
    ]
    expect(presetKeyVariants(keys)).toEqual([IdentityKeyVariant.AuthHigh])
  })

  it('groups the eight variants into DashPay and other keys', () => {
    expect(KEY_VARIANT_GROUPS.map(group => group.definitions.map(definition => definition.variant))).toEqual([
      [IdentityKeyVariant.EncDashPay, IdentityKeyVariant.DecDashPay],
      [
        IdentityKeyVariant.AuthCritical,
        IdentityKeyVariant.AuthHigh,
        IdentityKeyVariant.AuthMedium,
        IdentityKeyVariant.Enc,
        IdentityKeyVariant.Dec,
        IdentityKeyVariant.Transfer,
      ],
    ])
  })

  it('titles a variant by purpose and level only', () => {
    expect(keyVariantTitle(IDENTITY_KEY_VARIANTS[IdentityKeyVariant.EncDashPay])).toBe('Encryption · Medium')
    expect(keyVariantTitle(IDENTITY_KEY_VARIANTS[IdentityKeyVariant.Transfer])).toBe('Transfer · Critical')
  })
})

describe('keys copy', () => {
  it('formats counts and names', () => {
    expect(keysOnIdentityLabel(1)).toBe('1 on identity')
    expect(keysAddedLabel(1)).toBe('1 key added')
    expect(keysAddedLabel(3)).toBe('3 keys added')
    expect(projectedKeyLabel(7, 'Encryption · Medium · DashPay')).toBe('#7 Encryption · Medium · DashPay')
  })
})
