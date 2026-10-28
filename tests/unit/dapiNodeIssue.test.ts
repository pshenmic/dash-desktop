import {describe, it, expect} from 'vitest'
import type {NodeStatus} from 'dash-platform-sdk/types.js'
import {dapiNodeIssue} from '../../src/main/src/utils/dapiNodeIssue'

const NOW_S = 1_800_000_000

const status = (overrides: {catchingUp?: boolean; blockAgeS?: number} = {}): NodeStatus => ({
  version: undefined,
  node: undefined,
  chain: {catchingUp: overrides.catchingUp ?? false} as NodeStatus['chain'],
  network: undefined,
  stateSync: undefined,
  time: {local: String(NOW_S), block: String((NOW_S - (overrides.blockAgeS ?? 60)) * 1000)},
})

describe('a DAPI node', () => {
  it('serves when synced with a recent block', () => {
    expect(dapiNodeIssue(status())).toBeNull()
  })

  it('is refused while still syncing', () => {
    expect(dapiNodeIssue(status({catchingUp: true}))).toBe('still syncing')
  })

  it('is refused when its last block is stale', () => {
    expect(dapiNodeIssue(status({blockAgeS: 11 * 60}))).toMatch(/stalled/)
  })
})
