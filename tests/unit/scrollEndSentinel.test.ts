import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SCROLL_CONTAINER_ID } from '@renderer/constants/scrollIndicator'
import { TRANSACTIONS_SENTINEL_ROOT_MARGIN } from '@renderer/constants/transactionsPage'

const harness = vi.hoisted(() => ({
  refs: [] as Array<{ current: unknown }>,
  refCall: 0,
  pending: null as { effect: () => void | (() => void); deps: unknown[] } | null,
  deps: null as unknown[] | null,
  cleanup: undefined as void | (() => void),
}))

vi.mock('react', async (importOriginal) => ({
  ...await importOriginal<typeof import('react')>(),
  useRef: <T,>(initial: T): { current: T } => {
    harness.refs[harness.refCall] ??= { current: initial }
    return harness.refs[harness.refCall++] as { current: T }
  },
  useEffect: (effect: () => void | (() => void), deps: unknown[]) => {
    harness.pending = { effect, deps }
  },
}))

import { useScrollEndSentinel } from '@renderer/hooks/useScrollEndSentinel'

class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = []
  observed: unknown[] = []
  disconnected = false

  constructor(readonly callback: (entries: Array<{ isIntersecting: boolean }>) => void, readonly options: IntersectionObserverInit) {
    FakeIntersectionObserver.instances.push(this)
  }

  observe(target: unknown): void {
    this.observed.push(target)
  }

  disconnect(): void {
    this.disconnected = true
  }

  fire(isIntersecting: boolean): void {
    if (!this.disconnected) this.callback([{ isIntersecting }])
  }
}

const root = { id: SCROLL_CONTAINER_ID }
const sentinel = { tagName: 'BUTTON' }

function render(enabled: boolean, onReach: () => void, revision: number): void {
  harness.refCall = 0
  const ref = useScrollEndSentinel(enabled, onReach, revision)
  ref.current = enabled ? sentinel as unknown as HTMLButtonElement : null
  const pending = harness.pending
  if (pending === null) return
  const same = harness.deps?.length === pending.deps.length && harness.deps.every((value, i) => value === pending.deps[i])
  if (same) return
  harness.cleanup?.()
  harness.deps = pending.deps
  harness.cleanup = pending.effect()
}

function observers(): FakeIntersectionObserver[] {
  return FakeIntersectionObserver.instances
}

beforeEach(() => {
  harness.refs = []
  harness.pending = null
  harness.deps = null
  harness.cleanup = undefined
  FakeIntersectionObserver.instances = []
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver)
  vi.stubGlobal('document', { getElementById: (id: string) => id === SCROLL_CONTAINER_ID ? root : null })
})

afterEach(() => {
  harness.cleanup?.()
  vi.unstubAllGlobals()
})

describe('useScrollEndSentinel', () => {
  it('observes the sentinel against the layout scroll container with the prefetch margin', () => {
    render(true, vi.fn(), 50)

    expect(observers()).toHaveLength(1)
    expect(observers()[0].options).toEqual({ root, rootMargin: TRANSACTIONS_SENTINEL_ROOT_MARGIN })
    expect(observers()[0].observed).toEqual([sentinel])
  })

  it('calls onReach once per arm, only when the sentinel intersects', () => {
    const onReach = vi.fn()
    render(true, onReach, 50)

    observers()[0].fire(false)
    expect(onReach).not.toHaveBeenCalled()

    observers()[0].fire(true)
    observers()[0].fire(true)
    expect(onReach).toHaveBeenCalledOnce()
    expect(observers()[0].disconnected).toBe(true)
  })

  it('re-arms after each append and calls the latest onReach', () => {
    const first = vi.fn()
    const latest = vi.fn()
    render(true, first, 50)
    observers()[0].fire(true)

    render(true, latest, 100)
    expect(observers()).toHaveLength(2)
    expect(observers()[1].observed).toEqual([sentinel])

    observers()[1].fire(true)
    expect(first).toHaveBeenCalledOnce()
    expect(latest).toHaveBeenCalledOnce()
  })

  it('does not re-observe when neither enabled nor revision changes', () => {
    render(true, vi.fn(), 50)
    render(true, vi.fn(), 50)

    expect(observers()).toHaveLength(1)
    expect(observers()[0].disconnected).toBe(false)
  })

  it('observes nothing while disabled and disconnects when disabled', () => {
    render(false, vi.fn(), 50)
    expect(observers()).toHaveLength(0)

    render(true, vi.fn(), 50)
    expect(observers()).toHaveLength(1)

    render(false, vi.fn(), 50)
    expect(observers()).toHaveLength(1)
    expect(observers()[0].disconnected).toBe(true)
  })
})
