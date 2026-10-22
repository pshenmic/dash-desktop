import { describe, expect, it } from 'vitest'
import {
  creditsShortfallLabel,
  dashPayEnabledHeadline,
  enableDashPayDescription,
  keySlotPercent,
  keySlotsLeftAfterLabel,
  keySlotsLeftLabel,
  keySlotsUsedLabel,
  keysAddedLabel,
  keysOnIdentityLabel,
  keysShortfall,
  keysShortfallMessage,
  keyVariantTitle,
  presetKeyVariants,
  projectedKeyLabel,
  sortedIdentityKeys,
  toggleKeyVariant,
} from '../../src/renderer/src/utils/dashPayKeySetup'
import { IdentityKeyVariant, KeysShortfallKind } from '../../src/renderer/src/enums/DashPay'
import { DASHPAY_KEY_BOUNDS } from '../../src/renderer/src/constants/dashPay'
import { KEY_VARIANT_GROUPS } from '../../src/renderer/src/constants/dashPayKeys'
import { IDENTITY_KEY_VARIANTS } from '../../src/renderer/src/constants/identityKeys'
import type { IdentityKeyDto } from '../../src/renderer/src/api/types'

function key(keyId: number, purpose: string, securityLevel: string, overrides: Partial<IdentityKeyDto> = {}): IdentityKeyDto {
  return { keyId, purpose, securityLevel, keyType: 'ECDSA_SECP256K1', disabled: false, contractBounds: null, ...overrides }
}

const BASE_KEYS = [
  key(0, 'AUTHENTICATION', 'MASTER'),
  key(1, 'AUTHENTICATION', 'CRITICAL'),
  key(2, 'AUTHENTICATION', 'HIGH'),
  key(3, 'TRANSFER', 'CRITICAL'),
]

describe('key slot meter', () => {
  it('maps used slots to a clamped percentage', () => {
    expect(keySlotPercent(0)).toBe(0)
    expect(keySlotPercent(4)).toBe(20)
    expect(keySlotPercent(20)).toBe(100)
    expect(keySlotPercent(25)).toBe(100)
  })

  it('labels used and remaining slots', () => {
    expect(keySlotsUsedLabel(4)).toBe('4 of 20 key slots used')
    expect(keySlotsLeftAfterLabel(14)).toBe('· 14 left after this')
    expect(keySlotsLeftLabel(2)).toBe('Only 2 key slots left.')
    expect(keySlotsLeftLabel(1)).toBe('Only 1 key slot left.')
    expect(keySlotsLeftLabel(0)).toBe('No key slots left.')
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

describe('keys shortfall', () => {
  const base = { requested: 2, slotsLeft: 16, feeCredits: 1_000n, feeError: null, balance: 5_000n }

  it('is null when the identity can pay and has room', () => {
    expect(keysShortfall(base)).toBeNull()
    expect(keysShortfall({ ...base, feeCredits: null })).toBeNull()
    expect(keysShortfall({ ...base, balance: 1_000n })).toBeNull()
  })

  it('reports missing slots before anything else', () => {
    expect(keysShortfall({ ...base, requested: 3, slotsLeft: 2, feeError: 'Failed' })).toEqual({ kind: KeysShortfallKind.Slots, slotsLeft: 2 })
  })

  it('reports a fee error before the balance', () => {
    expect(keysShortfall({ ...base, feeError: 'Failed', balance: 0n })).toEqual({ kind: KeysShortfallKind.FeeError })
  })

  it('reports how many credits are missing', () => {
    expect(keysShortfall({ ...base, balance: 400n })).toEqual({ kind: KeysShortfallKind.Balance, missingCredits: 600n })
  })

  it('words each shortfall', () => {
    expect(keysShortfallMessage({ kind: KeysShortfallKind.Slots, slotsLeft: 1 }, 'alice.dash')).toBe('Only 1 key slot left.')
    expect(keysShortfallMessage({ kind: KeysShortfallKind.FeeError }, 'alice.dash')).toBe('Couldn’t get the fee')
    expect(keysShortfallMessage({ kind: KeysShortfallKind.Balance, missingCredits: 50_000_000_000n }, 'alice.dash'))
      .toBe('alice.dash needs 0.5 Dash more.')
    expect(creditsShortfallLabel('bob.dash', 100_000_000_000n)).toBe('bob.dash needs 1 Dash more.')
  })
})

describe('keys copy', () => {
  it('formats counts and names', () => {
    expect(keysOnIdentityLabel(1)).toBe('1 on identity')
    expect(keysAddedLabel(1)).toBe('1 key added')
    expect(keysAddedLabel(3)).toBe('3 keys added')
    expect(projectedKeyLabel(7, 'Encryption · Medium · DashPay')).toBe('#7 Encryption · Medium · DashPay')
    expect(enableDashPayDescription('alice.dash')).toBe('Adds the keys alice.dash needs for contacts.')
    expect(dashPayEnabledHeadline('alice.dash')).toBe('DashPay enabled for alice.dash')
  })
})
