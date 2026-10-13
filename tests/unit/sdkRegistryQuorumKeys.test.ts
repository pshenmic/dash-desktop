import {describe, it, expect, vi, beforeEach} from 'vitest'

const captured = vi.hoisted(() => ({
  options: [] as Array<{proofs?: {quorumKeyProvider?: (request: {quorumType: number; quorumHash: Uint8Array}) => Promise<Uint8Array | null>}}>,
  explorer: vi.fn(),
}))

vi.mock('dash-platform-sdk', () => ({
  DashPlatformSDK: class {
    constructor(options: never) {
      captured.options.push(options)
    }
  },
  GRPCConnectionPool: class {},
  platformExplorerQuorumKeyProvider: captured.explorer,
}))

import {SdkRegistry} from '../../src/main/platform/SdkRegistry'

const HASH = '00000020d10c69ac9aa6b78072691d62bb215028a6847c662dd78fddb1bba8cd'
const KEY = new Uint8Array(48).fill(7)
const request = (hash: string, quorumType = 6): {quorumType: number; quorumHash: Uint8Array} =>
  ({quorumType, quorumHash: Uint8Array.from(Buffer.from(hash, 'hex'))})

describe('quorum keys proven by p2p', () => {
  let registry: SdkRegistry

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    captured.options.length = 0
    captured.explorer.mockReset().mockResolvedValue(new Uint8Array(48).fill(9))
    registry = new SdkRegistry(() => undefined)
  })

  it('leaves the SDK on its default provider until p2p has keys', () => {
    registry.get('testnet')

    expect(captured.options[0]!.proofs).toBeUndefined()
  })

  it('answers a proven quorum without asking Platform Explorer', async () => {
    registry.setQuorumKeys('testnet', new Map([[`6:${HASH}`, KEY]]))
    registry.get('testnet')

    await expect(captured.options[0]!.proofs!.quorumKeyProvider!(request(HASH))).resolves.toBe(KEY)
    expect(captured.explorer).not.toHaveBeenCalled()
  })

  // A set left behind the tip misses the newest quorum; refusing would fail every proof it signs.
  it('asks Platform Explorer for a quorum p2p has not proven', async () => {
    registry.setQuorumKeys('testnet', new Map([[`6:${HASH}`, KEY]]))
    registry.get('testnet')

    const other = request('11'.repeat(32))
    await captured.options[0]!.proofs!.quorumKeyProvider!(other)
    expect(captured.explorer).toHaveBeenCalledWith(other)
  })

  it('never answers with the key of another quorum type sharing the hash', async () => {
    registry.setQuorumKeys('testnet', new Map([[`1:${HASH}`, KEY]]))
    registry.get('testnet')

    await captured.options[0]!.proofs!.quorumKeyProvider!(request(HASH))
    expect(captured.explorer).toHaveBeenCalledTimes(1)
  })
})
