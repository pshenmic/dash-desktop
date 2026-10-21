import {describe, it, expect} from 'vitest'
import {HDKey} from '@scure/bip32'
import {bytesToHex, hexToBytes} from '@noble/hashes/utils.js'
import {KeyPairController} from 'dash-platform-sdk/src/keyPair/index.js'
import {accountReference, dashPaySharedKey, decryptDashPayContactKey, deriveChild256, deriveDashPayContactKey, encryptDashPayContactKey, dashPayContactAddresses} from '../../src/main/src/utils/dashPayKeys'

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

  it('refuses a 256-bit index under a public parent', () => {
    const xpub = HDKey.fromExtendedKey(derive("m/9'").publicExtendedKey, {private: 0x04358394, public: 0x043587cf})
    expect(() => deriveChild256(xpub, 2n ** 32n, false)).toThrow('A 256-bit index needs a private parent key')
  })
})

describe('contact request keys', () => {
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
    const key = deriveDashPayContactKey(seed, 'testnet', ours, theirs)
    const shared = dashPaySharedKey(encryption, derive("m/2'").publicKey!)
    const encrypted = encryptDashPayContactKey(shared, key)
    expect(encrypted).toHaveLength(96)
    expect(decryptDashPayContactKey(shared, encrypted).deriveChild(7).publicKey).toEqual(key.deriveChild(7).publicKey)
    expect(deriveDashPayContactKey(seed, 'testnet', theirs, ours).publicKey).not.toEqual(key.publicKey)
  })

  it('derives the addresses we pay a contact on from the key they sent', () => {
    const key = deriveDashPayContactKey(seed, 'testnet', ours, theirs)
    const shared = dashPaySharedKey(encryption, derive("m/2'").publicKey!)
    const xpub = decryptDashPayContactKey(shared, encryptDashPayContactKey(shared, key)).publicExtendedKey
    const expected = [2, 3, 4].map(i => new KeyPairController().p2pkhAddress(key.deriveChild(i).publicKey!, 'testnet'))
    expect(dashPayContactAddresses(xpub, 'testnet', 2, 3)).toEqual(expected)
  })

  it('references account 0 in 28 bits, the same way every time', () => {
    const key = deriveDashPayContactKey(seed, 'testnet', ours, theirs)
    expect(accountReference(key)).toBe(accountReference(deriveDashPayContactKey(seed, 'testnet', ours, theirs)))
    expect(accountReference(key)).toBeLessThan(2 ** 28)
  })
})
