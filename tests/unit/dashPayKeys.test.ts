import {describe, it, expect} from 'vitest'
import {HDKey} from '@scure/bip32'
import {bytesToHex, hexToBytes} from '@noble/hashes/utils.js'
import {KeyPairController} from 'dash-platform-sdk/src/keyPair/index.js'
import {base58} from '@scure/base'
import {accountReference, dashPayAccountPath, dashPayAddressDeriver, dashPaySharedKey, decryptDashPayContactKey, deriveChild256, deriveDashPayContactKey, derivePath256, encryptDashPayContactKey} from '../../src/main/src/utils/dashPayKeys'

const seed = hexToBytes('b16d3782e714da7c55a397d5f19104cfed7ffa8036ac514509bbb50807f8ac598eeb26f0797bd8cc221a6cbff2168d90a5e9ee025a5bd977977b9eccd97894bb')

function derive(path: string): HDKey {
  return path.split('/').slice(1).reduce(
    (key, level) => deriveChild256(key, BigInt(level.replace("'", '')), level.endsWith("'")),
    HDKey.fromMasterSeed(seed, {private: 0x04358394, public: 0x043587cf}),
  )
}

// The four DIP-14 test vectors.
describe('deriveChild256', () => {
  it.each([
    [
      "m/0x775d3854c910b7dee436869c4724bed2fe0784e198b8a39f02bbb49d8ebcfc3b/0xf537439f36d04a15474ff7423e4b904a14373fafb37a41db74c84f1dbb5c89a6'/0x4c4592ca670c983fc43397dfd21a6f427fac9b4ac53cb4dcdc6522ec51e81e79/0",
      'e8781fdef72862968cd9a4d2df34edaf9dcc5b17629ec505f0d2d1a8ed6f9f09',
      'tprv8iNr6Z8PgAHmYSgMKGbq42kMVAAQmwmzm5iTJdUXoxLf25zG3GeRCvnEdC6HKTHkU59nZkfjvcGk9VW2YHsFQMwsZrQLyNrGx9c37kgb368',
      'tpubDF4tEyAdpXySRui9CvGRTSQU4BgLwGxuLPKEb9WqEE93raF2ffU1PRQ6oJHCgZ7dArzcMj9iKG8s8EFA1DdwgzWAXs61uFuRE1bQi8kAmLy',
    ],
    [
      "m/9'/5'/15'/0'/0x555d3854c910b7dee436869c4724bed2fe0784e198b8a39f02bbb49d8ebcfc3a'/0xa137439f36d04a15474ff7423e4b904a14373fafb37a41db74c84f1dbb5c89b5'/0",
      'fac40790776d171ee1db90899b5eb2df2f7d2aaf35ad56f07ffb8ed2c57f8e60',
      'tprv8p9LqE2tA2b94gc3ciRNA525WVkFvzkcC9qjpKEcGaTqjb9u2pwTXj41KkZTj3c1a6fJUpyXRfcB4dimsYsLMjQjsTJwi5Ukx6tJ5BpmYpx',
      'tpubDLqNye58JQGox9dqWN5xZUgC5XGC6KwWmTSX6qGugrGEa5QffDm3iDfsVtX7qyXuWoQsXA6YCSuckKshyjnwiGGoYWHonAv2X98HTU613UH',
    ],
  ])('reproduces %s', (path, privateKey, xprv, xpub) => {
    const key = derive(path)
    expect(bytesToHex(key.privateKey!)).toBe(privateKey)
    expect(key.privateExtendedKey).toBe(xprv)
    expect(key.publicExtendedKey).toBe(xpub)
  })

  it.each([
    ['m/0x775d3854c910b7dee436869c4724bed2fe0784e198b8a39f02bbb49d8ebcfc3b', 'f6a95ae75ea8362d9478932f71b262b3d981918fe030316686a475dea4889938'],
    ["m/0x775d3854c910b7dee436869c4724bed2fe0784e198b8a39f02bbb49d8ebcfc3b/0xf537439f36d04a15474ff7423e4b904a14373fafb37a41db74c84f1dbb5c89a6'", 'b898ad92d3a0698bc3117d3777d82676673816ce52f4fc2f1263a2f676825f90'],
  ])('derives the key at a 256-bit index %s', (path, privateKey) => {
    expect(bytesToHex(derive(path).privateKey!)).toBe(privateKey)
  })

  // DIP-14's public derivation: a watch-only parent reaches the same child.
  it('derives a non-hardened 256-bit child from a public parent too', () => {
    const parent = derive("m/9'")
    const xpub = HDKey.fromExtendedKey(parent.publicExtendedKey, {private: 0x04358394, public: 0x043587cf})
    const index = 0x775d3854c910b7dee436869c4724bed2fe0784e198b8a39f02bbb49d8ebcfc3bn
    expect(deriveChild256(xpub, index, false).publicKey).toEqual(deriveChild256(parent, index, false).publicKey)
    expect(deriveChild256(xpub, index, false).chainCode).toEqual(deriveChild256(parent, index, false).chainCode)
    expect(() => deriveChild256(xpub, index, true)).toThrow('A hardened 256-bit index needs a private parent key')
  })

  it('walks a plain BIP-44 path exactly as BIP-32 does', () => {
    const root = HDKey.fromMasterSeed(seed)
    expect(derivePath256(root, "m/44'/1'/0'/1/42").privateKey).toEqual(root.derive("m/44'/1'/0'/1/42").privateKey)
  })
})

