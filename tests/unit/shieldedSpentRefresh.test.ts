import {describe, expect, it, vi} from 'vitest'
import {ShieldedService} from '../../src/main/src/services/platform/ShieldedService'
import {Preferences} from '../../src/main/src/preferences'
import {PersistNote} from '../../src/main/src/types/ShieldedNote'

const WALLET = 'wallet-1'

const nullifier = (byte: number): Uint8Array => new Uint8Array(32).fill(byte)

const note = (index: number, overrides: Partial<PersistNote> = {}): PersistNote => ({
  index,
  amount: 100n,
  address: `tdash1address${index}`,
  spent: false,
  nullifier: nullifier(index),
  ...overrides,
})

function service(notes: PersistNote[], spent: Uint8Array[]) {
  const markSpent = vi.fn(async () => {})
  const request = vi.fn(async () => ({spent}))
  const shieldedNoteDAO = {getOwnedNotes: async () => notes, markSpent}
  const walletDAO = {getWalletById: async () => ({walletId: WALLET, network: 'testnet'})}

  const svc = new ShieldedService(
    walletDAO as never,
    null as never,
    shieldedNoteDAO as never,
    null as never,
    null as never,
    {request} as never,
    null as never,
    Preferences.default(),
  )
  return {svc, request, markSpent}
}

describe('ShieldedService.refreshSpentFlags', () => {
  it('marks the notes the chain reports as spent', async () => {
    const {svc, markSpent} = service([note(1), note(2), note(3)], [nullifier(2)])

    await svc.refreshSpentFlags(WALLET)

    expect(markSpent).toHaveBeenCalledWith(WALLET, [2])
  })

  it('writes nothing when every note is still spendable', async () => {
    const {svc, markSpent} = service([note(1), note(2)], [])

    await svc.refreshSpentFlags(WALLET)

    expect(markSpent).not.toHaveBeenCalled()
  })

  // The check is what makes a locked wallet able to catch up, so nothing about
  // it may reach for a seed or a password.
  it('asks the worker without a seed', async () => {
    const {svc, request} = service([note(1)], [])

    await svc.refreshSpentFlags(WALLET)

    expect(request).toHaveBeenCalledWith('checkNullifiers', 'testnet', {nullifiers: [nullifier(1)]})
  })

  it('leaves out notes already known to be spent', async () => {
    const {svc, request} = service([note(1, {spent: true}), note(2)], [])

    await svc.refreshSpentFlags(WALLET)

    expect(request).toHaveBeenCalledWith('checkNullifiers', 'testnet', {nullifiers: [nullifier(2)]})
  })

  // Rows written before the migration carry none, and a sync is what fills them.
  it('skips notes with no stored nullifier rather than querying for null', async () => {
    const {svc, request} = service([note(1, {nullifier: null})], [])

    await svc.refreshSpentFlags(WALLET)

    expect(request).not.toHaveBeenCalled()
  })
})
