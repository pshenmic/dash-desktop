import {describe, it, expect} from 'vitest'
import {
  AddressFundsFeeStrategyStepWASM,
  AddressFundsTransferTransitionWASM,
  InputAddressWASM,
  OutputAddressWASM,
  PlatformAddressWASM,
  SerializedActionWASM,
  UnshieldTransitionWASM,
} from 'pshenmic-dpp'
import {
  noteKey,
  noteSideTransaction,
  shieldedActions,
  shieldedSides,
} from '../../src/main/src/utils/shieldedTransitionNotes'
import {PersistNote, ShieldedAction} from '../../src/main/src/types/ShieldedNote'
import {TransitionHeader} from '../../src/main/src/types/PlatformTransaction'

const ADDRESS = 'tdash1zrv282am68uyhwerv7cm0ja86445lqg5zymu7rw24yyj2d443f3a7lnxtanyr5wwuv6350g3h4av5'
const OTHER = 'tdash1zq2j8jgzspy42499wzc4xd4ez6tj6nvuhuw20ucdugrys2xjfgqaplc32zja5kx62w6qu8sylj2vk'

const bytes = (fill: number): Uint8Array => new Uint8Array(32).fill(fill)

const note = (overrides: Partial<PersistNote> = {}): PersistNote => ({
  index: 1, amount: 1_000n, address: ADDRESS, spent: false, nullifier: bytes(9), ...overrides,
})

const action = (cmx: number, nullifier: number): ShieldedAction =>
  ({cmx: bytes(cmx), nullifier: bytes(nullifier)})

const gap: TransitionHeader = {
  hash: 'HASH',
  type: 'UNSHIELD',
  date: new Date('2026-09-23T16:13:37.955Z'),
  blockHeight: 598_545,
  status: 'SUCCESS',
  gasCredits: 168_934_000n,
}

describe('shieldedSides', () => {
  it('counts a note paid to us up and one of ours it spent down', () => {
    const spent = note({index: 4525, amount: 2_957_457_752_000n, nullifier: bytes(1)})
    const change = note({index: 4527, amount: 2_857_288_818_000n, nullifier: bytes(2)})

    const sides = shieldedSides(
      [action(7, 1), action(3, 5)],
      new Map([[noteKey(bytes(3)), change]]),
      new Map([[noteKey(bytes(1)), spent]]),
    )

    // What left the pool for an address: the rest came back as change.
    expect(sides).toEqual(new Map([[ADDRESS, -100_168_934_000n]]))
  })

  // Every action carries both halves, and an Orchard pair pads the side it does
  // not use with a note that belongs to no one.
  it('ignores the halves that are not ours', () => {
    const mine = note({index: 4519, amount: 443_567_314_000n})
    const sides = shieldedSides(
      [action(1, 1), action(4, 8)],
      new Map([[noteKey(bytes(4)), mine]]),
      new Map(),
    )

    expect(sides).toEqual(new Map([[ADDRESS, 443_567_314_000n]]))
  })

  it('keeps each of our shielded addresses on its own side', () => {
    const sides = shieldedSides(
      [action(1, 2)],
      new Map([[noteKey(bytes(1)), note({amount: 500n, address: OTHER})]]),
      new Map([[noteKey(bytes(2)), note({amount: 900n})]]),
    )

    expect(sides).toEqual(new Map([[OTHER, 500n], [ADDRESS, -900n]]))
  })

  it('reports nothing for a transition none of our notes is in', () => {
    expect(shieldedSides([action(1, 2)], new Map(), new Map())).toEqual(new Map())
  })
})

describe('noteSideTransaction', () => {
  it('puts the pool side on the end its sign names', () => {
    const paid = noteSideTransaction('w1', gap, ADDRESS, -100_168_934_000n)
    expect(paid.sender).toEqual([{source: ADDRESS, amount: 100_168_934_000n}])
    expect(paid.recipient).toEqual([])
    expect(paid.netCredits).toBe(-100_168_934_000n)
    expect(paid.amountCredits).toBe(100_168_934_000n)

    const received = noteSideTransaction('w1', gap, ADDRESS, 443_567_314_000n)
    expect(received.recipient).toEqual([{source: ADDRESS, amount: 443_567_314_000n}])
    expect(received.sender).toEqual([])
  })

  it('carries the transition fields the walks already reported', () => {
    const row = noteSideTransaction('w1', gap, ADDRESS, 1n)
    expect(row.type).toBe('UNSHIELD')
    expect(row.date).toBe(gap.date)
    expect(row.blockHeight).toBe(598_545)
    expect(row.gasCredits).toBe(168_934_000n)
  })
})

describe('shieldedActions', () => {
  it('reads the commitments and nullifiers off a shielded transition', () => {
    const fill = (value: number, length = 32): Uint8Array => new Uint8Array(length).fill(value)
    const transition = new UnshieldTransitionWASM(
      PlatformAddressWASM.fromBytes(new Uint8Array(21)),
      [new SerializedActionWASM(fill(1), fill(2), fill(3), fill(4, 580), fill(5), fill(6, 64))],
      100n,
      fill(7),
      fill(8, 192),
      fill(9, 64),
    )

    const [action] = shieldedActions(transition.toStateTransition().base64())

    expect(noteKey(action.cmx)).toBe(noteKey(fill(3)))
    expect(noteKey(action.nullifier)).toBe(noteKey(fill(1)))
  })

  // A transition that never touched the pool has no note side to count.
  it('reports no actions for a transition of another kind', () => {
    const address = (index: number): PlatformAddressWASM => {
      const raw = new Uint8Array(21)
      raw[1] = index
      return PlatformAddressWASM.fromBytes(raw)
    }
    const transfer = new AddressFundsTransferTransitionWASM(
      [new InputAddressWASM(address(0), 1, 5_000n)],
      [AddressFundsFeeStrategyStepWASM.DeductFromInput(0)],
      0,
      [],
      [new OutputAddressWASM(address(1), 4_000n)],
    )

    expect(shieldedActions(transfer.toStateTransition().base64())).toEqual([])
  })
})
