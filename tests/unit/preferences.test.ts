import {describe, it, expect, vi} from 'vitest'
import {Preferences} from '../../src/main/src/preferences'

const EMPTY = {dnsSeeds: [], staticPeers: [], dynamicPeers: [], bannedPeers: []}

describe('Preferences network section', () => {
  it('defaults to built-in dynamic discovery for a file written before the section existed', () => {
    const prefs = Preferences.fromObject({version: 5, general: {language: 'en', currency: 'usd', connectionType: 'rpc'}})

    expect(prefs.version).toBe(Preferences.CURRENT_VERSION)
    expect(prefs.network.toJSON()).toEqual({mode: 'dynamic', mainnet: EMPTY, testnet: EMPTY})
  })

  it('keeps hand-edited seeds, peers and bans', () => {
    const network = {
      mode: 'dynamic',
      mainnet: {dnsSeeds: ['seed.example.com'], staticPeers: ['1.2.3.4:9999'], dynamicPeers: ['5.6.7.8:9999'], bannedPeers: ['9.9.9.9:9999']},
      testnet: {dnsSeeds: [], staticPeers: ['node.test:19999'], dynamicPeers: [], bannedPeers: []},
    }

    expect(Preferences.fromObject({version: 9, network}).network.toJSON()).toEqual(network)
  })

  // v7 wrote `peers` and `banned`. The schema defaults the names that replaced
  // them, so a file that missed the rename would come back silently emptied.
  it('carries a v7 peer list onto the fields that replaced it', () => {
    const network = {
      mode: 'static',
      mainnet: {dnsSeeds: ['seed.example.com'], peers: ['1.2.3.4:9999'], banned: ['9.9.9.9:9999']},
      testnet: {dnsSeeds: [], peers: [], banned: []},
    }

    expect(Preferences.fromObject({version: 7, network}).network.toJSON()).toEqual({
      mode: 'static',
      mainnet: {dnsSeeds: ['seed.example.com'], staticPeers: ['1.2.3.4:9999'], dynamicPeers: [], bannedPeers: ['9.9.9.9:9999']},
      testnet: EMPTY,
    })
  })

  it('defaults the peer mode for a section written before it existed', () => {
    const network = {
      mainnet: {dnsSeeds: [], staticPeers: ['1.2.3.4:9999']},
      testnet: {dnsSeeds: [], staticPeers: []},
    }

    expect(Preferences.fromObject({version: 7, network}).network.mode).toBe('dynamic')
  })

  // One mode for the whole app: the peers are per network, the kind of
  // discovery is not.
  it('pins every network with a single mode', () => {
    const network = {
      mode: 'static',
      mainnet: {...EMPTY, staticPeers: ['1.2.3.4:9999']},
      testnet: {...EMPTY, staticPeers: ['5.6.7.8:19999']},
    }
    const prefs = Preferences.fromObject({version: 9, network})

    expect(prefs.network.toJSON()).toEqual(network)
    expect(prefs.network.settingsFor('mainnet')).toEqual({mode: 'static', ...EMPTY, staticPeers: ['1.2.3.4:9999']})
    expect(prefs.network.settingsFor('testnet')).toEqual({mode: 'static', ...EMPTY, staticPeers: ['5.6.7.8:19999']})
  })

  // Static mode with nothing to dial anywhere is a wallet with no peers at all,
  // so the section is refused rather than honoured.
  it('refuses static mode without a peer on any network', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const prefs = Preferences.fromObject({
      version: 9,
      network: {mode: 'static', mainnet: EMPTY, testnet: EMPTY},
    })

    expect(prefs.network.mode).toBe('dynamic')
    await expect(prefs.apply({
      ...prefs,
      network: {...prefs.network, mode: 'static'},
    })).rejects.toThrow('static peer mode requires at least one peer')
  })

  // Only the pinned list counts: dynamic peers are dialled on top of discovery,
  // which static mode switches off.
  it('refuses static mode while the only peers are dynamic ones', async () => {
    const prefs = Preferences.fromObject({
      version: 9,
      network: {mode: 'dynamic', mainnet: EMPTY, testnet: {...EMPTY, dynamicPeers: ['5.6.7.8:19999']}},
    })

    await expect(prefs.apply({
      ...prefs,
      network: {...prefs.network, mode: 'static'},
    })).rejects.toThrow('static peer mode requires at least one peer')
  })

  it('accepts static mode once one network has a peer', async () => {
    const prefs = Preferences.fromObject({
      version: 9,
      network: {mode: 'dynamic', mainnet: EMPTY, testnet: {...EMPTY, staticPeers: ['5.6.7.8:19999']}},
    })

    await prefs.apply({...prefs, network: {...prefs.network, mode: 'static'}})

    expect(prefs.network.mode).toBe('static')
    expect(prefs.network.settingsFor('mainnet').mode).toBe('static')
  })

  it('falls back to defaults when the section is malformed', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const prefs = Preferences.fromObject({version: 6, network: {mainnet: {dnsSeeds: 'seed.example.com'}}})

    expect(prefs.network.toJSON()).toEqual({mode: 'dynamic', mainnet: EMPTY, testnet: EMPTY})
  })

  it('survives the spread-and-apply the general setters use', async () => {
    const prefs = Preferences.fromObject({
      version: 9,
      network: {mainnet: {...EMPTY, dnsSeeds: ['seed.example.com']}, testnet: EMPTY},
    })

    await prefs.apply({...prefs, general: {...prefs.general, connectionType: 'p2p'}})

    expect(prefs.general.connectionType).toBe('p2p')
    expect(prefs.network.mainnet.dnsSeeds).toEqual(['seed.example.com'])
  })
})
