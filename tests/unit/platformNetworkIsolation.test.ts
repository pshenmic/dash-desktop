import {describe, it, expect, vi} from 'vitest'
import {PlatformService} from '../../src/main/platform/PlatformService'
import {SdkSource} from '../../src/main/platform/SdkRegistry'
import {PlatformEvent, PlatformRequestMessage} from '../../src/main/platform/types/messages'
import {Network} from '../../src/main/src/types'

// A stub SDK that records which network it belongs to and blocks until
// released, so two operations can be held in flight at the same time.
class StubSdk {
  readonly setNetwork = vi.fn()
  readonly seenBy: string[] = []
  private release: (() => void) | null = null

  constructor(readonly network: Network) {}

  readonly identities = {
    getIdentityBalance: async (identifier: string): Promise<bigint> => {
      this.seenBy.push(identifier)
      await new Promise<void>(resolve => {
        this.release = resolve
      })
      // Answering with the network proves which SDK served the call.
      return BigInt(this.network === 'mainnet' ? 1 : 2)
    },
    getIdentityNonce: async (): Promise<bigint> => 0n,
  }

  readonly shielded = {
    getShieldedPoolState: async (): Promise<bigint> => 0n,
    getShieldedNotesCount: async (): Promise<bigint> => 0n,
    getShieldedEncryptedNotes: async (): Promise<unknown[]> => [],
  }

  finish(): void {
    this.release?.()
    this.release = null
  }
}

const request = (
  requestId: string,
  network: Network,
  identifier: string,
): PlatformRequestMessage => ({
  type: 'request',
  requestId,
  kind: 'identityBalance',
  network,
  payload: {identifier},
})

const setup = (): {
  service: PlatformService
  sdks: Record<Network, StubSdk>
  events: PlatformEvent[]
  warmup: ReturnType<typeof vi.fn>
} => {
  const sdks: Record<Network, StubSdk> = {
    mainnet: new StubSdk('mainnet'),
    testnet: new StubSdk('testnet'),
  }
  const events: PlatformEvent[] = []
  const warmup = vi.fn(async () => undefined)
  const registry: SdkSource = {
    get: (network: Network) => sdks[network] as unknown as ReturnType<SdkSource['get']>,
    warmup,
  }
  const service = new PlatformService(registry, event => events.push(event))
  return {service, sdks, events, warmup}
}

const responses = (events: PlatformEvent[]): Extract<PlatformEvent, {type: 'response'}>[] =>
  events.filter((e): e is Extract<PlatformEvent, {type: 'response'}> => e.type === 'response')

const flush = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0))

describe('PlatformService network isolation', () => {
  it('serves concurrent requests from the SDK of their own network', async () => {
    const {service, sdks, events} = setup()

    service.handle(request('a', 'mainnet', 'identity-main'))
    service.handle(request('b', 'testnet', 'identity-test'))
    await flush()

    // Both are in flight at once — reads take no lane.
    expect(sdks.mainnet.seenBy).toEqual(['identity-main'])
    expect(sdks.testnet.seenBy).toEqual(['identity-test'])

    sdks.testnet.finish()
    sdks.mainnet.finish()
    await flush()

    const settled = responses(events)
    expect(settled).toHaveLength(2)
    const byId = new Map(settled.map(r => [r.requestId, r]))
    expect(byId.get('a')).toMatchObject({ok: true, result: {credits: 1n}})
    expect(byId.get('b')).toMatchObject({ok: true, result: {credits: 2n}})
  })

  it('never calls setNetwork — a command for one network cannot re-point another', async () => {
    const {service, sdks} = setup()

    service.handle(request('a', 'mainnet', 'identity-main'))
    await flush()
    service.handle(request('b', 'testnet', 'identity-test'))
    service.handle({type: 'request', requestId: 'c', kind: 'warmup', network: 'testnet', payload: {}})
    await flush()

    sdks.mainnet.finish()
    sdks.testnet.finish()
    await flush()

    expect(sdks.mainnet.setNetwork).not.toHaveBeenCalled()
    expect(sdks.testnet.setNetwork).not.toHaveBeenCalled()
  })

  it('reports pool health per network', async () => {
    const {service, sdks, events} = setup()
    const failing = sdks.testnet as unknown as {identities: {getIdentityBalance: () => Promise<bigint>}}
    failing.identities.getIdentityBalance = async () => {
      throw new Error('dapi unreachable')
    }

    service.handle(request('a', 'mainnet', 'identity-main'))
    service.handle(request('b', 'testnet', 'identity-test'))
    await flush()
    sdks.mainnet.finish()
    await flush()

    const status = service.getStatus()
    expect(status.networks.mainnet).toEqual({pool: 'ready', error: null})
    expect(status.networks.testnet).toEqual({pool: 'error', error: 'dapi unreachable'})

    const failed = responses(events).find(r => r.requestId === 'b')
    expect(failed).toMatchObject({ok: false, error: {code: 'internal', message: 'dapi unreachable'}})
  })

  it('warms the prover once and reports it ready', async () => {
    const {service, events, warmup} = setup()

    service.handle({type: 'request', requestId: 'w1', kind: 'warmup', network: 'mainnet', payload: {}})
    await flush()
    service.handle({type: 'request', requestId: 'w2', kind: 'warmup', network: 'testnet', payload: {}})
    await flush()

    expect(service.getStatus().prover).toBe('ready')
    expect(warmup).toHaveBeenCalledTimes(1)
    expect(responses(events).map(r => r.requestId)).toEqual(['w1', 'w2'])
  })
})