describe('contact request keys', () => {
  const account = HDKey.fromMasterSeed(seed).derive(dashPayAccountPath('testnet'))
  const ours = new Uint8Array(32).fill(0xaa)
  const theirs = new Uint8Array(32).fill(0xbb)
  const encryption = derive("m/1'").privateKey!
  const decryption = derive("m/2'").privateKey!

  it('agrees on one shared key from either side', () => {
    const shared = dashPaySharedKey(encryption, derive("m/2'").publicKey!)
    expect(shared).toEqual(dashPaySharedKey(decryption, derive("m/1'").publicKey!))
    expect(shared).toHaveLength(32)
  })

  // The recipient derives our payment addresses from what they decrypt.
  it('hands the recipient a key that derives our payment addresses', () => {
    const key = deriveDashPayContactKey(account, ours, theirs)
    const shared = dashPaySharedKey(encryption, derive("m/2'").publicKey!)
    const encrypted = encryptDashPayContactKey(shared, key)
    expect(encrypted).toHaveLength(96)
    expect(decryptDashPayContactKey(shared, encrypted).deriveChild(7).publicKey).toEqual(key.deriveChild(7).publicKey)
    expect(deriveDashPayContactKey(account, theirs, ours).publicKey).not.toEqual(key.publicKey)
  })

  // Spending what a contact paid us signs with the key the stored path walks
  // to, so the watch-only address and the signing key must meet.
  it('derives each chain address from public keys at the key its path signs with', () => {
    const root = HDKey.fromMasterSeed(seed)
    const OURS = '7cBLvT9A6nkU5jPoLak8o97rU4WrARr3xHv7ttFh9n64'
    const THEIRS = '3vNcXuGDZkFbE2WLNLcSWCFPTF7vyB6CRo1pUtBxpcjE'
    const publicAccount = HDKey.fromExtendedKey(root.derive(dashPayAccountPath('testnet')).publicExtendedKey)
    const key = deriveDashPayContactKey(publicAccount, base58.decode(OURS), base58.decode(THEIRS))
    const deriver = dashPayAddressDeriver(key, 'testnet', OURS, THEIRS)
    for (const index of [0, 7]) {
      const {address, derivationPath} = deriver.derive(index)
      expect(new KeyPairController().p2pkhAddress(derivePath256(root, derivationPath).publicKey!, 'testnet')).toBe(address)
    }
  })

  it('references account 0 in 28 bits, the same way every time', () => {
    const key = deriveDashPayContactKey(account, ours, theirs)
    expect(accountReference(key)).toBe(accountReference(deriveDashPayContactKey(account, ours, theirs)))
    expect(accountReference(key)).toBeLessThan(2 ** 28)
  })
})
