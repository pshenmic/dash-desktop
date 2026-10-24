import {describe, it, expect, vi, beforeEach} from 'vitest'
import type {QuorumKeyProvider} from 'dash-platform-sdk'

const captured = vi.hoisted(() => ({
  options: [] as Array<{quorumKeyProvider?: QuorumKeyProvider}>,
  explorer: vi.fn(),
}))

vi.mock('dash-platform-sdk', () => ({
  DashPlatformSDK: class {
    constructor(options: never) {
      captured.options.push(options)
    }
  },
  GRPCConnectionPool: class {},
  PlatformExplorerQuorumKeyProvider: class {
    getQuorumPublicKey = captured.explorer
  },
}))

import {P2PQuorumKeyProvider} from '../../src/main/platform/P2PQuorumKeyProvider'
import {SdkRegistry} from '../../src/main/platform/SdkRegistry'

const HASH = '00000020d10c69ac9aa6b78072691d62bb215028a6847c662dd78fddb1bba8cd'
const KEY = new Uint8Array(48).fill(7)

describe('quorum keys proven by p2p', () => {
  let provider: P2PQuorumKeyProvider

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    captured.options.length = 0
    captured.explorer.mockReset().mockResolvedValue('09'.repeat(48))
    provider = new P2PQuorumKeyProvider('testnet')
  })

  it('answers a proven quorum without asking Platform Explorer', async () => {
    provider.setKeys(new Map([[`6:${HASH}`, KEY]]))

    await expect(provider.getQuorumPublicKey(6, HASH)).resolves.toBe('07'.repeat(48))
    expect(captured.explorer).not.toHaveBeenCalled()
  })

  it('asks Platform Explorer for a quorum p2p has not proven', async () => {
    provider.setKeys(new Map([[`6:${HASH}`, KEY]]))

    await expect(provider.getQuorumPublicKey(6, '11'.repeat(32))).resolves.toBe('09'.repeat(48))
    expect(captured.explorer).toHaveBeenCalledWith(6, '11'.repeat(32))
  })

  it('never answers with the key of another quorum type sharing the hash', async () => {
    provider.setKeys(new Map([[`1:${HASH}`, KEY]]))

    await provider.getQuorumPublicKey(6, HASH)
    expect(captured.explorer).toHaveBeenCalledTimes(1)
  })

  it('falls back to Platform Explorer once p2p withdraws its keys', async () => {
    provider.setKeys(new Map([[`6:${HASH}`, KEY]]))
    provider.setKeys(new Map())

    await provider.getQuorumPublicKey(6, HASH)
    expect(captured.explorer).toHaveBeenCalledTimes(1)
  })

  it('hands every SDK the registry builds for a network the same provider', () => {
    const registry = new SdkRegistry()
    registry.get('testnet')
    registry.setQuorumKeys('testnet', new Map([[`6:${HASH}`, KEY]]))
    registry.setPinnedDapiUrls('testnet', ['https://127.0.0.1:443'])
    registry.get('testnet')

    expect(captured.options).toHaveLength(2)
    expect(captured.options[0]!.quorumKeyProvider).toBeInstanceOf(P2PQuorumKeyProvider)
    expect(captured.options[1]!.quorumKeyProvider).toBe(captured.options[0]!.quorumKeyProvider)
  })
})
