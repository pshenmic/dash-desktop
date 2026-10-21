import {secp256k1} from '@noble/curves/secp256k1.js'
import {numberToBytesBE} from '@noble/curves/utils.js'
import {hmac} from '@noble/hashes/hmac.js'
import {sha512} from '@noble/hashes/sha2.js'
import {concatBytes} from '@noble/hashes/utils.js'
import {HARDENED_OFFSET, HDKey} from '@scure/bip32'

// DIP-14: an index from 2^32 up (an identity id) enters the HMAC as 32 bytes.
// The child's `index` cannot hold it, so only its descendants serialize as BIP32.
export function deriveChild256(parent: HDKey, index: bigint, hardened: boolean): HDKey {
  if (index < 2n ** 32n) return parent.deriveChild(Number(index) + (hardened ? HARDENED_OFFSET : 0))
  const {privateKey, publicKey, chainCode} = parent
  if (privateKey == null || publicKey == null || chainCode == null) {
    throw new Error('A 256-bit index needs a private parent key')
  }
  const key = hardened ? concatBytes(Uint8Array.of(0), privateKey) : publicKey
  const I = hmac(sha512, chainCode, concatBytes(key, numberToBytesBE(index, 32)))
  const {Fn} = secp256k1.Point
  return new HDKey({
    versions: parent.versions,
    depth: parent.depth + 1,
    parentFingerprint: parent.fingerprint,
    chainCode: I.slice(32),
    privateKey: Fn.toBytes(Fn.create(Fn.fromBytes(I.slice(0, 32)) + Fn.fromBytes(privateKey))),
  })
}
