import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'
import {ShieldedService} from '../../src/main/src/services/platform/ShieldedService'
import {NEW_ADDRESS_LOOKAHEAD_LIMIT} from '../../src/main/src/constants'
import {Preferences} from '../../src/main/src/preferences'

const PASSWORD = 'password'

// Diversified addresses share one incoming viewing key, so a synced wallet can
// already hold notes on indexes it never displayed. addAddress walks past those.
function service(usedIndexes: number[], storedCount = 0, {poolCount = 0, decoded = 0} = {}): {
  service: ShieldedService
  setCount: ReturnType<typeof vi.fn>
  derived: () => number[]
} {
  const used = new Set(usedIndexes.map(i => `addr-${i}`))
  const setCount = vi.fn().mockResolvedValue(undefined)
  const seen: number[] = []

  const walletDAO = {
    getWalletById: vi.fn().mockResolvedValue({walletId: 'w1', network: 'testnet', encryptedMnemonic: 'x'}),
    getShieldedAddressCount: vi.fn().mockResolvedValue(storedCount),
    setShieldedAddressCount: setCount,
    getShieldedDecodedCount: vi.fn().mockResolvedValue(decoded),
  }
  const shieldedNoteDAO = {getUsedAddresses: vi.fn().mockResolvedValue(used)}
  const shieldedAddressDAO = {saveAddresses: vi.fn().mockResolvedValue(undefined)}
  const shieldedPoolDAO = {getCount: vi.fn().mockResolvedValue(poolCount)}

  const svc = new ShieldedService(
    walletDAO as never, {} as never, shieldedNoteDAO as never, shieldedPoolDAO as never,
    shieldedAddressDAO as never, {} as never, {} as never,
    Preferences.default(),
  )

  // Stand in for the WASM derivation, which is 5.2 ms a call.
  ;(svc as unknown as {keyPair: unknown}).keyPair = {
    deriveShieldedAddress: (_seed: unknown, _network: string, _account: number, index: number) => {
      seen.push(index)
      return {toBech32m: (): string => `addr-${index}`}
    },
  }

  return {service: svc, setCount, derived: () => seen}
}

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

describe('adding a shielded address', () => {
  beforeEach(() => vi.spyOn(console, 'log').mockImplementation(() => undefined))
  afterEach(() => vi.restoreAllMocks())

  it('takes the next index when nothing above the count is used', async () => {
    const {service: svc, setCount} = service([], 3)

    await svc.addAddress('w1', PASSWORD)

    expect(setCount).toHaveBeenCalledWith('w1', 4)
  })

  it('walks past indexes that already hold notes', async () => {
    const {service: svc, setCount} = service([3, 4, 5], 3)

    await svc.addAddress('w1', PASSWORD)

    expect(setCount).toHaveBeenCalledWith('w1', 7)
  })

  // Persisting the count on exhaustion would return an address that already
  // holds a note — the linkage the pool exists to prevent.
  it('refuses rather than handing back a used address when the window is exhausted', async () => {
    const all = Array.from({length: NEW_ADDRESS_LOOKAHEAD_LIMIT + 1}, (_, i) => i)
    const {service: svc, setCount} = service(all, 0)

    await expect(svc.addAddress('w1', PASSWORD)).rejects.toThrow(/No unused shielded address/)
    expect(setCount).not.toHaveBeenCalled()
  })

  // Each step is a synchronous WASM derivation on the main process, so the
  // ceiling is a freeze budget — it must not be exceeded.
  it('stops deriving at the limit', async () => {
    const all = Array.from({length: NEW_ADDRESS_LOOKAHEAD_LIMIT + 500}, (_, i) => i)
    const {service: svc, derived} = service(all, 0)

    await svc.addAddress('w1', PASSWORD).catch(() => undefined)

    expect(derived()).toHaveLength(NEW_ADDRESS_LOOKAHEAD_LIMIT)
  })
})

// Diversified addresses are only known to be used once their notes have been
// trial-decrypted, so a wallet behind the pool has no basis to call one fresh.
describe('revealing before the pool is decoded', () => {
  beforeEach(() => vi.spyOn(console, 'log').mockImplementation(() => undefined))
  afterEach(() => vi.restoreAllMocks())

  it('refuses while notes are still undecoded', async () => {
    const {service: svc, setCount} = service([], 1, {poolCount: 12, decoded: 4})

    await expect(svc.addAddress('w1', PASSWORD)).rejects.toThrow(/Sync the shielded pool/)
    expect(setCount).not.toHaveBeenCalled()
  })

  it('allows it once the wallet has caught up', async () => {
    const {service: svc, setCount} = service([], 1, {poolCount: 12, decoded: 12})

    await svc.addAddress('w1', PASSWORD)

    expect(setCount).toHaveBeenCalledWith('w1', 2)
  })

  // An empty pool cannot have paid anyone, so a genuinely new wallet is not
  // held behind a sync it has no reason to run.
  it('allows it when the pool is empty', async () => {
    const {service: svc, setCount} = service([], 1)

    await svc.addAddress('w1', PASSWORD)

    expect(setCount).toHaveBeenCalledWith('w1', 2)
  })

  it('serialises concurrent reveals so neither is lost', async () => {
    const {service: svc, setCount} = service([], 1)
    let count = 1
    ;(svc as unknown as {walletDAO: {getShieldedAddressCount: () => Promise<number>}}).walletDAO
      .getShieldedAddressCount = async () => count
    setCount.mockImplementation(async (_id: string, next: number) => { count = next })

    await Promise.all([svc.addAddress('w1', PASSWORD), svc.addAddress('w1', PASSWORD)])

    expect(setCount.mock.calls.map(([, next]) => next)).toEqual([2, 3])
  })
})
