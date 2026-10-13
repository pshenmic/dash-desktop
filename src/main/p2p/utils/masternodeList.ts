import {FinalCommitment, MnListDiff, MnType} from 'dash-core-p2p'
import {displayHexToWire, wireToDisplayHex} from './byteOrder'
import {doubleSHA256} from './hash'
import {merkleRoot} from './merkle'

// Null when the entries do not hash to the merkleRootMNList the coinbase commits to.
export function evonodeDapiUrls(diff: MnListDiff): string[] | null {
  if (diff.merkleRootMNList !== MnListDiff.calcMerkleRootMNList(diff.mnList)) return null
  const urls = diff.mnList
    .filter(entry => entry.nType === MnType.Evo && entry.isValid)
    .flatMap(({address, platformHTTPPort}) => {
      if (address?.host == null || platformHTTPPort == null) return []
      const host = address.host.includes(':') ? `[${address.host}]` : address.host
      return [`https://${host}:${platformHTTPPort}`]
    })
  return [...new Set(urls)]
}

// The quorum set after applying `diff` to `previous`, or null unless `header`
// proves the diff's coinbase and that coinbase's merkleRootQuorums covers the set.
export function committedQuorums(diff: MnListDiff, header: Uint8Array, previous: FinalCommitment[]): FinalCommitment[] | null {
  const deleted = new Set(diff.deletedQuorums.map(quorum => `${quorum.llmqType}:${quorum.quorumHash}`))
  const quorums = [...previous.filter(quorum => !deleted.has(`${quorum.llmqType}:${quorum.quorumHash}`)), ...diff.newQuorums]
  const root = merkleRoot(quorums.map(commitmentHash).sort(Buffer.compare))
  const committed = (diff.cbTx.extraPayload as {merkleRootQuorums?: string} | undefined)?.merkleRootQuorums
  return root != null && wireToDisplayHex(root) === committed && coinbaseInBlock(diff, header) ? quorums : null
}

// Core's CPartialMerkleTree check: every hash and flag byte spent, the coinbase
// the only match, and the header's merkle root rebuilt.
function coinbaseInBlock(diff: MnListDiff, header: Uint8Array): boolean {
  const hashes = diff.merkleHashes.map(displayHexToWire)
  const flags = diff.merkleFlags.flatMap(byte => [0, 1, 2, 3, 4, 5, 6, 7].map(i => (byte >> i) & 1))
  const width = (height: number): number => Math.ceil(diff.totalTransactions / 2 ** height)
  const matches: number[] = []
  let hashesUsed = 0
  let flagsUsed = 0
  let mutated = false
  const walk = (height: number, position: number): Uint8Array | undefined => {
    const flag = flags[flagsUsed++]
    if (flag == null) return undefined
    if (height === 0 || flag === 0) {
      if (height === 0 && flag === 1) matches.push(position)
      return hashes[hashesUsed++]
    }
    const left = walk(height - 1, position * 2)
    const right = position * 2 + 1 < width(height - 1) ? walk(height - 1, position * 2 + 1) : left
    if (left == null || right == null) return undefined
    // CVE-2012-2459: equal siblings let a second transaction list reach the same root.
    if (right !== left && Buffer.compare(left, right) === 0) mutated = true
    return doubleSHA256(Buffer.concat([left, right]))
  }
  const root = walk(Math.ceil(Math.log2(diff.totalTransactions)), 0)
  return root != null && !mutated && diff.cbTxBytes != null &&
    hashesUsed === hashes.length && Math.ceil(flagsUsed / 8) === diff.merkleFlags.length &&
    matches.length === 1 && matches[0] === 0 &&
    Buffer.compare(hashes[0]!, doubleSHA256(diff.cbTxBytes)) === 0 &&
    Buffer.compare(root, header.subarray(36, 68)) === 0
}

// sha256d of CFinalCommitment as Core serializes it (src/llmq/commitment.h).
function commitmentHash(quorum: FinalCommitment): Uint8Array {
  return doubleSHA256(Uint8Array.from([
    quorum.nVersion & 0xff, quorum.nVersion >> 8, quorum.llmqType,
    ...displayHexToWire(quorum.quorumHash),
    ...quorum.quorumIndex === undefined ? [] : [quorum.quorumIndex & 0xff, (quorum.quorumIndex >> 8) & 0xff],
    ...bitSet(quorum.signers), ...bitSet(quorum.validMembers),
    ...Buffer.from(quorum.quorumPublicKey, 'hex'), ...displayHexToWire(quorum.quorumVvecHash),
    ...Buffer.from(quorum.quorumSig, 'hex'), ...Buffer.from(quorum.membersSig, 'hex'),
  ]))
}

// DYNBITSET: compact-size bit count, then the bits LSB first.
function bitSet(bits: boolean[]): number[] {
  const bytes = new Array<number>(Math.ceil(bits.length / 8)).fill(0)
  bits.forEach((bit, i) => {
    if (bit) bytes[i >> 3]! |= 1 << (i & 7)
  })
  return [...bits.length < 0xfd ? [bits.length] : [0xfd, bits.length & 0xff, bits.length >> 8], ...bytes]
}
