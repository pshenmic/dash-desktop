import {describe, it, expect, vi} from 'vitest'
import {PlatformWorkerService} from '../../src/main/src/services/platform/PlatformWorkerService'
import {PlatformEvent, PlatformPhase} from '../../src/main/platform/types/messages'

const REQUEST = 'request-1'

// The child is never forked here: what a send looks like from main is the event
// stream the worker sends back.
const emit = (service: PlatformWorkerService, event: PlatformEvent): void =>
  (service as unknown as {handleEvent: (event: PlatformEvent) => void}).handleEvent(event)

const phase = (service: PlatformWorkerService, phase: PlatformPhase): void =>
  emit(service, {type: 'progress', requestId: REQUEST, phase, fetched: 0, total: 0})

describe('what a broadcast tells the rest of main', () => {
  it('reports the one phase that means a transition went out', () => {
    const service = new PlatformWorkerService()
    const listener = vi.fn()
    service.onTransitionBroadcast(listener)

    phase(service, 'proving')
    phase(service, 'signing')
    expect(listener).not.toHaveBeenCalled()

    phase(service, 'broadcasting')
    expect(listener).toHaveBeenCalledTimes(1)
  })

  // Fetching notes and quoting fees are requests too, and neither leaves a
  // transition behind for the explorer to index.
  it('says nothing for a request that only read', () => {
    const service = new PlatformWorkerService()
    const listener = vi.fn()
    service.onTransitionBroadcast(listener)

    phase(service, 'queued')
    phase(service, 'fetching')

    expect(listener).not.toHaveBeenCalled()
  })

  it('still forwards the phase to the request that asked for progress', () => {
    const service = new PlatformWorkerService()
    const onProgress = vi.fn()
    service.onTransitionBroadcast(vi.fn())
    ;(service as unknown as {progressHandlers: Map<string, unknown>}).progressHandlers.set(REQUEST, {onProgress})

    phase(service, 'broadcasting')

    expect(onProgress).toHaveBeenCalledWith('broadcasting', 0, 0)
  })
})
