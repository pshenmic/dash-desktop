import fs from 'fs'
import path from 'path'
import {gunzipSync} from 'zlib'
import {describe, it, expect} from 'vitest'
import {FinalCommitment, MnListDiff, MnType, SimplifiedMNListEntry} from 'dash-core-p2p'
import {committedQuorums, evonodeDapiUrls, quorumKey} from '../../src/main/p2p/utils/masternodeList'
import {displayHexToWire} from '../../src/main/p2p/utils/byteOrder'
import {doubleSHA256} from '../../src/main/p2p/utils/hash'

const entry = (n: number, nType: number, isValid: boolean, host: string, platformHTTPPort?: number): SimplifiedMNListEntry => ({
  nVersion: 2,
  proRegTxHash: n.toString(16).padStart(64, '0'),
  confirmedHash: '00'.repeat(32),
  service: new Uint8Array(18),
  address: {networkId: 1, addr: new Uint8Array(4), host, port: 9999},
  pubKeyOperator: '00'.repeat(48),
  keyIDVoting: '00'.repeat(20),
  isValid,
  nType,
  platformHTTPPort,
  platformNodeID: nType === MnType.Evo ? '00'.repeat(20) : undefined,
})

// A full list whose coinbase commits to `committed`, or to the list itself.
function diffOf(mnList: SimplifiedMNListEntry[], committed = MnListDiff.calcMerkleRootMNList(mnList)): MnListDiff {
  const diff = Object.assign(new MnListDiff(), {mnList})
  Object.defineProperty(diff, 'merkleRootMNList', {value: committed})
  return diff
}

describe('evonode DAPI urls', () => {
  it('hands on valid evonodes only', () => {
    const urls = evonodeDapiUrls(diffOf([
      entry(1, MnType.Evo, true, '68.67.122.23', 1443),
      entry(2, MnType.Evo, false, '68.67.122.24', 1443),
      entry(3, MnType.Regular, true, '68.67.122.25'),
    ]))
    expect(urls).toEqual(['https://68.67.122.23:1443'])
  })

  it('brackets an IPv6 host and drops a repeated url', () => {
    const urls = evonodeDapiUrls(diffOf([
      entry(1, MnType.Evo, true, '2001:db8::1', 443),
      entry(2, MnType.Evo, true, '2001:db8::1', 443),
    ]))
    expect(urls).toEqual(['https://[2001:db8::1]:443'])
  })

  it('refuses a list its coinbase does not commit to', () => {
    expect(evonodeDapiUrls(diffOf([entry(1, MnType.Evo, true, '68.67.122.23', 1443)], 'ff'.repeat(32)))).toBeNull()
  })
})

// Full list at mainnet block 2552448 (88 quorums), from dash-core-p2p's own fixtures.
const mainnet = MnListDiff.fromBytes(new Uint8Array(gunzipSync(
  fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'masternodeList', 'mnlistdiff-mainnet-2552448.bin.gz')))))

// The coinbase sits leftmost, so the block's merkle root folds its proof's
// siblings in from the right, bottom up.
function headerFor(diff: MnListDiff): Uint8Array {
  const [coinbase, ...siblings] = diff.merkleHashes.map(displayHexToWire)
  const root = siblings.reduce((node, sibling) => doubleSHA256(Buffer.concat([node, sibling])), coinbase!)
  const header = new Uint8Array(80)
  header.set(root, 36)
  return header
}

const withFields = (diff: MnListDiff, fields: Partial<Record<keyof MnListDiff, unknown>>): MnListDiff =>
  Object.create(diff, Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, {value}])))

describe('quorums committed to by the coinbase', () => {
  it('accepts a real full list against its block', () => {
    expect(committedQuorums(mainnet, headerFor(mainnet), [])).toHaveLength(88)
  })

  it('refuses a coinbase the header does not commit to', () => {
    const header = headerFor(mainnet)
    header[36]! ^= 1
    expect(committedQuorums(mainnet, header, [])).toBeNull()
  })

  it('refuses a commitment altered in transit', () => {
    const [first, ...rest] = mainnet.newQuorums
    const altered = {...first!, quorumPublicKey: 'ff'.repeat(48)} as FinalCommitment
    expect(committedQuorums(withFields(mainnet, {newQuorums: [altered, ...rest]}), headerFor(mainnet), [])).toBeNull()
  })

  it('refuses a proof carrying a hash the tree never reads', () => {
    const padded = withFields(mainnet, {merkleHashes: [...mainnet.merkleHashes, '00'.repeat(32)]})
    expect(committedQuorums(padded, headerFor(mainnet), [])).toBeNull()
  })

  it('applies a diff to the set it was based on', () => {
    const stale = {...mainnet.newQuorums[0]!, quorumHash: '11'.repeat(32)} as FinalCommitment
    const diff = withFields(mainnet, {newQuorums: [], deletedQuorums: [{llmqType: stale.llmqType, quorumHash: stale.quorumHash}]})

    const quorums = committedQuorums(diff, headerFor(mainnet), [...mainnet.newQuorums, stale])
    expect(quorums?.map(quorumKey)).toEqual(mainnet.newQuorums.map(quorumKey))
  })
})
