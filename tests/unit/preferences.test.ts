import {describe, it, expect, vi} from 'vitest'
import {Preferences} from '../../src/main/src/preferences'

describe('Preferences network section', () => {
  it('defaults to built-in discovery for a file written before the section existed', () => {
    const prefs = Preferences.fromObject({version: 5, general: {language: 'en', currency: 'usd', connectionType: 'rpc'}})

    expect(prefs.version).toBe(Preferences.CURRENT_VERSION)
    expect(prefs.network.toJSON()).toEqual({
      mainnet: {dnsSeeds: [], peers: []},
      testnet: {dnsSeeds: [], peers: []},
    })
  })

  it('keeps hand-edited seeds and peers', () => {
    const network = {
      mainnet: {dnsSeeds: ['seed.example.com'], peers: ['1.2.3.4:9999']},
      testnet: {dnsSeeds: [], peers: ['node.test:19999']},
    }

    expect(Preferences.fromObject({version: 6, network}).network.toJSON()).toEqual(network)
  })

  it('falls back to defaults when the section is malformed', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const prefs = Preferences.fromObject({version: 6, network: {mainnet: {dnsSeeds: 'seed.example.com'}}})

    expect(prefs.network.toJSON()).toEqual({
      mainnet: {dnsSeeds: [], peers: []},
      testnet: {dnsSeeds: [], peers: []},
    })
  })

  it('survives the spread-and-apply the general setters use', async () => {
    const prefs = Preferences.fromObject({
      version: 6,
      network: {mainnet: {dnsSeeds: ['seed.example.com'], peers: []}, testnet: {dnsSeeds: [], peers: []}},
    })

    await prefs.apply({...prefs, general: {...prefs.general, connectionType: 'p2p'}})

    expect(prefs.general.connectionType).toBe('p2p')
    expect(prefs.network.mainnet.dnsSeeds).toEqual(['seed.example.com'])
  })
})