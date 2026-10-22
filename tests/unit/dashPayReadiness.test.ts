import { describe, expect, it } from 'vitest'
import { dashPayMissingKeys, dashPayReadiness, keySlotsUsed, setupSteps } from '../../src/renderer/src/utils/dashPayReadiness'
import { DashPayReadiness, DashPaySetupStep, IdentityKeyPurpose, IdentityKeySecurityLevel, SetupStepState } from '../../src/renderer/src/enums/DashPay'
import { DASHPAY_KEY_BOUNDS, DASHPAY_SETUP_COPY } from '../../src/renderer/src/constants/dashPay'
import type { IdentityKeyDto } from '../../src/renderer/src/api/types'
import type { IdentityApiDto } from '../../src/renderer/src/hooks/useIdentities'

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

const LEGACY_KEYS = [
  key(0, 'AUTHENTICATION', 'MASTER'),
  key(1, 'AUTHENTICATION', 'CRITICAL'),
  key(2, 'AUTHENTICATION', 'HIGH'),
  key(3, 'TRANSFER', 'CRITICAL'),
]

function identity(keys: IdentityKeyDto[], aliasesList: string[] = ['alice.dash'], amount = 1_000n): IdentityApiDto {
  return {
    identityIndex: 0,
    identifier: 'B7kcEqgCRhLp2Wq5WZbeT4yUcZR8BWh3X1o3qDtLCpQH',
    alias: aliasesList[0] ?? null,
    aliasesList,
    keys,
    balance: { amount, usdAmount: '0.0' },
    derivationPath: "m/9'/1'/0'/0/0",
    assetLockTxid: null,
  }
}

const ENC = { purpose: IdentityKeyPurpose.Encryption, securityLevel: IdentityKeySecurityLevel.Medium, contractBounds: DASHPAY_KEY_BOUNDS }
const DEC = { purpose: IdentityKeyPurpose.Decryption, securityLevel: IdentityKeySecurityLevel.Medium, contractBounds: DASHPAY_KEY_BOUNDS }
const AUTH_HIGH = { purpose: IdentityKeyPurpose.Authentication, securityLevel: IdentityKeySecurityLevel.High, contractBounds: null }

describe('keySlotsUsed', () => {
  it('counts slots as the highest key id plus one', () => {
    expect(keySlotsUsed([])).toBe(0)
    expect(keySlotsUsed(DEFAULT_KEYS)).toBe(6)
    expect(keySlotsUsed([key(0, 'AUTHENTICATION', 'MASTER'), key(7, 'AUTHENTICATION', 'MEDIUM')])).toBe(8)
  })
})

describe('dashPayMissingKeys', () => {
  it('needs nothing for the default key set', () => {
    expect(dashPayMissingKeys(DEFAULT_KEYS)).toEqual([])
  })

  it('adds bound ENC and DEC keys to a legacy identity', () => {
    expect(dashPayMissingKeys(LEGACY_KEYS)).toEqual([ENC, DEC])
  })

  it('adds an unbound AUTH HIGH key when the identity has none', () => {
    const withoutHigh = DEFAULT_KEYS.filter(entry => entry.keyId !== 2)
    expect(dashPayMissingKeys(withoutHigh)).toEqual([AUTH_HIGH])
  })

  it('accepts unbound encryption keys but not disabled or non-ECDSA ones', () => {
    const unbound = [...LEGACY_KEYS, key(4, 'ENCRYPTION', 'MEDIUM'), key(5, 'DECRYPTION', 'MEDIUM')]
    expect(dashPayMissingKeys(unbound)).toEqual([])
    const unusable = [...LEGACY_KEYS, key(4, 'ENCRYPTION', 'MEDIUM', { disabled: true }), key(5, 'DECRYPTION', 'MEDIUM', { keyType: 'BLS12_381' })]
    expect(dashPayMissingKeys(unusable)).toEqual([ENC, DEC])
  })

  it('compares purposes and levels case-insensitively', () => {
    const lowercase = [key(0, 'authentication', 'high'), key(1, 'encryption', 'medium'), key(2, 'decryption', 'medium')]
    expect(dashPayMissingKeys(lowercase)).toEqual([])
  })
})

