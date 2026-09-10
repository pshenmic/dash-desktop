import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SelectableUtxo } from '../../src/renderer/src/api/types'
import type { WalletUtxosResult } from '../../src/renderer/src/types/CoinControl'
import { buildCoinControlInventory, isCoinControlSelectionValid } from '../../src/renderer/src/utils/coinControl'

const harness = vi.hoisted(() => ({
  walletId: 'wallet-a' as string | null,
  syncIncomplete: false,
  connectionType: 'p2p',
  getUtxos: vi.fn(),
  index: 0,
  states: [] as unknown[],
  memos: [] as Array<{deps: unknown[]; value: unknown}>,
  effects: [] as Array<{deps: unknown[]; cleanup?: () => void}>,
  pendingEffects: [] as Array<() => void>,
}))

vi.mock('react', () => ({
  useState: <T>(initial: T) => {
    const index = harness.index++
    if (!(index in harness.states)) harness.states[index] = initial
    return [harness.states[index], (update: T | ((previous: T) => T)) => {
      harness.states[index] = typeof update === 'function'
        ? (update as (previous: T) => T)(harness.states[index] as T)
        : update
    }]
  },
  useMemo: (factory: () => unknown, deps: unknown[]) => {
    const index = harness.index++
    const previous = harness.memos[index]
    if (!previous || deps.some((dep, i) => !Object.is(dep, previous.deps[i]))) {
      harness.memos[index] = {deps, value: factory()}
    }
    return harness.memos[index].value
  },
  useEffect: (effect: () => void | (() => void), deps: unknown[]) => {
    const index = harness.index++
    const previous = harness.effects[index]
    if (!previous || deps.some((dep, i) => !Object.is(dep, previous.deps[i]))) {
      harness.effects[index] = {deps}
      harness.pendingEffects.push(() => {
        previous?.cleanup?.()
        harness.effects[index] = {deps, cleanup: effect() || undefined}
      })
    }
  },
}))

vi.mock('@renderer/api', () => ({API: {getUtxos: harness.getUtxos}}))
vi.mock('@renderer/contexts/AuthContext', () => ({
  useAuth: () => ({status: {selectedWalletId: harness.walletId}}),
}))
vi.mock('@renderer/contexts/ConnectionModeContext', () => ({
  useConnectionModeContext: () => ({syncIncomplete: harness.syncIncomplete, desired: harness.connectionType}),
}))

import { useWalletUtxos } from '../../src/renderer/src/hooks/useWalletUtxos'

const selectedUtxo: SelectableUtxo = {txid: 'selected', vout: 0, satoshis: 100_000n, address: 'address-a', height: 0}
const otherUtxo: SelectableUtxo = {txid: 'other', vout: 1, satoshis: 200_000n, address: 'address-b', height: 10}

function render(refreshKey = 0): WalletUtxosResult {
  harness.index = 0
  return useWalletUtxos(refreshKey)
}

function commitEffects(): void {
  for (const effect of harness.pendingEffects.splice(0)) effect()
}

async function flushPromises(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
}

function selectionStatus(result: WalletUtxosResult): {canSubmit: boolean; unavailable: boolean} {
  const ready = !result.loading && result.error == null
  const valid = isCoinControlSelectionValid(
    {kind: 'coreOutpoints', outpoints: ['selected:0']},
    buildCoinControlInventory({utxos: result.utxos, coreAddresses: [], platformAddresses: [], shieldedNotes: []}),
  )
  return {canSubmit: ready && valid, unavailable: ready && !valid}
}

async function loadInitial(): Promise<void> {
  harness.getUtxos.mockResolvedValueOnce([selectedUtxo, otherUtxo])
  expect(selectionStatus(render())).toEqual({canSubmit: false, unavailable: false})
  commitEffects()
  await flushPromises()
  expect(selectionStatus(render())).toEqual({canSubmit: true, unavailable: false})
}

beforeEach(() => {
  for (const effect of harness.effects) effect?.cleanup?.()
  harness.walletId = 'wallet-a'
  harness.syncIncomplete = false
  harness.connectionType = 'p2p'
  harness.states = []
  harness.memos = []
  harness.effects = []
  harness.pendingEffects = []
  harness.getUtxos.mockReset()
})

