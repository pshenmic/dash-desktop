import { describe, it, expect } from 'vitest'
import {matchIdentityKey} from '../../src/main/src/utils/identityKeys'
import {IdentityKeyDescriptor, DerivedKeyHash} from '../../src/main/src/types/IdentityKeys'
function key(keyId: number, purpose: string, publicKeyHashHex: string, securityLevel = 'CRITICAL'): IdentityKeyDescriptor {
  return { keyId, purpose, securityLevel, publicKeyHashHex }
}

function derived(keyIndex: number, publicKeyHashHex: string): DerivedKeyHash {
  return { keyIndex, publicKeyHashHex }
}

describe('matchIdentityKey', () => {
  it('matches a transfer key by public key hash', () => {
    const result = matchIdentityKey(
      [key(0, 'AUTHENTICATION', 'aa'), key(3, 'TRANSFER', 'bb')],
      [derived(0, 'aa'), derived(3, 'bb')],
    )
    expect(result).toEqual({ keyId: 3, keyIndex: 3 })
  })

  it('ignores non-transfer keys even when their hashes are derivable', () => {
    expect(matchIdentityKey([key(0, 'AUTHENTICATION', 'aa')], [derived(0, 'aa')])).toBeNull()
  })

  it('returns null when no derived hash matches', () => {
    expect(matchIdentityKey([key(3, 'TRANSFER', 'bb')], [derived(0, 'aa')])).toBeNull()
  })

  it('prefers the lowest transfer keyId when several match', () => {
    const result = matchIdentityKey(
      [key(5, 'TRANSFER', 'cc'), key(3, 'TRANSFER', 'bb')],
      [derived(1, 'bb'), derived(2, 'cc')],
    )
    expect(result).toEqual({ keyId: 3, keyIndex: 1 })
  })

  it('matches the wanted purpose and security level when asked for one', () => {
    const result = matchIdentityKey(
      [key(0, 'AUTHENTICATION', 'aa', 'MASTER'), key(1, 'AUTHENTICATION', 'bb'), key(2, 'AUTHENTICATION', 'cc', 'HIGH')],
      [derived(0, 'aa'), derived(1, 'bb'), derived(2, 'cc')],
      'AUTHENTICATION',
      'HIGH',
    )
    expect(result).toEqual({ keyId: 2, keyIndex: 2 })
  })

  it('matches hashes case-insensitively', () => {
    const result = matchIdentityKey([key(3, 'transfer', 'AB12')], [derived(0, 'ab12')])
    expect(result).toEqual({ keyId: 3, keyIndex: 0 })
  })
})
