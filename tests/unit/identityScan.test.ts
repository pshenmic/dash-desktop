import {describe, it, expect, vi} from 'vitest'
import {KeyPairController} from 'dash-platform-sdk/src/keyPair/index.js'
import {PrivateKeyWASM} from 'dash-platform-sdk/types.js'
import {identityScan} from '../../src/main/platform/operations/identity/scan'
import {OperationContext} from '../../src/main/platform/operations/types'

const MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const keyPair = new KeyPairController()
const SEED = keyPair.mnemonicToSeed(MNEMONIC)

// A Platform that knows about exactly the given identity indexes, keyed by the
// same public key hash the operation derives and queries.
function contextWithTaken(taken: number[]): OperationContext {
  const hdKey = keyPair.seedToHdKey(SEED, 'testnet')
  const identifiers = new Map<string, string>()

  for (const index of taken) {
    const derived = keyPair.deriveIdentityPrivateKey(hdKey, index, 0, 'testnet')
    const pkh = PrivateKeyWASM.fromBytes(derived.privateKey as Uint8Array, 'testnet').getPublicKeyHash()
    identifiers.set(pkh, `identity-${index}`)
  }

  return {
    sdk: {
      keyPair,
      identities: {
        getIdentityByPublicKeyHash: vi.fn(async (pkh: string) => {
          const identifier = identifiers.get(pkh)
          if (identifier == null) throw new Error('not found')
          return {id: {base58: () => identifier}}
        }),
        getIdentityByNonUniquePublicKeyHash: vi.fn(async () => {
          throw new Error('not found')
        }),
      },
    } as never,
    network: 'testnet',
    signal: new AbortController().signal,
    progress: () => undefined,
    notesSpent: () => undefined,
  }
}

describe('identityScan', () => {
  it('reports the start index as free when nothing is registered', async () => {
    const result = await identityScan({seed: SEED, startIndex: 0, gapLimit: 1, scanLimit: 100}, contextWithTaken([]))

    expect(result.nextFreeIndex).toBe(0)
    expect(result.identities).toEqual([])
  })

  it('skips indexes that are already registered', async () => {
    const result = await identityScan({seed: SEED, startIndex: 0, gapLimit: 1, scanLimit: 100}, contextWithTaken([0, 1]))

    expect(result.nextFreeIndex).toBe(2)
    expect(result.identities.map(entry => entry.index)).toEqual([0, 1])
  })

  it('keeps walking past a gap until gapLimit consecutive misses', async () => {
    const result = await identityScan({seed: SEED, startIndex: 0, gapLimit: 5, scanLimit: 100}, contextWithTaken([0, 3]))

    expect(result.identities.map(entry => entry.index)).toEqual([0, 3])
    // The first free index, not the last one walked.
    expect(result.nextFreeIndex).toBe(1)
  })

  it('resolves the identifier of every index it found', async () => {
    const result = await identityScan({seed: SEED, startIndex: 0, gapLimit: 1, scanLimit: 100}, contextWithTaken([0]))

    expect(result.identities).toEqual([{index: 0, identifier: 'identity-0'}])
  })

  it('stops at scanLimit rather than walking forever', async () => {
    await expect(
      identityScan({seed: SEED, startIndex: 0, gapLimit: 5, scanLimit: 2}, contextWithTaken([0, 1, 2])),
    ).rejects.toThrow('Could not find a free identity index')
  })

  it('starts from startIndex', async () => {
    const result = await identityScan({seed: SEED, startIndex: 2, gapLimit: 1, scanLimit: 100}, contextWithTaken([0, 1]))

    expect(result.nextFreeIndex).toBe(2)
    expect(result.identities).toEqual([])
  })
})