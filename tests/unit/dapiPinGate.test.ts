import {describe, it, expect, vi, afterEach} from 'vitest'
import {DapiPinGate} from '../../src/main/src/utils/dapiPinGate'

describe('DapiPinGate', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('releases every waiter on the network once it is pinned', async () => {
    const gate = new DapiPinGate()
    const waiting = [gate.wait('testnet', 1000), gate.wait('testnet', 1000)]
    gate.pin('testnet')

    await expect(Promise.all(waiting)).resolves.toEqual([undefined, undefined])
    expect(gate.wait('testnet', 1000)).toBeNull()
  })

  it('holds the other network', () => {
    const gate = new DapiPinGate()
    gate.pin('testnet')

    expect(gate.wait('mainnet', 1000)).not.toBeNull()
  })

  it('gives up after the timeout', async () => {
    vi.useFakeTimers()
    const gate = new DapiPinGate()
    const waiting = gate.wait('mainnet', 1000)
    vi.advanceTimersByTime(1000)

    await expect(waiting).rejects.toThrow('no reachable evonode for mainnet')
  })

  it('waits again after a reset', () => {
    const gate = new DapiPinGate()
    gate.pin('testnet')
    gate.reset()

    expect(gate.wait('testnet', 1000)).not.toBeNull()
  })
})
