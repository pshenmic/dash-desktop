import {describe, it, expect, vi} from 'vitest'
import {IdentityRegistrationService} from '../../src/main/src/services/platform/IdentityRegistrationService'
import {AssetLockFunder} from '../../src/main/src/types/AssetLock'
import {TOPUP_KEY_GAP_LIMIT, TOPUP_KEY_SCAN_LIMIT} from '../../src/main/src/constants/addresses'

// The credit address at m/9'/coin'/5'/2'/i receives the asset lock output, so a
// used index is one the chain has history for.
function service(usedIndexes: number[]): {
  service: IdentityRegistrationService
  getUsedAddresses: ReturnType<typeof vi.fn>
} {
  const used = new Set(usedIndexes.map(i => `addr-${i}`))
  const getUsedAddresses = vi.fn(async (_walletId: string, addresses: string[]) =>
    addresses.filter(a => used.has(a)))

  const funder = {getUsedAddresses} as unknown as AssetLockFunder
  const svc = new IdentityRegistrationService(
    {} as never, {} as never, {} as never, {} as never, funder, {} as never,
  )

  // Stand in for the BIP32 + WASM derivation the real path runs per index.
  ;(svc as unknown as {keyPair: unknown}).keyPair = {
    p2pkhAddress: (pub: {index: number}) => `addr-${pub.index}`,
  }
  ;(svc as unknown as {deriveTopUpKey: unknown}).deriveTopUpKey =
    async (_seed: Uint8Array, index: number) => ({getPublicKey: () => ({bytes: () => ({index})})})

  return {service: svc, getUsedAddresses}
}

const seed = new Uint8Array(64)

describe('choosing the next top-up funding index', () => {
  it('starts at zero on a wallet that has never topped up', async () => {
    const {service: svc} = service([])

    expect(await svc.findNextTopUpIndex('w1', seed, 'testnet')).toBe(0)
  })

  it('skips indexes the chain has already seen', async () => {
    const {service: svc} = service([0, 1, 2])

    expect(await svc.findNextTopUpIndex('w1', seed, 'testnet')).toBe(3)
  })

  // The whole point: a restored wallet has no local funding rows, so a count
  // would hand back 0 and reuse a credit key the chain already spent to.
  it('finds the frontier with no local rows to count', async () => {
    const {service: svc} = service([0, 1, 2, 3, 4, 5, 6])

    expect(await svc.findNextTopUpIndex('w1', seed, 'testnet')).toBe(7)
  })

  // Past the last used index, not into the hole at 1. A hole can also be an
  // asset lock the indexer has not caught up to yet, and reusing that index
  // would collide with a funding already on its way.
  it('takes the frontier rather than filling a hole', async () => {
    const {service: svc} = service([0, 2])

    expect(await svc.findNextTopUpIndex('w1', seed, 'testnet')).toBe(3)
  })

  it('resumes past a used index that follows unused ones', async () => {
    const used = [0, TOPUP_KEY_GAP_LIMIT + 1]
    const {service: svc} = service(used)

    const next = await svc.findNextTopUpIndex('w1', seed, 'testnet')

    expect(used).not.toContain(next)
    expect(next).toBeGreaterThan(TOPUP_KEY_GAP_LIMIT + 1)
  })

  it('asks in batches rather than one address per call', async () => {
    const {service: svc, getUsedAddresses} = service([])

    await svc.findNextTopUpIndex('w1', seed, 'testnet')

    expect(getUsedAddresses).toHaveBeenCalledTimes(1)
    expect(getUsedAddresses.mock.calls[0][1]).toHaveLength(TOPUP_KEY_GAP_LIMIT)
  })

  it('refuses rather than looping when every index in range is used', async () => {
    const all = Array.from({length: TOPUP_KEY_SCAN_LIMIT + TOPUP_KEY_GAP_LIMIT}, (_, i) => i)
    const {service: svc} = service(all)

    await expect(svc.findNextTopUpIndex('w1', seed, 'testnet'))
      .rejects.toThrow(/No unused top-up funding index/)
  })
})
