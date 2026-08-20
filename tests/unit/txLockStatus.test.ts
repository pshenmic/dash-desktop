import {describe, it, expect, vi, afterEach} from 'vitest'

const state = vi.hoisted(() => ({respond: (): Response => ({} as Response), calls: 0}))

vi.mock('electron', () => ({
  net: {
    fetch: () => {
      state.calls++
      return Promise.resolve(state.respond())
    },
  },
}))

import {DashscanWalletProvider} from '../../src/main/src/providers/DashscanWalletProvider'
import {AddressDAO} from '../../src/main/src/database/AddressDAO'
import {WalletDAO} from '../../src/main/src/database/WalletDAO'

const TXID = 'a'.repeat(64)

const provider = (): DashscanWalletProvider => {
  state.calls = 0
  return new DashscanWalletProvider('testnet', 'w1', {} as AddressDAO, {} as WalletDAO)
}

const ok = (body: unknown): Response =>
  ({ok: true, status: 200, json: async () => body} as Response)

const status = (code: number): Response =>
  ({ok: false, status: code, text: async () => '', json: async () => ({})} as Response)

// The retry ladder is real time otherwise, and every failing case walks it.
describe('reading a transaction lock status', () => {
  afterEach(() => vi.useRealTimers())

  it('reports an instant lock', async () => {
    state.respond = () => ok({instantLock: 'aabb', chainLocked: false, confirmations: 0})

    expect(await provider().getTxLockStatus(TXID)).toEqual({
      instantLocked: true, chainlocked: false, confirmed: false,
    })
  })

  // The indexer answering "no such transaction" is the same claim the local
  // store makes for a txid it holds no row for.
  it('treats a transaction the indexer has never seen as not locked', async () => {
    state.respond = () => status(404)

    expect(await provider().getTxLockStatus(TXID)).toEqual({
      instantLocked: false, chainlocked: false, confirmed: false,
    })
  })

  // An indexer that could not answer must not produce the same all-false shape
  // as one reporting no lock — a send would look stuck rather than unverified.
  it('refuses to call a server failure "not locked"', async () => {
    vi.useFakeTimers()
    state.respond = () => status(503)

    // Attached before the clock moves, or the rejection lands unhandled.
    const settled = expect(provider().getTxLockStatus(TXID)).rejects.toThrow(/Dashscan request failed/)
    await vi.runAllTimersAsync()
    await settled
  })

  it('refuses to call a transport failure "not locked"', async () => {
    vi.useFakeTimers()
    state.respond = () => { throw new Error('ECONNRESET') }

    const settled = expect(provider().getTxLockStatus(TXID)).rejects.toThrow(/Dashscan request failed/)
    await vi.runAllTimersAsync()
    await settled
  })

  // 4xx is our own request being wrong, so repeating it only burns the deadline.
  it('does not retry a 404', async () => {
    state.respond = () => status(404)

    await provider().getTxLockStatus(TXID)

    expect(state.calls).toBe(1)
  })

  it('retries a 5xx before giving up', async () => {
    vi.useFakeTimers()
    state.respond = () => status(503)

    const settled = provider().getTxLockStatus(TXID).catch(() => undefined)
    await vi.runAllTimersAsync()
    await settled

    expect(state.calls).toBeGreaterThan(1)
  })
})
