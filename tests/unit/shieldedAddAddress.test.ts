import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'
import {ShieldedService} from '../../src/main/src/services/ShieldedService'
import {NEW_ADDRESS_LOOKAHEAD_LIMIT} from '../../src/main/src/constants'

const PASSWORD = 'password'

// Diversified addresses share one incoming viewing key, so a synced wallet can
// already hold notes on indexes it never displayed. addAddress walks past those.
function service(usedIndexes: number[], storedCount = 0): {
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
  }
  const shieldedNoteDAO = {getUsedAddresses: vi.fn().mockResolvedValue(used)}
  const shieldedAddressDAO = {saveAddresses: vi.fn().mockResolvedValue(undefined)}

  const svc = new ShieldedService(
    walletDAO as never, {} as never, shieldedNoteDAO as never, {} as never,
    shieldedAddressDAO as never, {} as never, {} as never, {} as never,
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