describe('spendable UTXO refresh readiness', () => {
  it('keeps selected inputs through a new-block sync and blocks until the refreshed snapshot arrives', async () => {
    await loadInitial()
    const refresh = Promise.withResolvers<SelectableUtxo[]>()
    harness.getUtxos.mockReturnValueOnce(refresh.promise)

    harness.syncIncomplete = true
    expect(render().utxos).toEqual([selectedUtxo, otherUtxo])
    expect(selectionStatus(render())).toEqual({canSubmit: false, unavailable: false})
    commitEffects()
    expect(harness.getUtxos).toHaveBeenCalledTimes(1)

    harness.syncIncomplete = false
    expect(selectionStatus(render())).toEqual({canSubmit: false, unavailable: false})
    commitEffects()
    expect(selectionStatus(render())).toEqual({canSubmit: false, unavailable: false})

    refresh.resolve([{...selectedUtxo, height: 11}, otherUtxo])
    await flushPromises()
    expect(selectionStatus(render())).toEqual({canSubmit: true, unavailable: false})
  })

  it.each([
    {label: 'remaining unselected input', utxos: [otherUtxo]},
    {label: 'empty inventory', utxos: []},
  ])('reports a spent selected input only after a successful reload: $label', async ({utxos}) => {
    await loadInitial()
    const refresh = Promise.withResolvers<SelectableUtxo[]>()
    harness.getUtxos.mockReturnValueOnce(refresh.promise)
    expect(selectionStatus(render(1))).toEqual({canSubmit: false, unavailable: false})
    commitEffects()
    refresh.resolve(utxos)
    await flushPromises()
    expect(selectionStatus(render(1))).toEqual({canSubmit: false, unavailable: true})
  })

  it('keeps selections valid when only unselected inputs disappear', async () => {
    await loadInitial()
    harness.getUtxos.mockResolvedValueOnce([selectedUtxo])
    render(1)
    commitEffects()
    await flushPromises()
    expect(selectionStatus(render(1))).toEqual({canSubmit: true, unavailable: false})
  })

  it('retains amounts on refresh failure, blocks spending, and retries without an unavailable warning', async () => {
    await loadInitial()
    harness.getUtxos.mockRejectedValueOnce(new Error('offline'))
    expect(selectionStatus(render(1))).toEqual({canSubmit: false, unavailable: false})
    commitEffects()
    await flushPromises()
    const failed = render(1)
    expect(failed.utxos).toEqual([selectedUtxo, otherUtxo])
    expect(failed.error).toContain('offline')
    expect(selectionStatus(failed)).toEqual({canSubmit: false, unavailable: false})

    harness.getUtxos.mockResolvedValueOnce([selectedUtxo])
    failed.retry()
    expect(render(1).error).toBeNull()
    expect(selectionStatus(render(1))).toEqual({canSubmit: false, unavailable: false})
    commitEffects()
    await flushPromises()
    expect(selectionStatus(render(1))).toEqual({canSubmit: true, unavailable: false})
  })

  it('does not expose a previous wallet inventory while switching or after a failed load', async () => {
    await loadInitial()
    harness.walletId = 'wallet-b'
    harness.getUtxos.mockRejectedValueOnce(new Error('offline'))
    expect(render()).toMatchObject({utxos: [], loading: true, error: null})
    commitEffects()
    await flushPromises()
    expect(render().utxos).toEqual([])
    expect(selectionStatus(render())).toEqual({canSubmit: false, unavailable: false})
  })

  it('ignores a cancelled request when a different wallet request is active', async () => {
    const first = Promise.withResolvers<SelectableUtxo[]>()
    const second = Promise.withResolvers<SelectableUtxo[]>()
    harness.getUtxos.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    render()
    commitEffects()
    harness.walletId = 'wallet-b'
    render()
    commitEffects()
    first.resolve([selectedUtxo])
    await flushPromises()
    expect(render()).toMatchObject({utxos: [], loading: true, error: null})
    second.resolve([otherUtxo])
    await flushPromises()
    expect(render()).toMatchObject({utxos: [otherUtxo], loading: false, error: null})
  })

  it('rejects a response from before a new sync cycle', async () => {
    await loadInitial()
    const obsolete = Promise.withResolvers<SelectableUtxo[]>()
    const current = Promise.withResolvers<SelectableUtxo[]>()
    harness.getUtxos.mockReturnValueOnce(obsolete.promise).mockReturnValueOnce(current.promise)
    render(1)
    commitEffects()
    harness.syncIncomplete = true
    render(1)
    commitEffects()
    harness.syncIncomplete = false
    render(1)
    commitEffects()
    obsolete.resolve([])
    await flushPromises()
    expect(render(1).utxos).toEqual([selectedUtxo, otherUtxo])
    expect(selectionStatus(render(1))).toEqual({canSubmit: false, unavailable: false})
    current.resolve([selectedUtxo])
    await flushPromises()
    expect(selectionStatus(render(1))).toEqual({canSubmit: true, unavailable: false})
  })

  it('reloads after a connection mode switch and exposes no funds without a wallet', async () => {
    await loadInitial()
    harness.connectionType = 'rpc'
    harness.getUtxos.mockResolvedValueOnce([selectedUtxo])
    expect(selectionStatus(render())).toEqual({canSubmit: false, unavailable: false})
    commitEffects()
    await flushPromises()
    expect(selectionStatus(render())).toEqual({canSubmit: true, unavailable: false})

    harness.walletId = null
    expect(render()).toMatchObject({utxos: [], loading: false, error: null})
    commitEffects()
    expect(harness.getUtxos).toHaveBeenCalledTimes(2)
  })
})
