import {describe, it, expect, vi} from 'vitest'
import {identityInfos} from '../../src/main/platform/operations/identity/infos'
import {OperationContext} from '../../src/main/platform/operations/types'

const KNOWN = ['id-one', 'id-two']

interface Calls {
  identities: string[]
  names: string[]
}

function context(known: string[] = KNOWN): {ctx: OperationContext; calls: Calls} {
  const calls: Calls = {identities: [], names: []}

  const ctx = {
    sdk: {
      identities: {
        getIdentityByIdentifier: vi.fn(async (identifier: string) => {
          calls.identities.push(identifier)
          if (!known.includes(identifier)) throw new Error('not found')
          return {id: {base58: () => identifier}, balance: 1_000n}
        }),
      },
      names: {
        searchByIdentity: vi.fn(async (identifier: string) => {
          calls.names.push(identifier)
          return [{properties: {label: 'alice', parentDomainName: 'dash'}}]
        }),
      },
    } as never,
    network: 'testnet',
    signal: new AbortController().signal,
    progress: () => undefined,
    notesSpent: () => undefined,
  } as OperationContext

  return {ctx, calls}
}

describe('identityInfos', () => {
  it('resolves aliases when asked for them', async () => {
    const {ctx, calls} = context()

    const {infos} = await identityInfos({identifiers: KNOWN, skipDPNS: false}, ctx)

    expect(infos.map(i => i.alias)).toEqual(['alice.dash', 'alice.dash'])
    expect(calls.names).toEqual(KNOWN)
  })

  // The balance path pays for this search on every identity and never reads it.
  it('makes no name query at all when skipping DPNS', async () => {
    const {ctx, calls} = context()

    const {infos} = await identityInfos({identifiers: KNOWN, skipDPNS: true}, ctx)

    expect(calls.names).toEqual([])
    expect(calls.identities).toEqual(KNOWN)
    expect(infos.map(i => i.alias)).toEqual([null, null])
  })

  it('still reports balances when skipping DPNS', async () => {
    const {ctx} = context()

    const {infos} = await identityInfos({identifiers: KNOWN, skipDPNS: true}, ctx)

    expect(infos.map(i => i.balance)).toEqual([1_000n, 1_000n])
    expect(infos.map(i => i.identifier)).toEqual(KNOWN)
  })

  // Each lookup is its own round trip to an evonode, so a serial walk costs the
  // identity count times the latency. Peak concurrency of 1 is that regression.
  it('issues every identity lookup at once', async () => {
    const identifiers = Array.from({length: 8}, (_, i) => `id-${i}`)
    let inFlight = 0
    let peak = 0

    const ctx = {
      sdk: {
        identities: {
          getIdentityByIdentifier: vi.fn(async (identifier: string) => {
            inFlight++
            peak = Math.max(peak, inFlight)
            await new Promise(resolve => setTimeout(resolve, 5))
            inFlight--
            return {id: {base58: () => identifier}, balance: 1n}
          }),
        },
        names: {searchByIdentity: vi.fn(async () => [])},
      } as never,
      network: 'testnet',
      signal: new AbortController().signal,
      progress: () => undefined,
      notesSpent: () => undefined,
    } as OperationContext

    const {infos} = await identityInfos({identifiers, skipDPNS: true}, ctx)

    expect(peak).toBe(identifiers.length)
    expect(infos).toHaveLength(identifiers.length)
  })

  it('keeps results in the order they were asked for', async () => {
    const identifiers = ['id-two', 'id-one']
    const ctx = context(identifiers).ctx

    const {infos} = await identityInfos({identifiers, skipDPNS: true}, ctx)

    expect(infos.map(i => i.identifier)).toEqual(identifiers)
  })

  it('omits an identity Platform does not know, either way', async () => {
    for (const skipDPNS of [true, false]) {
      const {ctx, calls} = context(['id-one'])

      const {infos} = await identityInfos({identifiers: [...KNOWN, 'id-ghost'], skipDPNS}, ctx)

      expect(infos.map(i => i.identifier)).toEqual(['id-one'])
      // No name query is wasted on an identity that resolved to nothing.
      expect(calls.names).toEqual(skipDPNS ? [] : ['id-one'])
    }
  })
})
