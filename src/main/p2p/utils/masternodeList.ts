import {MnListDiff, MnType} from 'dash-core-p2p'

// The DAPI urls of a full list's valid evonodes, or null when the entries do not
// hash to the merkleRootMNList its coinbase commits to.
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
