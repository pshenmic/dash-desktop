import {beforeEach, describe, expect, it, vi} from 'vitest'
import {OperationContext} from '../../src/main/platform/operations/types'
import {PLATFORM_VERSION_RETRY_MS} from '../../src/main/platform/constants'

type Resolve = typeof import('../../src/main/platform/operations/platformVersion').platformVersion

// The resolver caches per network for the life of the process, so each case
// loads a fresh copy of it.
let platformVersion: Resolve

beforeEach(async () => {
  vi.resetModules()
  ;({platformVersion} = await import('../../src/main/platform/operations/platformVersion'))
})

function context(getEpochsInfo: () => Promise<Array<{protocolVersion: number}>>): OperationContext {
  return {sdk: {node: {getEpochsInfo}}, network: 'testnet'} as unknown as OperationContext
}

describe('platformVersion', () => {
  it('prices at the version the network runs', async () => {
    expect(await platformVersion(context(async () => [{protocolVersion: 12}]))).toBe(12)
  })

  it('falls back to the newest known version when the network runs a newer one', async () => {
    expect(await platformVersion(context(async () => [{protocolVersion: 99}]))).toBe(13)
  })

  it('falls back to the newest known version when the network reports none', async () => {
    expect(await platformVersion(context(async () => [{} as {protocolVersion: number}]))).toBe(13)
  })

  // Offline, every keystroke's quote would otherwise wait on a timeout first.
  it('keeps a failed lookup for the retry window, then asks again', async () => {
    const lookup = vi.fn(async (): Promise<Array<{protocolVersion: number}>> => { throw new Error('offline') })
    const now = vi.spyOn(Date, 'now').mockReturnValue(0)
    expect(await platformVersion(context(lookup))).toBe(13)
    await platformVersion(context(lookup))
    expect(lookup).toHaveBeenCalledTimes(1)

    now.mockReturnValue(PLATFORM_VERSION_RETRY_MS)
    await platformVersion(context(lookup))
    expect(lookup).toHaveBeenCalledTimes(2)
    now.mockRestore()
  })

  it('asks the network once per window, sharing a lookup in flight', async () => {
    const lookup = vi.fn(async () => [{protocolVersion: 13}])
    await Promise.all([platformVersion(context(lookup)), platformVersion(context(lookup))])
    await platformVersion(context(lookup))
    expect(lookup).toHaveBeenCalledTimes(1)
  })
})
