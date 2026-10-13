import {describe, it, expect, vi, beforeEach} from 'vitest'

type Provider = (request: {network: string; quorumType: number; quorumHash: Uint8Array}) => Promise<Uint8Array | null>

const captured = vi.hoisted(() => ({
  options: [] as Array<{proofs?: {quorumKeyProvider?: Provider}}>,
  setProofOptions: vi.fn(),
  explorer: vi.fn(),
}))

vi.mock('dash-platform-sdk', () => ({
  DashPlatformSDK: class {
    constructor(options: never) {
      captured.options.push(options)
    }
    setProofOptions = captured.setProofOptions
  },
  GRPCConnectionPool: class {},
  platformExplorerQuorumKeyProvider: captured.explorer,
}))

import {SdkRegistry} from '../../src/main/platform/SdkRegistry'

const HASH = '00000020d10c69ac9aa6b78072691d62bb215028a6847c662dd78fddb1bba8cd'
const KEY = new Uint8Array(48).fill(7)
const request = (hash: string, quorumType = 6): {network: string; quorumType: number; quorumHash: Uint8Array} =>
  ({network: 'testnet', quorumType, quorumHash: Uint8Array.from(Buffer.from(hash, 'hex'))})

describe('quorum keys proven by p2p', () => {
  let registry: SdkRegistry
  const provider = (): Provider => captured.options[0]!.proofs!.quorumKeyProvider!

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    captured.options.length = 0
    captured.setProofOptions.mockReset()
    captured.explorer.mockReset().mockResolvedValue(new Uint8Array(48).fill(9))
    registry = new SdkRegistry(() => undefined)
  })

  it('swaps the proof options of the running SDK rather than building another', () => {
    registry.get('testnet')
    registry.setQuorumKeys('testnet', new Map([[`6:${HASH}`, KEY]]))
    registry.setQuorumKeys('testnet', new Map([[`6:${HASH}`, KEY]]))

    expect(captured.options).toHaveLength(1)
    expect(captured.setProofOptions).toHaveBeenCalledTimes(1)
  })

  it('answers a proven quorum without asking Platform Explorer', async () => {
    registry.setQuorumKeys('testnet', new Map([[`6:${HASH}`, KEY]]))
    registry.get('testnet')

    await expect(provider()(request(HASH))).resolves.toBe(KEY)
    expect(captured.explorer).not.toHaveBeenCalled()
  })

  it('asks Platform Explorer for a quorum p2p has not proven', async () => {
    registry.setQuorumKeys('testnet', new Map([[`6:${HASH}`, KEY]]))
    registry.get('testnet')

    const other = request('11'.repeat(32))
    await provider()(other)
    expect(captured.explorer).toHaveBeenCalledWith(other)
  })

  it('never answers with the key of another quorum type sharing the hash', async () => {
    registry.setQuorumKeys('testnet', new Map([[`1:${HASH}`, KEY]]))
    registry.get('testnet')

    await provider()(request(HASH))
    expect(captured.explorer).toHaveBeenCalledTimes(1)
  })
})
