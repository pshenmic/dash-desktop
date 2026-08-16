import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'

const stub = vi.hoisted(() => ({
  decryptMnemonic: vi.fn(() => 'mnemonic'),
  deriveShieldedAddress: vi.fn(),
  derivePlatformAddress: vi.fn(),
}))

// The seed every assertion follows: unlockWallet hands this exact array out, so
// a zeroed byte here is the wallet's own seed being overwritten.
const seed = new Uint8Array(64).fill(7)

vi.mock('../../src/main/src/utils', () => ({decryptMnemonic: stub.decryptMnemonic}))

vi.mock('dash-platform-sdk/src/keyPair/index.js', () => ({
  KeyPairController: class {
    mnemonicToSeed = (): Uint8Array => seed
    deriveShieldedAddress = stub.deriveShieldedAddress
    derivePlatformAddress = stub.derivePlatformAddress
  },
}))

vi.mock('pshenmic-dpp', () => ({OrchardAddressWASM: class {}}))

import {ShieldedService} from '../../src/main/src/services/ShieldedService'
import {WalletDAO} from '../../src/main/src/database/WalletDAO'
import {ShieldedNoteDAO} from '../../src/main/src/database/ShieldedNoteDAO'
import {ShieldedPoolDAO} from '../../src/main/src/database/ShieldedPoolDAO'
import {ShieldedAddressDAO} from '../../src/main/src/database/ShieldedAddressDAO'
import {IdentityDAO} from '../../src/main/src/database/IdentityDAO'
import {PlatformWorkerService} from '../../src/main/src/services/PlatformWorkerService'
import {IdentityRegistrationService} from '../../src/main/src/services/IdentityRegistrationService'
import {AssetLockService} from '../../src/main/src/services/AssetLockService'

const WALLET = 'wallet-1'
const PASSWORD = 'password'

const zeroed = (): boolean => seed.every(byte => byte === 0)

type Fns = Record<string, ReturnType<typeof vi.fn>>

function wire(): {service: ShieldedService; request: ReturnType<typeof vi.fn>; noteDAO: Fns; poolDAO: Fns} {
  const request = vi.fn(async (kind: string) => {
    if (kind === 'notesCount') return {count: 0}
    if (kind === 'sync') return {notes: []}
    return {stHash: 'st', identityId: null}
  })

  const walletDAO = {
    getWalletById: vi.fn().mockResolvedValue({
      walletId: WALLET, network: 'testnet', encryptedMnemonic: 'enc', platformXpub: 'xpub',
    }),
    getShieldedAddressCount: vi.fn().mockResolvedValue(1),
    setShieldedAddressCount: vi.fn(),
    getShieldedDecodedCount: vi.fn().mockResolvedValue(0),
    setShieldedDecodedCount: vi.fn(),
  }

  const noteDAO: Fns = {
    getUsedAddresses: vi.fn().mockResolvedValue(new Set<string>()),
    getOwnedNotes: vi.fn().mockResolvedValue([]),
    markSpent: vi.fn(),
    upsertNotes: vi.fn(),
  }

  const poolDAO: Fns = {
    getAllEncryptedNotes: vi.fn().mockResolvedValue([]),
    getEncryptedNotes: vi.fn().mockResolvedValue([]),
    getEncryptedNotesFrom: vi.fn().mockResolvedValue([{index: 0, ciphertext: 'aa'}]),
    saveEncryptedNotes: vi.fn(),
    getCount: vi.fn().mockResolvedValue(0),
  }

  const service = new ShieldedService(
    walletDAO as unknown as WalletDAO,
    {getIdentitiesByWalletId: vi.fn().mockResolvedValue([])} as unknown as IdentityDAO,
    noteDAO as unknown as ShieldedNoteDAO,
    poolDAO as unknown as ShieldedPoolDAO,
    {saveAddresses: vi.fn(), getAddresses: vi.fn().mockResolvedValue([])} as unknown as ShieldedAddressDAO,
    {findNextIdentityIndex: vi.fn().mockResolvedValue(0)} as unknown as IdentityRegistrationService,
    {request} as unknown as PlatformWorkerService,
    {} as unknown as AssetLockService,
  )

  return {service, request, noteDAO, poolDAO}
}