describe('dashPayReadiness', () => {
  it('is Ready with ENC, DEC, AUTH HIGH and a username', () => {
    expect(dashPayReadiness(identity(DEFAULT_KEYS))).toEqual({
      readiness: DashPayReadiness.Ready,
      canSend: true,
      canRegister: true,
      missingKeys: [],
      slotsUsed: 6,
      slotsLeft: 14,
    })
  })

  it('is Ready with unbound ENC and DEC keys, AUTH HIGH and a username', () => {
    const unbound = [...LEGACY_KEYS, key(4, 'ENCRYPTION', 'MEDIUM'), key(5, 'DECRYPTION', 'MEDIUM')]
    expect(dashPayReadiness(identity(unbound))).toEqual({
      readiness: DashPayReadiness.Ready,
      canSend: true,
      canRegister: true,
      missingKeys: [],
      slotsUsed: 6,
      slotsLeft: 14,
    })
  })

  it('needs ENC and DEC keys with only AUTH MASTER, HIGH, CRITICAL and TRANSFER', () => {
    expect(dashPayReadiness(identity(LEGACY_KEYS))).toEqual({
      readiness: DashPayReadiness.NeedsKeys,
      canSend: false,
      canRegister: true,
      missingKeys: [ENC, DEC],
      slotsUsed: 4,
      slotsLeft: 16,
    })
  })

  it('needs keys before it needs a username', () => {
    const info = dashPayReadiness(identity(LEGACY_KEYS, []))
    expect(info.readiness).toBe(DashPayReadiness.NeedsKeys)
    expect(info.canSend).toBe(false)
    expect(info.canRegister).toBe(true)
  })

  it('cannot register a username without AUTH HIGH', () => {
    const info = dashPayReadiness(identity(DEFAULT_KEYS.filter(entry => entry.keyId !== 2)))
    expect(info.readiness).toBe(DashPayReadiness.NeedsKeys)
    expect(info.canRegister).toBe(false)
  })

  it('reports No username for a keyed identity without names', () => {
    const info = dashPayReadiness(identity(DEFAULT_KEYS, []))
    expect(info.readiness).toBe(DashPayReadiness.NoUsername)
    expect(info.canSend).toBe(true)
  })

  it('reports No key slots when the missing keys do not fit in 20 − (maxKeyId + 1)', () => {
    const full = [...LEGACY_KEYS, ...Array.from({ length: 16 }, (_, index) => key(index + 4, 'AUTHENTICATION', 'MEDIUM'))]
    expect(dashPayReadiness(identity(full))).toMatchObject({ readiness: DashPayReadiness.NoKeySlots, slotsUsed: 20, slotsLeft: 0 })
    const oneLeft = [...LEGACY_KEYS, key(18, 'AUTHENTICATION', 'MEDIUM')]
    expect(dashPayReadiness(identity(oneLeft))).toMatchObject({ readiness: DashPayReadiness.NoKeySlots, slotsLeft: 1 })
    const twoLeft = [...LEGACY_KEYS, key(17, 'AUTHENTICATION', 'MEDIUM')]
    expect(dashPayReadiness(identity(twoLeft))).toMatchObject({ readiness: DashPayReadiness.NeedsKeys, slotsLeft: 2 })
  })
})

describe('setupSteps', () => {
  it('lists three to-do steps when there is no identity', () => {
    expect(setupSteps(null, null)).toEqual([
      { step: DashPaySetupStep.Identity, state: SetupStepState.Todo, caption: DASHPAY_SETUP_COPY.noIdentity },
      { step: DashPaySetupStep.Username, state: SetupStepState.Todo, caption: DASHPAY_SETUP_COPY.afterIdentity },
      { step: DashPaySetupStep.Keys, state: SetupStepState.Todo, caption: DASHPAY_SETUP_COPY.afterIdentity },
    ])
  })

  it('marks every step done for a ready identity', () => {
    const ready = identity(DEFAULT_KEYS)
    expect(setupSteps(ready, dashPayReadiness(ready))).toEqual([
      { step: DashPaySetupStep.Identity, state: SetupStepState.Done, caption: 'alice.dash' },
      { step: DashPaySetupStep.Username, state: SetupStepState.Done, caption: 'alice.dash' },
      { step: DashPaySetupStep.Keys, state: SetupStepState.Done, caption: DASHPAY_SETUP_COPY.keysDone },
    ])
  })

  it('warns about zero credits and about missing key slots', () => {
    const full = [...LEGACY_KEYS, ...Array.from({ length: 16 }, (_, index) => key(index + 4, 'AUTHENTICATION', 'MEDIUM'))]
    const broke = identity(full, [], 0n)
    const [identityStep, usernameStep, keysStep] = setupSteps(broke, dashPayReadiness(broke))
    expect(identityStep.state).toBe(SetupStepState.Warning)
    expect(usernameStep).toEqual({ step: DashPaySetupStep.Username, state: SetupStepState.Todo, caption: DASHPAY_SETUP_COPY.usernameTodo })
    expect(keysStep).toEqual({ step: DashPaySetupStep.Keys, state: SetupStepState.Warning, caption: DASHPAY_SETUP_COPY.keysTodo })
  })

  it('leaves the keys step to-do when slots are available', () => {
    const legacy = identity(LEGACY_KEYS)
    expect(setupSteps(legacy, dashPayReadiness(legacy))[2].state).toBe(SetupStepState.Todo)
  })
})
