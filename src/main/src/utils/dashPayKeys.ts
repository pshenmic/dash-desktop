import {createCipheriv, createDecipheriv, randomBytes} from 'node:crypto'
import {secp256k1} from '@noble/curves/secp256k1.js'
import {bytesToNumberBE, numberToBytesBE} from '@noble/curves/utils.js'
import {hmac} from '@noble/hashes/hmac.js'
import {sha256, sha512} from '@noble/hashes/sha2.js'
import {bytesToHex, concatBytes} from '@noble/hashes/utils.js'
import {base58} from '@scure/base'
import {HARDENED_OFFSET, HDKey} from '@scure/bip32'
import {KeyPairController} from 'dash-platform-sdk/src/keyPair/index.js'
import {COIN_TYPE} from '../constants/addresses'
import {AddressDeriver} from '../types/AddressWindow'
import {Network} from '../types/Network'

// DIP-14: an index from 2^32 up (an identity id) enters the HMAC as 32 bytes.
// The child's `index` cannot hold it, so only its descendants serialize as BIP32.
export function deriveChild256(parent: HDKey, index: bigint, hardened: boolean): HDKey {
  if (index < 2n ** 32n) return parent.deriveChild(Number(index) + (hardened ? HARDENED_OFFSET : 0))
  const {privateKey, publicKey, chainCode} = parent
  if (publicKey == null || chainCode == null || (hardened && privateKey == null)) {
    throw new Error('A hardened 256-bit index needs a private parent key')
  }
  const key = hardened ? concatBytes(Uint8Array.of(0), privateKey!) : publicKey
  const I = hmac(sha512, chainCode, concatBytes(key, numberToBytesBE(index, 32)))
  const {Fn, BASE, fromBytes} = secp256k1.Point
  const tweak = Fn.fromBytes(I.slice(0, 32))
  return new HDKey({
    versions: parent.versions,
    depth: parent.depth + 1,
    parentFingerprint: parent.fingerprint,
    chainCode: I.slice(32),
    ...privateKey == null
      ? {publicKey: fromBytes(publicKey).add(BASE.multiply(tweak)).toBytes(true)}
      : {privateKey: Fn.toBytes(Fn.create(tweak + Fn.fromBytes(privateKey)))},
  })
}

// derivePath for a path whose levels may be 256-bit, written 0x….
export function derivePath256(root: HDKey, path: string): HDKey {
  return path.split('/').slice(1).reduce(
    (key, level) => deriveChild256(key, BigInt(level.replace("'", '')), level.endsWith("'")),
    root,
  )
}

export function dashPayAccountPath(network: Network): string {
  return `m/9'/${COIN_TYPE[network]}'/15'/0'`
}

// DIP-15: the key its owner hands a contact to pay them on. Both levels are
// non-hardened, so the account's public key derives it as well as the seed does.
export function deriveDashPayContactKey(account: HDKey, ownerId: Uint8Array, toUserId: Uint8Array): HDKey {
  return deriveChild256(deriveChild256(account, bytesToNumberBE(ownerId), false), bytesToNumberBE(toUserId), false)
}

export function dashPayAddressPath(network: Network, ownerId: string, toUserId: string, index: number): string {
  return `${dashPayAccountPath(network)}/0x${bytesToHex(base58.decode(ownerId))}/0x${bytesToHex(base58.decode(toUserId))}/${index}`
}

// One DIP-15 chain: the key ownerId handed toUserId, at its place on ownerId's tree.
export function dashPayAddressDeriver(key: HDKey, network: Network, ownerId: string, toUserId: string): AddressDeriver {
  const keyPair = new KeyPairController()
  return {
    derive: index => ({
      index,
      address: keyPair.p2pkhAddress(key.deriveChild(index).publicKey!, network),
      derivationPath: dashPayAddressPath(network, ownerId, toUserId, index),
    }),
  }
}

// libsecp256k1's default ECDH hash: SHA-256 of the compressed shared point.
export function dashPaySharedKey(privateKey: Uint8Array, publicKey: Uint8Array): Uint8Array {
  return sha256(secp256k1.getSharedSecret(privateKey, publicKey, true))
}

// IV || AES-256-CBC(parent fingerprint || chain code || public key): 96 bytes.
export function encryptDashPayContactKey(sharedKey: Uint8Array, key: HDKey): Uint8Array {
  const iv = randomBytes(16)
  const cipher = createCipheriv('aes-256-cbc', sharedKey, iv)
  return concatBytes(iv, cipher.update(dashPayContactKeyBytes(key)), cipher.final())
}

export function decryptDashPayContactKey(sharedKey: Uint8Array, encrypted: Uint8Array): HDKey {
  const decipher = createDecipheriv('aes-256-cbc', sharedKey, encrypted.subarray(0, 16))
  const plain = concatBytes(decipher.update(encrypted.subarray(16)), decipher.final())
  return new HDKey({chainCode: plain.subarray(4, 36), publicKey: plain.subarray(36)})
}

// DIP-15 for account 0, version 0, keyed by the sender's ENCRYPTION private key.
// DIP-15 leaves which 28 bits ambiguous; iOS takes the digest's tail, and so do we.
export function accountReference(senderSecretKey: Uint8Array, key: HDKey): number {
  return Number(bytesToNumberBE(hmac(sha256, senderSecretKey, dashPayContactKeyBytes(key)).subarray(28, 32)) >> 4n)
}

function dashPayContactKeyBytes(key: HDKey): Uint8Array {
  return concatBytes(numberToBytesBE(key.parentFingerprint, 4), key.chainCode!, key.publicKey!)
}
