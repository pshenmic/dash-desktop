import {describe, it, expect, vi, beforeEach} from 'vitest'

const probes = vi.hoisted(() => [] as Array<{dapiUrls: string[]; resolve: (reachable: string[]) => void}>)

vi.mock('../../src/main/platform/operations/dapi', () => ({
  reachableDapiUrls: (dapiUrls: string[]) => new Promise<string[]>(resolve => probes.push({dapiUrls, resolve})),
}))

import {EvonodePins} from '../../src/main/platform/EvonodePins'

const tick = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0))

describe('EvonodePins', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    probes.length = 0
  })

  it('pins the reachable evonodes of a list', async () => {
    const onPinned = vi.fn()
    new EvonodePins(onPinned).probe('testnet', ['a', 'b'])
    probes[0]!.resolve(['b'])
    await tick()

    expect(onPinned).toHaveBeenCalledWith('testnet', ['b'])
  })

  it('never pins an older list whose probe finishes last', async () => {
    const onPinned = vi.fn()
    const pins = new EvonodePins(onPinned)
    pins.probe('testnet', ['saved'])
    pins.probe('testnet', ['fresh'])
    probes[1]!.resolve(['fresh'])
    probes[0]!.resolve(['saved'])
    await tick()

    expect(onPinned.mock.calls).toEqual([['testnet', ['fresh']]])
  })
})
