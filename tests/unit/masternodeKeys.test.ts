import {describe, expect, it} from 'vitest'
import {bytesToHex, hexToBytes} from '@noble/hashes/utils.js'
import {HDKey} from '@scure/bip32'
import {HD_VERSIONS} from '../../src/main/src/constants/addresses'
import {masternodeAccountPath, masternodeKeys, operatorPublicKey, platformNodeId} from '../../src/main/src/utils/masternodeKeys'

// BIP39 seed of "abandon … about"; expected bytes are the dashbls and SLIP-10
// reference vectors pinned in rust-dashcore key-wallet.
const SEED = hexToBytes('5eb00bbddcf069084889a8ab9155568165f5c453ccb85e70811aaed6f6da5fc19a5ac40b389cd370d086206dec8aa6c43daea6690f20ad3d8d48b2d2ce9e38e4')

describe('masternodeKeys', () => {
  const mainnet = masternodeKeys(SEED, 'mainnet')

  it('derives the operator account node at m/9\'/5\'/3\'/3\'', () => {
    expect(bytesToHex(mainnet.operatorPublicKey)).toBe('ad794d053504db3727c1f51aea2112e440fadbade687a9c0243b61523c8ab8eb64061f0a5ec5d8df4b7ec8bdfe722c19')
    expect(bytesToHex(mainnet.operatorChainCode)).toBe('d9659c1bde2fd0e0f799f2f66bbbcfc7378fdea624d73d5d4749dc7222daea5e')
  })

  it('derives operator keys from the stored account node', () => {
    const keys = [0, 1, 2].map(index => bytesToHex(operatorPublicKey(mainnet.operatorPublicKey, mainnet.operatorChainCode, index)))
    expect(keys).toEqual([
      '878cad04aae29eb76171937eb7101452b401b026efbc27db840f130374e6a9ec8443d917277f8921e0ba6678a7709875',
      '8c04974d14df3b5eb23787e21642d25c47609d966bb80f504854e4675657c63f4c4c7056f3f007671b911eb390dec4f7',
      '8d14cad34409c74f9dd587fc00be01ca0c527e3793f016eb2a612d78ec45c650e8942fbff3e1ab44a21a6e575ebe80a1',
    ])
  })

  it('derives the testnet operator key on coin type 1', () => {
    const testnet = masternodeKeys(SEED, 'testnet')
    expect(bytesToHex(operatorPublicKey(testnet.operatorPublicKey, testnet.operatorChainCode, 0)))
      .toBe('89d8beabae708de1638487f1aff44b38e8c07d9b09f22d76329d6c8ec01e2ad4d030b660bca40ddbd222373a72c5bcef')
  })

  it('derives platform node keys and their Tenderdash node id', () => {
    expect(mainnet.platformNodeKeys).toHaveLength(10)
    expect(bytesToHex(mainnet.platformNodeKeys[0])).toBe('3130c14339391cf26a68d86879e180ee9a16b660f5aa91f560f67c0abe8cf789')
    expect(bytesToHex(platformNodeId(mainnet.platformNodeKeys[0]))).toBe('302f2615e6955cce8ed3cff81e8011bfd3a2991f')
  })

  it('stores owner and voting xpubs that reproduce the seed-derived keys', () => {
    const root = HDKey.fromMasterSeed(SEED, HD_VERSIONS.mainnet)
    for (const [role, xpub] of [['owner', mainnet.ownerXpub], ['voting', mainnet.votingXpub]] as const) {
      const fromXpub = HDKey.fromExtendedKey(xpub, HD_VERSIONS.mainnet).deriveChild(7).publicKey
      const fromSeed = root.derive(`${masternodeAccountPath('mainnet', role)}/7`).publicKey
      expect(fromXpub).toEqual(fromSeed)
    }
    expect(masternodeAccountPath('mainnet', 'voting')).toBe("m/9'/5'/3'/1'")
    expect(masternodeAccountPath('testnet', 'owner')).toBe("m/9'/1'/3'/2'")
  })
})
