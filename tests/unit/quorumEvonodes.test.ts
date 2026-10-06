import {describe, it, expect} from 'vitest'
import {quorumEvonodes} from '../../src/main/src/utils/quorumEvonodes'

const set = (members: Array<{proTxHash: string; nodeIp: string; isBanned: boolean}>) =>
  ({quorumHash: '00', coreHeight: 1, thresholdPublicKey: '00', members})

describe('quorumEvonodes', () => {
  it('lists a member of several validator sets once', () => {
    const a = {proTxHash: 'aa', nodeIp: '1.1.1.1', isBanned: false}
    const b = {proTxHash: 'bb', nodeIp: '2.2.2.2', isBanned: false}

    expect(quorumEvonodes([set([a, b]), set([a])], 1443)).toEqual([
      {proTxHash: 'aa', dapiUrl: 'https://1.1.1.1:1443'},
      {proTxHash: 'bb', dapiUrl: 'https://2.2.2.2:1443'},
    ])
  })

  it('leaves out banned members', () => {
    expect(quorumEvonodes([set([{proTxHash: 'aa', nodeIp: '1.1.1.1', isBanned: true}])], 443)).toEqual([])
  })
})
