import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {AddressDAO} from '../../src/main/src/database/AddressDAO'
import {WalletDAO} from '../../src/main/src/database/WalletDAO'
import {Network} from '../../src/main/src/types/Network'
import {DASHSCAN_STATUS_INTERVAL_MS} from '../../src/main/src/constants'

const mocks = vi.hoisted(() => ({fetch: vi.fn()}))

vi.mock('electron', () => ({net: {fetch: mocks.fetch}}))

const response = (ok: boolean): Response => ({ok, status: ok ? 200 : 503} as Response)

const provider = async (network: Network = 'testnet') => {
  const {DashscanWalletProvider} = await import('../../src/main/src/providers/DashscanWalletProvider')
  return new DashscanWalletProvider(network, 'w1', {} as AddressDAO, {} as WalletDAO)
}

const flushPromises = async (): Promise<void> => {
  await Promise.resolve()
  await Promise.resolve()
}

describe('Dashscan connection status cache', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-27T00:00:00.000Z'))
    mocks.fetch.mockReset()
  })

  afterEach(() => vi.useRealTimers())

  it('returns immediately and deduplicates an in-flight status check', async () => {
    let finishRequest: (value: Response) => void = () => undefined
    mocks.fetch.mockReturnValue(new Promise<Response>(resolve => { finishRequest = resolve }))
    const dashscan = await provider()

    await expect(dashscan.getConnectionStatus()).resolves.toBe('connecting')
    await expect(dashscan.getConnectionStatus()).resolves.toBe('connecting')
    expect(mocks.fetch).toHaveBeenCalledTimes(1)

    finishRequest(response(true))
    await flushPromises()

    await expect(dashscan.getConnectionStatus()).resolves.toBe('online')
    expect(mocks.fetch).toHaveBeenCalledTimes(1)
  })

  it('keeps the previous status while refreshing an expired entry', async () => {
    mocks.fetch.mockResolvedValueOnce(response(true))
    const dashscan = await provider()

    await expect(dashscan.getConnectionStatus()).resolves.toBe('connecting')
    await flushPromises()
    await expect(dashscan.getConnectionStatus()).resolves.toBe('online')

    vi.advanceTimersByTime(DASHSCAN_STATUS_INTERVAL_MS)
    mocks.fetch.mockResolvedValueOnce(response(false))

    await expect(dashscan.getConnectionStatus()).resolves.toBe('online')
    await flushPromises()
    await expect(dashscan.getConnectionStatus()).resolves.toBe('unavailable')
    expect(mocks.fetch).toHaveBeenCalledTimes(2)
  })

  it('caches status independently for each network', async () => {
    mocks.fetch
      .mockResolvedValueOnce(response(true))
      .mockResolvedValueOnce(response(false))
    const testnet = await provider('testnet')
    const mainnet = await provider('mainnet')

    await expect(testnet.getConnectionStatus()).resolves.toBe('connecting')
    await expect(mainnet.getConnectionStatus()).resolves.toBe('connecting')
    await flushPromises()

    await expect(testnet.getConnectionStatus()).resolves.toBe('online')
    await expect(mainnet.getConnectionStatus()).resolves.toBe('unavailable')
    expect(mocks.fetch).toHaveBeenCalledTimes(2)
  })
})
