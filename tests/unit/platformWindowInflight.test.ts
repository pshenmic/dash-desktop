import {describe, it, expect, vi, beforeAll} from 'vitest'
import {KeyPairController} from 'dash-platform-sdk/src/keyPair/index.js'
import {mnemonicToSeedSync} from '@scure/bip39'
import {PlatformAddressService} from '../../src/main/src/services/platform/PlatformAddressService'
import {WalletDAO} from '../../src/main/src/database/WalletDAO'
import {PlatformAddressDAO} from '../../src/main/src/database/PlatformAddressDAO'
import {PlatformWorkerService} from '../../src/main/src/services/platform/PlatformWorkerService'
import {PlatformAddressRow} from '../../src/main/src/types/PlatformAddress'
import {platformAddressDeriver} from '../../src/main/src/utils/platformAddress'
import {PLATFORM_ACCOUNT} from '../../src/main/src/constants'

const WALLET = 'w1'
const SEEDPHRASE = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

let xpub: string
let addressAt: (index: number) => string

beforeAll(async () => {
  const seed = mnemonicToSeedSync(SEEDPHRASE)
  xpub = await new KeyPairController().derivePlatformAccountXpub(seed, 'testnet', PLATFORM_ACCOUNT)
  const deriver = platformAddressDeriver(xpub, 'testnet')
  addressAt = index => deriver.derive(index).address
})

// addressInfos is the per-round worker trip the window walk repeats, so counting
// it counts the work a second concurrent run would duplicate.
function service(used = new Set<number>()): {
  service: PlatformAddressService
  request: ReturnType<typeof vi.fn>
  rows: () => PlatformAddressRow[]
  release: () => void
} {
  let release = (): void => undefined
  const gate = new Promise<void>(resolve => { release = resolve })

  const usedAddresses = new Set([...used].map(index => addressAt(index)))
  const request = vi.fn(async (op: string, _network: string, payload: {addresses: string[]}) => {
    if (op !== 'addressInfos') return {infos: []}
    await gate
    return {
      infos: payload.addresses
        .filter(address => usedAddresses.has(address))
        .map(address => ({address, balance: 1n, nonce: 0})),
    }
  })

  const stored = new Map<string, PlatformAddressRow[]>()
  const platformAddressDAO = {
    getAddresses: async (walletId: string) => [...(stored.get(walletId) ?? [])],
    insertAddresses: async (addresses: PlatformAddressRow[]) => {
      const rows = stored.get(addresses[0]?.walletId ?? WALLET) ?? []
      const present = new Set(rows.map(row => row.index))
      rows.push(...addresses.filter(row => !present.has(row.index)))
      stored.set(addresses[0]?.walletId ?? WALLET, rows)
    },
    markAddressesUsed: async (walletId: string, indexes: number[]) => {
      for (const row of stored.get(walletId) ?? []) {
        if (indexes.includes(row.index)) row.isUsed = true
      }
    },
  }

  const walletDAO = {
    getWalletById: vi.fn(async (walletId: string) => ({walletId, network: 'testnet', platformXpub: xpub})),
    getPlatformAddressCount: vi.fn().mockResolvedValue(20),
  }

  const svc = new PlatformAddressService(
    walletDAO as unknown as WalletDAO,
    platformAddressDAO as unknown as PlatformAddressDAO,
    {request} as unknown as PlatformWorkerService,
  )

  return {service: svc, request, rows: () => stored.get(WALLET) ?? [], release}
}

describe('platform window extension', () => {
  // The walk is shared; the balance read that follows it is not. A send resolves
  // its own nonces rather than joining whatever snapshot a concurrent poll took.
  it('collapses concurrent callers onto one walk', async () => {
    const {service: svc, request, release} = service()
    const inflight = (svc as unknown as {windowInflight: Map<string, unknown>}).windowInflight

    const both = Promise.all([svc.getPlatformAddresses(WALLET), svc.getPlatformAddresses(WALLET)])
    await new Promise(resolve => setImmediate(resolve))
    expect(inflight.size).toBe(1)
    release()
    await both

    expect(request.mock.calls.map(([, , payload]) => payload.addresses.length)).toEqual([20, 20])
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
    await new Promise(resolve => setImmediate(resolve))
    release()
    await both

    expect(request).toHaveBeenCalledTimes(2)
  })

  it('seeds one lookahead of rows for a wallet that has none', async () => {
    const {service: svc, rows, release} = service()

    release()
    await svc.getPlatformAddresses(WALLET)

    expect(rows().map(row => row.index)).toEqual(Array.from({length: 20}, (_, i) => i))
  })

  it('keeps a fresh lookahead after the last stored address becomes used', async () => {
    const {service: svc, rows, release} = service(new Set([19]))

    release()
    await svc.getPlatformAddresses(WALLET)

    expect(rows()).toHaveLength(40)
    expect(rows().find(row => row.index === 19)?.isUsed).toBe(true)
  })

  // One fetch per address per call: the walk's probes and the balance read that
  // follows them share a cache, and an empty answer still counts as fetched.
  it('does not re-fetch what the walk already looked up', async () => {
    const {service: svc, request, release} = service()

    release()
    const addresses = await svc.getPlatformAddresses(WALLET)

    expect(addresses).toHaveLength(20)
    expect(request).toHaveBeenCalledTimes(1)
  })
})
