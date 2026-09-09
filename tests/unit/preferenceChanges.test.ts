import {describe, it, expect} from 'vitest'
import {describePreferenceChanges} from '../../src/main/src/utils/preferenceChanges'

describe('describePreferenceChanges', () => {
  it('reports nothing when the two sides match', () => {
    const value = {general: {connectionType: 'rpc'}, network: {mode: 'dynamic'}}
    expect(describePreferenceChanges(value, structuredClone(value))).toEqual([])
  })

  it('names a nested scalar change with both values', () => {
    expect(describePreferenceChanges({network: {mode: 'dynamic'}}, {network: {mode: 'static'}}))
      .toEqual(['network.mode: dynamic -> static'])
  })

  it('renders list changes in full', () => {
    expect(describePreferenceChanges(
      {network: {testnet: {staticPeers: []}}},
      {network: {testnet: {staticPeers: ['1.2.3.4:19999']}}},
    )).toEqual(['network.testnet.staticPeers: [] -> [1.2.3.4:19999]'])
  })

  it('reports every change, not just the first', () => {
    expect(describePreferenceChanges(
      {general: {logLevel: 'info', currency: 'USD'}},
      {general: {logLevel: 'debug', currency: 'EUR'}},
    )).toEqual(['general.logLevel: info -> debug', 'general.currency: USD -> EUR'])
  })

  it('treats a key added or removed as a change against none', () => {
    expect(describePreferenceChanges({general: {}}, {general: {logLevel: 'debug'}}))
      .toEqual(['general.logLevel: none -> debug'])
    expect(describePreferenceChanges({general: {logLevel: 'debug'}}, {general: {}}))
      .toEqual(['general.logLevel: debug -> none'])
  })

  it('ignores the methods on a live preferences instance', () => {
    class NetworkPreferences {
      mode = 'dynamic'
      settingsFor(): string { return this.mode }
    }
    expect(describePreferenceChanges({network: new NetworkPreferences()}, {network: {mode: 'dynamic'}}))
      .toEqual([])
  })
})
