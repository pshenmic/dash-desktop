import {describe, it, expect, vi} from 'vitest'
import {PlatformAddressService} from '../../src/main/src/services/platform/PlatformAddressService'
import {WalletDAO} from '../../src/main/src/database/WalletDAO'
import {PlatformWorkerService} from '../../src/main/src/services/platform/PlatformWorkerService'
import {Preferences} from '../../src/main/src/preferences'
import {FeeService} from '../../src/main/src/services/wallet/FeeService'

const WALLET = 'w1'
const XPUB = 'xpub-test'

// addressInfos is the per-batch worker round trip the window walk repeats, so
// counting it counts the work a second concurrent run would duplicate.
function service(): {
  service: PlatformAddressService
  request: ReturnType<typeof vi.fn>
  release: () => void
} {
  let release = (): void => undefined
  const gate = new Promise<void>(resolve => { release = resolve })

  const request = vi.fn(async (op: string) => {
    if (op !== 'addressInfos') return {infos: []}
    await gate
    return {infos: []}
  })

  const walletDAO = {
    getWalletById: vi.fn().mockResolvedValue({walletId: WALLET, network: 'testnet', platformXpub: XPUB}),
    getPlatformAddressCount: vi.fn().mockResolvedValue(20),
    setPlatformAddressCount: vi.fn().mockResolvedValue(undefined),
  }

  const svc = new PlatformAddressService(
    walletDAO as unknown as WalletDAO, {} as never, {} as never,
    {request} as unknown as PlatformWorkerService, {} as never,
    {loadCandidates: async () => []} as unknown as FeeService,
    Preferences.default(),
  )

  ;(svc as unknown as {keyPair: unknown}).keyPair = {
    derivePlatformAddressFromXpub: (_x: string, _n: string, i: number) => ({toBech32m: () => `addr-${i}`}),
  }

  return {service: svc, request, release}
}

describe('platform window extension', () => {
  it('collapses concurrent callers onto one walk', async () => {
    const {service: svc, request, release} = service()

    const both = Promise.all([svc.getPlatformAddresses(WALLET), svc.getPlatformAddresses(WALLET)])
    await Promise.resolve()
    release()
    await both

    expect(request).toHaveBeenCalledTimes(1)
  })

  // The guard must not turn into a cache: the next poll has to see new activity.
  it('walks again once the previous one has settled', async () => {
    const {service: svc, request, release} = service()

    release()
    await svc.getPlatformAddresses(WALLET)
    await svc.getPlatformAddresses(WALLET)

    expect(request).toHaveBeenCalledTimes(2)
  })

  it('does not hold the entry after a failed walk', async () => {
    const {service: svc, request} = service()
    request.mockRejectedValueOnce(new Error('worker gone'))

    await expect(svc.getPlatformAddresses(WALLET)).rejects.toThrow('worker gone')

    const inflight = (svc as unknown as {windowInflight: Map<string, unknown>}).windowInflight
    expect(inflight.size).toBe(0)
  })

  it('keeps separate wallets independent', async () => {
    const {service: svc, request, release} = service()

    const both = Promise.all([svc.getPlatformAddresses(WALLET), svc.getPlatformAddresses('w2')])
    await Promise.resolve()
    release()
    await both

    expect(request).toHaveBeenCalledTimes(2)
  })
})
