import {describe, expect, it, vi} from 'vitest'
import {ConnectionService} from '../../src/main/src/services/app/ConnectionService'
import {RpcStatusFetcher} from '../../src/main/src/types/Connection'

describe('ConnectionService', () => {
  it('checks the network Dashscan status endpoint', async () => {
    const fetchStatus: RpcStatusFetcher = vi.fn(async () => ({ok: true}))
    const service = new ConnectionService(fetchStatus)

    await expect(service.getRpcStatus('mainnet')).resolves.toBe(true)
    expect(fetchStatus).toHaveBeenCalledWith(
      'https://dashscan.pshenmic.dev/status',
      {signal: expect.any(AbortSignal)},
    )
  })

  it('reports an unhealthy HTTP response as unavailable', async () => {
    const fetchStatus: RpcStatusFetcher = vi.fn(async () => ({ok: false}))
    const service = new ConnectionService(fetchStatus)

    await expect(service.getRpcStatus('testnet')).resolves.toBe(false)
  })

  it('reports request errors as unavailable', async () => {
    const fetchStatus: RpcStatusFetcher = vi.fn(async () => {
      throw new Error('offline')
    })
    const service = new ConnectionService(fetchStatus)

    await expect(service.getRpcStatus('mainnet')).resolves.toBe(false)
  })
})
