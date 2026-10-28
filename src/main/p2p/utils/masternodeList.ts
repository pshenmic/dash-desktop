import {FinalCommitment, MnListDiff, MnType} from 'dash-core-p2p'
import {wireToDisplayHex} from './byteOrder'

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

// The platform worker builds the same key from a proof; the type is part of it
// because two types can share a hash.
export function quorumKey({llmqType, quorumHash}: {llmqType: number; quorumHash: string}): string {
  return `${llmqType}:${quorumHash}`
}

// The quorum set after applying `diff` to `previous`, or null unless `header`
// proves the diff's coinbase and that coinbase's merkleRootQuorums covers the set.
export function committedQuorums(diff: MnListDiff, header: Uint8Array, previous: FinalCommitment[]): FinalCommitment[] | null {
  const deleted = new Set(diff.deletedQuorums.map(quorumKey))
  const quorums = [...previous.filter(quorum => !deleted.has(quorumKey(quorum))), ...diff.newQuorums]
  return MnListDiff.calcMerkleRootQuorums(quorums) === diff.merkleRootQuorums &&
    diff.calcBlockMerkleRoot() === wireToDisplayHex(header.subarray(36, 68)) ? quorums : null
}
