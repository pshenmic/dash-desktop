import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'
import {ShieldedService} from '../../src/main/src/services/platform/ShieldedService'
import {SHIELDED_ADDRESS_WINDOW} from '../../src/main/src/constants/addresses'
import {ShieldedAddressRow} from '../../src/main/src/types/ShieldedAddress'
import {Preferences} from '../../src/main/src/preferences'

const PASSWORD = 'password'
const WALLET = 'w1'

// The window walks the same gap as L1, but its oracle is the decrypted-note set:
// a note proves its own diversified address was used.
function service(usedIndexes: number[], revealed = 0, {poolCount = 0, decoded = 0} = {}): {
  service: ShieldedService
  rows: () => ShieldedAddressRow[]
  derived: () => number[]
} {
  const used = new Set(usedIndexes.map(i => `addr-${i}`))
  const seen: number[] = []
  const stored: ShieldedAddressRow[] = Array.from({length: revealed}, (_, index) => ({
    walletId: WALLET, index, address: `addr-${index}`, isUsed: false,
  }))

  const walletDAO = {
    getWalletById: vi.fn().mockResolvedValue({walletId: WALLET, network: 'testnet', encryptedMnemonic: 'x'}),
    getShieldedDecodedCount: vi.fn().mockResolvedValue(decoded),
  }
  const shieldedNoteDAO = {
    getUsedAddresses: vi.fn().mockResolvedValue(used),
    getOwnedNotes: vi.fn().mockResolvedValue([]),
  }
  const shieldedPoolDAO = {
    getCount: vi.fn().mockResolvedValue(poolCount),
    getEncryptedNotesFrom: vi.fn().mockResolvedValue([]),
  }
  const platform = {request: vi.fn().mockResolvedValue({count: poolCount})}
  const shieldedAddressDAO = {
    getAddresses: async () => [...stored],
    insertAddresses: async (rows: ShieldedAddressRow[]) => {
      const present = new Set(stored.map(row => row.index))
      stored.push(...rows.filter(row => !present.has(row.index)))
      stored.sort((a, b) => a.index - b.index)
    },
    markAddressesUsed: async (_id: string, indexes: number[]) => {
      for (const row of stored) if (indexes.includes(row.index)) row.isUsed = true
    },
  }

  const svc = new ShieldedService(
    walletDAO as never, {} as never, shieldedNoteDAO as never, shieldedPoolDAO as never,
    shieldedAddressDAO as never, platform as never, {} as never,
    Preferences.default(),
  )

  return {service: svc, rows: () => stored, derived: () => seen}
}

// Stand in for the WASM derivation, which is 5.2 ms a call.
vi.mock('../../src/main/src/utils/shieldedAddress', () => ({
  shieldedAddressDeriver: () => ({
    derive: (index: number) => ({index, address: `addr-${index}`, derivationPath: "m/32'/1'/0'"}),
  }),
}))

// unlockWallet decrypts a real mnemonic; the seed itself never reaches the stub.
vi.mock('../../src/main/src/utils/walletSeed', () => {
  const unlocked = {wallet: {network: 'testnet'}, seed: new Uint8Array(64)}
  return {
    unlockWallet: vi.fn().mockResolvedValue(unlocked),
    zeroSeed: vi.fn(),
    withUnlockedWallet: vi.fn(
      (_dao: unknown, _id: string, _pw: string, work: (u: typeof unlocked) => Promise<unknown>) => work(unlocked),
    ),
  }
})

describe('the shielded address window', () => {
  beforeEach(() => vi.spyOn(console, 'log').mockImplementation(() => undefined))
  afterEach(() => vi.restoreAllMocks())

  it('seeds one gap for a wallet that has revealed nothing', async () => {
    const {service: svc, rows} = service([])

    await svc.getAddresses(WALLET, PASSWORD)

    expect(rows().map(row => row.index)).toEqual([0, 1, 2, 3, 4])
  })

  it('flags the indexes the notes prove were used', async () => {
    const {service: svc, rows} = service([2])

    await svc.getAddresses(WALLET, PASSWORD)

    expect(rows().find(row => row.index === 2)?.isUsed).toBe(true)
  })

  // The whole point of the gap: a used diversifier must leave a full run of
  // unused ones behind it, or the next reveal lands on one that already received.
  it('keeps a full gap past the last used index', async () => {
    const {service: svc, rows} = service([4], 5)

    await svc.refreshNotes(WALLET, 'testnet', new Uint8Array(64))

    const highest = Math.max(...rows().map(row => row.index))
    expect(highest).toBe(4 + SHIELDED_ADDRESS_WINDOW.gapLimit)
  })

  // A restored wallet has rows but no used flags until its notes are decoded.
  // The walk is what puts them back, and it runs off the sync that decoded them.
  it('recovers used flags a restore lost', async () => {
    const {service: svc, rows} = service([0, 1, 2], 3)

    await svc.refreshNotes(WALLET, 'testnet', new Uint8Array(64))

    expect(rows().filter(row => row.isUsed).map(row => row.index)).toEqual([0, 1, 2])
    expect(Math.max(...rows().map(row => row.index))).toBe(2 + SHIELDED_ADDRESS_WINDOW.gapLimit)
  })
})

describe('revealing a shielded address', () => {
  beforeEach(() => vi.spyOn(console, 'log').mockImplementation(() => undefined))
  afterEach(() => vi.restoreAllMocks())

  it('takes the index past the frontier', async () => {
    const {service: svc, rows} = service([], 3)

    await svc.addAddress(WALLET, PASSWORD)

    expect(rows().some(row => row.index === 3)).toBe(true)
  })

  it('refuses while notes are still undecoded', async () => {
    const {service: svc, rows} = service([], 3, {poolCount: 12, decoded: 4})

    await expect(svc.addAddress(WALLET, PASSWORD)).rejects.toThrow(/Sync the shielded pool/)
    expect(rows()).toHaveLength(3)
  })

  // An empty pool cannot have paid anyone, so a genuinely new wallet is not held
  // behind a sync it has no reason to run.
  it('allows it when the pool is empty', async () => {
    const {service: svc, rows} = service([], 3)

    await svc.addAddress(WALLET, PASSWORD)

    expect(rows().length).toBeGreaterThan(3)
  })

  it('serialises concurrent reveals so neither is lost', async () => {
    const {service: svc, rows} = service([], 3)

    await Promise.all([svc.addAddress(WALLET, PASSWORD), svc.addAddress(WALLET, PASSWORD)])

    expect(rows().some(row => row.index === 3)).toBe(true)
    expect(rows().some(row => row.index === 4)).toBe(true)
  })
})
