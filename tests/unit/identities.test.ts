import { describe, expect, it } from 'vitest'
import type { IdentityKeyDto } from '../../src/renderer/src/api/types'
import { activeKeysCount, identityAddKeysHref, identityHref } from '../../src/renderer/src/utils/identities'

const IDENTIFIER = 'B7kcEqgCRhLp2Wq5WZbeT4yUcZR8BWh3X1o3qDtLCpQH'

const DISABLED_AT = 1_700_000_000_000

function key(keyId: number, disabled = false): IdentityKeyDto {
  return { keyId, purpose: 'AUTHENTICATION', securityLevel: 'HIGH', keyType: 'ECDSA_SECP256K1', data: '', readOnly: false, disabledAt: disabled ? DISABLED_AT : null, contractBounds: null }
}

describe('identity routes', () => {
  it('builds the identity page and its add-keys wizard paths', () => {
    expect(identityHref(IDENTIFIER)).toBe(`/identities/${IDENTIFIER}`)
    expect(identityAddKeysHref(IDENTIFIER)).toBe(`/identities/${IDENTIFIER}/keys/new`)
  })
})

describe('activeKeysCount', () => {
  it('skips disabled keys', () => {
    expect(activeKeysCount([key(0), key(1, true), key(2)])).toBe(2)
    expect(activeKeysCount([])).toBe(0)
  })
})
