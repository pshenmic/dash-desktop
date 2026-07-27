import {describe, it, expect} from 'vitest'
import {KeyedLane, Lane} from '../../src/main/platform/Lane'

// A lane starts its task a few microtasks in (the tail's catch, then the
// then). Yield through the macrotask queue rather than counting ticks.
const flush = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0))

const deferred = <T>(): {promise: Promise<T>; resolve: (v: T) => void; reject: (e: unknown) => void} => {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return {promise, resolve, reject}
}

describe('Lane', () => {
  it('runs tasks one at a time, in order', async () => {
    const lane = new Lane()
    const order: string[] = []
    const first = deferred<void>()

    const a = lane.run(async () => {
      order.push('a:start')
      await first.promise
      order.push('a:end')
    })
    const b = lane.run(async () => {
      order.push('b:start')
    })

    expect(order).toEqual([])
    await flush()
    expect(order).toEqual(['a:start'])

    first.resolve()
    await Promise.all([a, b])
    expect(order).toEqual(['a:start', 'a:end', 'b:start'])
  })

  it('does not wedge on a rejected task', async () => {
    const lane = new Lane()
    const failed = lane.run(async () => {
      throw new Error('boom')
    })

    await expect(failed).rejects.toThrow('boom')
    await expect(lane.run(async () => 'ok')).resolves.toBe('ok')
  })

  it('reports depth and returns to idle', async () => {
    const lane = new Lane()
    const gate = deferred<void>()

    const running = lane.run(() => gate.promise)
    const queued = lane.run(async () => undefined)
    expect(lane.size).toBe(2)
    expect(lane.idle).toBe(false)

    gate.resolve()
    await Promise.all([running, queued])
    expect(lane.size).toBe(0)
    expect(lane.idle).toBe(true)
  })
})

describe('KeyedLane', () => {
  it('serialises within a key and overlaps across keys', async () => {
    const lane = new KeyedLane()
    const running: string[] = []
    const gateA = deferred<void>()
    const gateB = deferred<void>()

    const a1 = lane.run('identity-a', async () => {
      running.push('a1')
      await gateA.promise
    })
    const a2 = lane.run('identity-a', async () => {
      running.push('a2')
    })
    const b1 = lane.run('identity-b', async () => {
      running.push('b1')
      await gateB.promise
    })

    await flush()
    // a2 is behind a1; b1 is on its own key and started immediately.
    expect(running).toEqual(['a1', 'b1'])

    gateA.resolve()
    gateB.resolve()
    await Promise.all([a1, a2, b1])
    expect(running).toEqual(['a1', 'b1', 'a2'])
  })

  it('drops a lane once it goes idle', async () => {
    const lane = new KeyedLane()
    const gate = deferred<void>()

    const running = lane.run('k', () => gate.promise)
    expect(lane.keys).toBe(1)

    gate.resolve()
    await running
    expect(lane.keys).toBe(0)
    expect(lane.size).toBe(0)
  })

  it('keeps a failed key usable', async () => {
    const lane = new KeyedLane()
    await expect(lane.run('k', async () => {
      throw new Error('nope')
    })).rejects.toThrow('nope')

    await expect(lane.run('k', async () => 'ok')).resolves.toBe('ok')
    expect(lane.keys).toBe(0)
  })
})