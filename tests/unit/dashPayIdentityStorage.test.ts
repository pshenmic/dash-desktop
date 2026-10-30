import { afterEach, describe, expect, it, vi } from 'vitest'
import { readStoredIdentity, writeStoredIdentity } from '../../src/renderer/src/utils/dashPayIdentityStorage'
import { DASHPAY_IDENTITY_STORAGE_PREFIX } from '../../src/renderer/src/constants/dashPay'

function memoryStorage(): Map<string, string> {
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (name: string) => store.get(name) ?? null,
    setItem: (name: string, value: string) => void store.set(name, value),
  })
  return store
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('dashPay identity storage', () => {
  it('stores one identity per wallet under the prefixed key', () => {
    const store = memoryStorage()
    writeStoredIdentity('wallet-a', 'IdentityA')
    writeStoredIdentity('wallet-b', 'IdentityB')
    expect(store.get(`${DASHPAY_IDENTITY_STORAGE_PREFIX}wallet-a`)).toBe('IdentityA')
    expect(readStoredIdentity('wallet-a')).toBe('IdentityA')
    expect(readStoredIdentity('wallet-b')).toBe('IdentityB')
  })

  it('reads null for a wallet with nothing or an empty value stored', () => {
    const store = memoryStorage()
    store.set(`${DASHPAY_IDENTITY_STORAGE_PREFIX}wallet-empty`, '')
    expect(readStoredIdentity('wallet-none')).toBeNull()
    expect(readStoredIdentity('wallet-empty')).toBeNull()
  })

  it('swallows a storage that throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('denied') },
      setItem: () => { throw new Error('quota') },
    })
    expect(readStoredIdentity('wallet-a')).toBeNull()
    expect(() => writeStoredIdentity('wallet-a', 'IdentityA')).not.toThrow()
  })
})
