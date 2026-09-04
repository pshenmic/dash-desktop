import {describe, it, expect, vi} from 'vitest'
import {Preferences} from '../../src/main/src/preferences'

describe('Preferences network section', () => {
  it('defaults to built-in dynamic discovery for a file written before the section existed', () => {
    const prefs = Preferences.fromObject({version: 5, general: {language: 'en', currency: 'usd', connectionType: 'rpc'}})

    expect(prefs.version).toBe(Preferences.CURRENT_VERSION)
    expect(prefs.network.toJSON()).toEqual({
      mode: 'dynamic',
      mainnet: {dnsSeeds: [], peers: [], banned: []},
      testnet: {dnsSeeds: [], peers: [], banned: []},
    })
  })

  it('keeps hand-edited seeds, peers and bans', () => {
    const network = {
      mode: 'dynamic',
      mainnet: {dnsSeeds: ['seed.example.com'], peers: ['1.2.3.4:9999'], banned: ['9.9.9.9:9999']},
      testnet: {dnsSeeds: [], peers: ['node.test:19999'], banned: []},
    }

    expect(Preferences.fromObject({version: 9, network}).network.toJSON()).toEqual(network)
  })

  it('defaults the peer mode for a section written before it existed', () => {
    const network = {
      mainnet: {dnsSeeds: [], peers: ['1.2.3.4:9999']},
      testnet: {dnsSeeds: [], peers: []},
    }

    expect(Preferences.fromObject({version: 7, network}).network.mode).toBe('dynamic')
  })

  // One mode for the whole app: the peers are per network, the kind of
  // discovery is not.
  it('pins every network with a single mode', () => {
    const network = {
      mode: 'static',
      mainnet: {dnsSeeds: [], peers: ['1.2.3.4:9999'], banned: []},
      testnet: {dnsSeeds: [], peers: ['5.6.7.8:19999'], banned: []},
    }
    const prefs = Preferences.fromObject({version: 9, network})

    expect(prefs.network.toJSON()).toEqual(network)
    expect(prefs.network.settingsFor('mainnet')).toEqual({mode: 'static', dnsSeeds: [], peers: ['1.2.3.4:9999'], banned: []})
    expect(prefs.network.settingsFor('testnet')).toEqual({mode: 'static', dnsSeeds: [], peers: ['5.6.7.8:19999'], banned: []})
  })

  // Static mode with nothing to dial anywhere is a wallet with no peers at all,
  // so the section is refused rather than honoured.
  it('refuses static mode without a peer on any network', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const prefs = Preferences.fromObject({
      version: 9,
      network: {mode: 'static', mainnet: {dnsSeeds: [], peers: []}, testnet: {dnsSeeds: [], peers: []}},
    })

    expect(prefs.network.mode).toBe('dynamic')
    await expect(prefs.apply({
      ...prefs,
      network: {...prefs.network, mode: 'static'},
    })).rejects.toThrow('static peer mode requires at least one peer')
  })

  it('accepts static mode once one network has a peer', async () => {
    const prefs = Preferences.fromObject({
      version: 9,
      network: {mode: 'dynamic', mainnet: {dnsSeeds: [], peers: []}, testnet: {dnsSeeds: [], peers: ['5.6.7.8:19999']}},
    })

    await prefs.apply({...prefs, network: {...prefs.network, mode: 'static'}})

    expect(prefs.network.mode).toBe('static')
    expect(prefs.network.settingsFor('mainnet').mode).toBe('static')
  })

  it('falls back to defaults when the section is malformed', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const prefs = Preferences.fromObject({version: 6, network: {mainnet: {dnsSeeds: 'seed.example.com'}}})

    expect(prefs.network.toJSON()).toEqual({
      mode: 'dynamic',
      mainnet: {dnsSeeds: [], peers: [], banned: []},
      testnet: {dnsSeeds: [], peers: [], banned: []},
    })
  })

  it('survives the spread-and-apply the general setters use', async () => {
    const prefs = Preferences.fromObject({
      version: 9,
      network: {mainnet: {dnsSeeds: ['seed.example.com'], peers: []}, testnet: {dnsSeeds: [], peers: []}},
    })

    await prefs.apply({...prefs, general: {...prefs.general, connectionType: 'p2p'}})

    expect(prefs.general.connectionType).toBe('p2p')
    expect(prefs.network.mainnet.dnsSeeds).toEqual(['seed.example.com'])
  })
})
