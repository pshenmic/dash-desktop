import {describe, it, expect} from 'vitest'
import {MnListDiff, MnType, SimplifiedMNListEntry} from 'dash-core-p2p'
import {evonodeDapiUrls} from '../../src/main/p2p/utils/masternodeList'

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