describe('the seed a shielded job holds', () => {
  beforeEach(() => {
    seed.fill(7)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    stub.deriveShieldedAddress.mockReturnValue({toBech32m: () => 'shielded-addr'})
    stub.derivePlatformAddress.mockReturnValue({toBech32m: () => 'platform-addr'})
  })

  afterEach(() => vi.restoreAllMocks())

  // NEW_ADDRESS_LOOKAHEAD_LIMIT is 2000 at ~5ms per derivation, so this loop can
  // hold the seed for seconds.
  it('is zeroed once a new address is derived', async () => {
    const {service} = wire()

    await service.addAddress(WALLET, PASSWORD)

    expect(zeroed()).toBe(true)
  })

  it('is zeroed when address derivation gives up', async () => {
    const {service, noteDAO} = wire()
    noteDAO.getUsedAddresses.mockResolvedValue(new Set(['shielded-addr']))

    await expect(service.addAddress(WALLET, PASSWORD)).rejects.toThrow(/No unused shielded address/)

    expect(zeroed()).toBe(true)
  })

  // Proving runs for minutes past the method that started it, which is why the
  // job zeroes rather than the caller.
  it('is zeroed when a spend settles', async () => {
    const {service} = wire()

    await service.startTransfer(WALLET, PASSWORD, 'recipient', 100n)
    await vi.waitFor(() => expect(zeroed()).toBe(true))
  })

  it('is zeroed when a spend fails', async () => {
    const {service, request} = wire()
    request.mockRejectedValue(new Error('prover died'))

    await service.startTransfer(WALLET, PASSWORD, 'recipient', 100n)
    await vi.waitFor(() => expect(zeroed()).toBe(true))
  })

  // Nothing has taken ownership of the seed on this path, so the entry method
  // still has to clean up after itself.
  it('is zeroed when a spend throws before the job starts', async () => {
    const {service, poolDAO} = wire()
    poolDAO.getAllEncryptedNotes.mockRejectedValue(new Error('database is locked'))

    await service.startTransfer(WALLET, PASSWORD, 'recipient', 100n)

    expect(zeroed()).toBe(true)
  })

  it('is zeroed when a sync settles', async () => {
    const {service} = wire()

    await service.startSync(WALLET, PASSWORD)
    await vi.waitFor(() => expect(zeroed()).toBe(true))
  })

  it('is zeroed when an identity create settles', async () => {
    const {service} = wire()

    await service.startIdentityCreate(WALLET, PASSWORD, 100n)
    await vi.waitFor(() => expect(zeroed()).toBe(true))
  })

  // The refresh that follows a spend trial-decrypts with the same seed. Zeroing
  // without waiting for it hands the worker 64 zero bytes and decodes nothing,
  // silently — the balance just fails to move.
  it('is still live while the post-spend refresh trial-decrypts', async () => {
    const {service, request} = wire()
    let liveDuringSync: boolean | null = null
    request.mockImplementation(async (kind: string) => {
      if (kind === 'notesCount') return {count: 0}
      if (kind === 'sync') { liveDuringSync = !zeroed(); return {notes: []} }
      return {stHash: 'st', identityId: null}
    })

    await service.startTransfer(WALLET, PASSWORD, 'recipient', 100n)
    await vi.waitFor(() => expect(zeroed()).toBe(true))

    expect(liveDuringSync).toBe(true)
  })

  // Zeroing on handoff rather than on settlement would hand the prover 64 zero
  // bytes and derive the wrong keys from them.
  it('is still live while the prover holds it', async () => {
    const {service, request} = wire()
    let liveDuringSpend: boolean | null = null
    request.mockImplementation(async (kind: string) => {
      if (kind === 'notesCount') return {count: 0}
      if (kind === 'spend') liveDuringSpend = !zeroed()
      return {stHash: 'st', identityId: null}
    })

    await service.startTransfer(WALLET, PASSWORD, 'recipient', 100n)
    await vi.waitFor(() => expect(zeroed()).toBe(true))

    expect(liveDuringSpend).toBe(true)
  })
})
