import { describe, expect, it } from 'vitest'
import type { IdentityKeyDto } from '../../src/renderer/src/api/types'
import { DASHPAY_KEY_BOUNDS } from '../../src/renderer/src/constants/dashPay'
import { MASTER_KEY_REQUEST } from '../../src/renderer/src/constants/identityKeys'
import { IdentityKeyAction, IdentityKeyDashPayImpact } from '../../src/renderer/src/enums/IdentityKeys'
import { disableKeyDashPayImpact, identityKeyAction, identityKeyUpdate } from '../../src/renderer/src/utils/identityKeyActions'
import { identityKeyLabel } from '../../src/renderer/src/utils/identityKeyRequests'

const DISABLED_AT = 1_700_000_000_000

function key(keyId: number, purpose: string, securityLevel: string, overrides: Partial<IdentityKeyDto> = {}): IdentityKeyDto {
  return { keyId, purpose, securityLevel, keyType: 'ECDSA_SECP256K1', data: '', readOnly: false, disabledAt: null, contractBounds: null, ...overrides }
}

const DASHPAY_READY = [
  key(0, 'AUTHENTICATION', 'MASTER'),
  key(1, 'AUTHENTICATION', 'HIGH'),
  key(2, 'ENCRYPTION', 'MEDIUM', { contractBounds: DASHPAY_KEY_BOUNDS }),
  key(3, 'DECRYPTION', 'MEDIUM', { contractBounds: DASHPAY_KEY_BOUNDS }),
]

describe('identityKeyAction', () => {
  it('replaces a master key and disables any other active key', () => {
    expect(identityKeyAction(key(0, 'AUTHENTICATION', 'MASTER'))).toBe(IdentityKeyAction.ReplaceMaster)
    expect(identityKeyAction(key(1, 'TRANSFER', 'CRITICAL'))).toBe(IdentityKeyAction.Disable)
  })

  it('offers nothing for a disabled or read-only key, which Platform would refuse', () => {
    expect(identityKeyAction(key(1, 'AUTHENTICATION', 'HIGH', { disabledAt: DISABLED_AT }))).toBeNull()
    expect(identityKeyAction(key(1, 'AUTHENTICATION', 'HIGH', { readOnly: true }))).toBeNull()
  })
})

describe('identityKeyUpdate', () => {
  it('disables a plain key on its own', () => {
    expect(identityKeyUpdate(4, IdentityKeyAction.Disable)).toEqual({ add: [], disable: [4] })
  })

  it('swaps a master key one for one in the same update', () => {
    expect(identityKeyUpdate(0, IdentityKeyAction.ReplaceMaster)).toEqual({ add: [MASTER_KEY_REQUEST], disable: [0] })
  })
})

describe('disableKeyDashPayImpact', () => {
  const spare = key(4, 'ENCRYPTION', 'MEDIUM', { contractBounds: DASHPAY_KEY_BOUNDS })

  it('says DashPay stops when the key is the last one of a kind it needs', () => {
    expect(disableKeyDashPayImpact(DASHPAY_READY, DASHPAY_READY[2])).toBe(IdentityKeyDashPayImpact.StopsDashPay)
  })

  it('still warns about contact requests encrypted to a key that has a spare', () => {
    expect(disableKeyDashPayImpact([...DASHPAY_READY, spare], DASHPAY_READY[2])).toBe(IdentityKeyDashPayImpact.ContactRequests)
  })

  it('stays quiet for a key no contact request can be encrypted to', () => {
    const bls = key(5, 'DECRYPTION', 'MEDIUM', { keyType: 'BLS12_381' })
    expect(disableKeyDashPayImpact([...DASHPAY_READY, bls], bls)).toBeNull()
  })
})

describe('identityKeyLabel', () => {
  it('names a key by its id, purpose and level', () => {
    expect(identityKeyLabel(key(3, 'DECRYPTION', 'MEDIUM'))).toBe('#3 Decryption · Medium')
  })
})
