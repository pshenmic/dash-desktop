import {createCipheriv, createDecipheriv, randomBytes} from 'node:crypto'
import {secp256k1} from '@noble/curves/secp256k1.js'
import {bytesToNumberBE, numberToBytesBE} from '@noble/curves/utils.js'
import {hmac} from '@noble/hashes/hmac.js'
import {sha256, sha512} from '@noble/hashes/sha2.js'
import {concatBytes} from '@noble/hashes/utils.js'
import {HARDENED_OFFSET, HDKey} from '@scure/bip32'
import {KeyPairController} from 'dash-platform-sdk/src/keyPair/index.js'
import {COIN_TYPE} from '../constants/addresses'
import {Network} from '../types/Network'

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

// DIP-15: the key a contact derives our payment addresses from.
export function deriveContactKey(seed: Uint8Array, network: Network, ours: Uint8Array, theirs: Uint8Array): HDKey {
  const account = HDKey.fromMasterSeed(seed).derive(`m/9'/${COIN_TYPE[network]}'/15'/0'`)
  return deriveChild256(deriveChild256(account, bytesToNumberBE(ours), false), bytesToNumberBE(theirs), false)
}

// libsecp256k1's default ECDH hash: SHA-256 of the compressed shared point.
export function contactSharedKey(privateKey: Uint8Array, publicKey: Uint8Array): Uint8Array {
  return sha256(secp256k1.getSharedSecret(privateKey, publicKey, true))
}

// IV || AES-256-CBC(parent fingerprint || chain code || public key): 96 bytes.
export function encryptContactKey(sharedKey: Uint8Array, key: HDKey): Uint8Array {
  const iv = randomBytes(16)
  const cipher = createCipheriv('aes-256-cbc', sharedKey, iv)
  return concatBytes(iv, cipher.update(contactKeyBytes(key)), cipher.final())
}

export function decryptContactKey(sharedKey: Uint8Array, encrypted: Uint8Array): HDKey {
  const decipher = createDecipheriv('aes-256-cbc', sharedKey, encrypted.subarray(0, 16))
  const plain = concatBytes(decipher.update(encrypted.subarray(16)), decipher.final())
  return new HDKey({chainCode: plain.subarray(4, 36), publicKey: plain.subarray(36)})
}

// DIP-15 for account 0, version 0: the top 28 bits of HMAC-SHA256(secret, key).
export function accountReference(key: HDKey): number {
  return Number(bytesToNumberBE(hmac(sha256, key.privateKey!, contactKeyBytes(key)).subarray(0, 4)) >> 4n)
}

// A contact key is ours alone to pay into, so our own history shows how far it is used.
export function nextContactAddress(xpub: string, network: Network, paid: Set<string>): string {
  const key = HDKey.fromExtendedKey(xpub)
  const keyPair = new KeyPairController()
  for (let index = 0; ; index++) {
    const address = keyPair.p2pkhAddress(key.deriveChild(index).publicKey!, network)
    if (!paid.has(address)) return address
  }
}

function contactKeyBytes(key: HDKey): Uint8Array {
  return concatBytes(numberToBytesBE(key.parentFingerprint, 4), key.chainCode!, key.publicKey!)
}
