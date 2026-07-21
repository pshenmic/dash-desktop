import {HDKey} from '@scure/bip32'
import {Network} from '../types'

const HD_VERSIONS: Record<Network, {private: number; public: number}> = {
  mainnet: {private: 0x0488ade4, public: 0x0488b21e},
  testnet: {private: 0x04358394, public: 0x043587cf},
}

export interface GapEntry {
  index: number
  isUsed: boolean
}

export function planGapExtension(entries: GapEntry[], gapLimit: number): number[] {
  let lastUsed = -1
  let maxIndex = -1
  for (const entry of entries) {
    if (entry.index > maxIndex) maxIndex = entry.index
    if (entry.isUsed && entry.index > lastUsed) lastUsed = entry.index
  }
  const indexes: number[] = []
  for (let i = maxIndex + 1; i <= lastUsed + gapLimit; i++) indexes.push(i)
  return indexes
}

export function coreAccountPath(coinType: number, accountId: number): string {
  return `m/44'/${coinType}'/${accountId}'`
}

export function deriveCorePublicKey(coreXpub: string, network: Network, isChange: boolean, index: number): Uint8Array {
  const accountNode = HDKey.fromExtendedKey(coreXpub, HD_VERSIONS[network])
  const child = accountNode.deriveChild(isChange ? 1 : 0).deriveChild(index)
  if (child.publicKey == null) {
    throw new Error(`Could not derive core public key at index ${index}`)
  }
  return child.publicKey
}
