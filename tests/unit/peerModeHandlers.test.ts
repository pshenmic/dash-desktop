import {describe, it, expect, beforeEach} from 'vitest'
import {SetPeerModeHandler} from '../../src/main/src/api/setPeerMode'
import {SetStaticPeersHandler} from '../../src/main/src/api/setStaticPeers'
import {GetStaticPeersHandler} from '../../src/main/src/api/getStaticPeers'
import {SetBannedPeersHandler} from '../../src/main/src/api/setBannedPeers'
import {GetBannedPeersHandler} from '../../src/main/src/api/getBannedPeers'
import {SetDnsSeedsHandler} from '../../src/main/src/api/setDnsSeeds'
import {GetDnsSeedsHandler} from '../../src/main/src/api/getDnsSeeds'
import {SetDynamicPeersHandler} from '../../src/main/src/api/setDynamicPeers'
import {GetDynamicPeersHandler} from '../../src/main/src/api/getDynamicPeers'
import {Preferences} from '../../src/main/src/preferences'
import type {IpcMainInvokeEvent} from 'electron/utility'
import type {ApplicationService} from '../../src/main/src/services/app/ApplicationService'
import type {WalletSyncService} from '../../src/main/src/services/core/WalletSyncService'

const EVENT = {} as IpcMainInvokeEvent

describe('peer settings handlers', () => {
  let preferences: Preferences
  let reloaded: number
  let setPeers: SetStaticPeersHandler
  let getPeers: GetStaticPeersHandler
  let setBanned: SetBannedPeersHandler
  let getBanned: GetBannedPeersHandler
  let setMode: SetPeerModeHandler
  let setSeeds: SetDnsSeedsHandler
  let getSeeds: GetDnsSeedsHandler
  let setDynamic: SetDynamicPeersHandler
  let getDynamic: GetDynamicPeersHandler
  let bansPushed: number

  beforeEach(() => {
    preferences = Preferences.fromObject({version: 9})
    reloaded = 0
    bansPushed = 0
    const app = {preferences} as ApplicationService
    const sync = {
      reloadPeerPreferences: async (): Promise<void> => { reloaded++ },
      reloadBannedPeers: async (): Promise<void> => { bansPushed++ },
    } as WalletSyncService
    setPeers = new SetStaticPeersHandler(app, sync)
    getPeers = new GetStaticPeersHandler(app)
    setBanned = new SetBannedPeersHandler(app, sync)
    getBanned = new GetBannedPeersHandler(app)
    setMode = new SetPeerModeHandler(app, sync)
    setSeeds = new SetDnsSeedsHandler(app, sync)
    getSeeds = new GetDnsSeedsHandler(app)
    setDynamic = new SetDynamicPeersHandler(app, sync)
    getDynamic = new GetDynamicPeersHandler(app)
  })

  it('pins the peers it is given', async () => {
    await setPeers.handle(EVENT, 'testnet', ['1.2.3.4', '5.6.7.8:19999'])

    expect(preferences.network.testnet.staticPeers).toEqual(['1.2.3.4', '5.6.7.8:19999'])
    expect(reloaded).toBe(1)
  })

  it('reads back the peers pinned for one network', async () => {
    await setPeers.handle(EVENT, 'testnet', ['1.2.3.4', '5.6.7.8:19999'])

    expect(await getPeers.handle(EVENT, 'testnet')).toEqual(['1.2.3.4', '5.6.7.8:19999'])
    expect(await getPeers.handle(EVENT, 'mainnet')).toEqual([])
  })

  // The list is per network and the mode is not, so it survives a switch back.
  it('keeps reading the list in dynamic mode', async () => {
    await setPeers.handle(EVENT, 'testnet', ['1.2.3.4'])
    await setMode.handle(EVENT, 'static')
    await setMode.handle(EVENT, 'dynamic')

    expect(await getPeers.handle(EVENT, 'testnet')).toEqual(['1.2.3.4'])
  })

  it('refuses an unknown network on read', async () => {
    await expect(getPeers.handle(EVENT, 'regtest')).rejects.toThrow(/getStaticPeers/)
    await expect(getPeers.handle(EVENT, undefined)).rejects.toThrow(/getStaticPeers/)
  })

  // Nothing between a renderer call and the handler checks the shape, so a bad
  // one reached the peer list as a TypeError.
  it('refuses a peer list that is not a list', async () => {
    await expect(setPeers.handle(EVENT, 'testnet', '1.2.3.4')).rejects.toThrow(/setStaticPeers/)
    await expect(setPeers.handle(EVENT, 'testnet', [4])).rejects.toThrow(/setStaticPeers/)
    await expect(setPeers.handle(EVENT, 'mainnet', undefined)).rejects.toThrow(/setStaticPeers/)
    expect(reloaded).toBe(0)
  })

  it('refuses an unknown network', async () => {
    await expect(setPeers.handle(EVENT, 'regtest', ['1.2.3.4'])).rejects.toThrow(/setStaticPeers/)
  })

  it('refuses a peer address the pool could not dial', async () => {
    await expect(setPeers.handle(EVENT, 'testnet', ['1.2.3.4:99999'])).rejects.toThrow(/Invalid peer address/)
    expect(preferences.network.testnet.staticPeers).toEqual([])
  })

  it('switches the mode for every network at once', async () => {
    await setPeers.handle(EVENT, 'testnet', ['1.2.3.4'])
    await setMode.handle(EVENT, 'static')

    expect(preferences.network.mode).toBe('static')
    expect(preferences.network.settingsFor('mainnet').mode).toBe('static')
    expect(preferences.network.settingsFor('testnet').mode).toBe('static')
  })

  it('refuses static mode while no network has a peer', async () => {
    await expect(setMode.handle(EVENT, 'static')).rejects.toThrow('static peer mode requires at least one peer')
    expect(preferences.network.mode).toBe('dynamic')
  })

  it('refuses a mode it does not have', async () => {
    await expect(setMode.handle(EVENT, 'pinned')).rejects.toThrow(/setPeerMode/)
  })

  it('bans the peers it is given, per network', async () => {
    await setBanned.handle(EVENT, 'testnet', ['68.67.122.38:19999', '89.169.164.19:19999'])

    expect(await getBanned.handle(EVENT, 'testnet')).toEqual(['68.67.122.38:19999', '89.169.164.19:19999'])
    expect(await getBanned.handle(EVENT, 'mainnet')).toEqual([])
    expect(bansPushed).toBe(1)
  })

  it('lifts a ban by writing the list without it', async () => {
    await setBanned.handle(EVENT, 'testnet', ['68.67.122.38:19999', '89.169.164.19:19999'])
    await setBanned.handle(EVENT, 'testnet', ['89.169.164.19:19999'])

    expect(await getBanned.handle(EVENT, 'testnet')).toEqual(['89.169.164.19:19999'])
    expect(bansPushed).toBe(2)
  })

  it('clears every ban with an empty list', async () => {
    await setBanned.handle(EVENT, 'testnet', ['68.67.122.38:19999'])
    await setBanned.handle(EVENT, 'testnet', [])

    expect(await getBanned.handle(EVENT, 'testnet')).toEqual([])
  })

  // A ban is matched against a peer the pool dialled, so an entry no pool could
  // ever produce would sit in the list forever doing nothing.
  it('refuses an address the pool could not dial', async () => {
    await expect(setBanned.handle(EVENT, 'testnet', ['1.2.3.4:99999'])).rejects.toThrow(/ip:port/)
    expect(await getBanned.handle(EVENT, 'testnet')).toEqual([])
  })

  // The port is what makes a ban match one socket, and an entry without one is
  // the mistake nothing downstream can report back.
  it('refuses an entry with no port', async () => {
    await expect(setBanned.handle(EVENT, 'testnet', ['1.2.3.4'])).rejects.toThrow(/ip:port/)
    await expect(setBanned.handle(EVENT, 'testnet', ['2001:db8::1'])).rejects.toThrow(/ip:port/)
    expect(bansPushed).toBe(0)
  })

  it('refuses an unknown network', async () => {
    await expect(setBanned.handle(EVENT, 'regtest', ['1.2.3.4:19999'])).rejects.toThrow(/setBannedPeers/)
    await expect(getBanned.handle(EVENT, 'regtest')).rejects.toThrow(/getBannedPeers/)
    expect(bansPushed).toBe(0)
  })

  // Static mode dials the pinned list and nothing else, so a ban covering all of
  // it leaves that network with no peers rather than fewer.
  it('refuses a ban that would leave a pinned network with nothing to dial', async () => {
    await setPeers.handle(EVENT, 'testnet', ['1.2.3.4:19999'])
    await setMode.handle(EVENT, 'static')

    await expect(setBanned.handle(EVENT, 'testnet', ['1.2.3.4:19999'])).rejects.toThrow(/nothing to dial/)
    expect(await getBanned.handle(EVENT, 'testnet')).toEqual([])
    expect(bansPushed).toBe(0)
  })

  // Two lists, because the modes dial them differently: one is everything
  // static mode has, the other is added to what discovery already found.
  it('keeps the pinned and the dynamic list apart', async () => {
    await setPeers.handle(EVENT, 'testnet', ['1.2.3.4:19999'])
    await setDynamic.handle(EVENT, 'testnet', ['5.6.7.8:19999'])

    expect(await getPeers.handle(EVENT, 'testnet')).toEqual(['1.2.3.4:19999'])
    expect(await getDynamic.handle(EVENT, 'testnet')).toEqual(['5.6.7.8:19999'])
    expect(await getDynamic.handle(EVENT, 'mainnet')).toEqual([])
    expect(reloaded).toBe(2)
  })

  it('refuses a dynamic peer address the pool could not dial', async () => {
    await expect(setDynamic.handle(EVENT, 'testnet', ['1.2.3.4:99999'])).rejects.toThrow(/Invalid peer address/)
    await expect(setDynamic.handle(EVENT, 'regtest', ['1.2.3.4'])).rejects.toThrow(/setDynamicPeers/)
    await expect(getDynamic.handle(EVENT, 'regtest')).rejects.toThrow(/getDynamicPeers/)
    expect(await getDynamic.handle(EVENT, 'testnet')).toEqual([])
    expect(reloaded).toBe(0)
  })

  // Static mode dials the pinned list and nothing else, so a dynamic peer is
  // not something it could fall back on.
  it('refuses static mode while the only peers are dynamic ones', async () => {
    await setDynamic.handle(EVENT, 'testnet', ['5.6.7.8:19999'])

    await expect(setMode.handle(EVENT, 'static')).rejects.toThrow('static peer mode requires at least one peer')
    expect(preferences.network.mode).toBe('dynamic')
  })

  it('replaces the seeds discovery runs on, per network', async () => {
    await setSeeds.handle(EVENT, 'testnet', ['seed-1.pshenmic.dev', 'testnet-seed.dashdot.io'])

    expect(await getSeeds.handle(EVENT, 'testnet')).toEqual(['seed-1.pshenmic.dev', 'testnet-seed.dashdot.io'])
    expect(await getSeeds.handle(EVENT, 'mainnet')).toEqual([])
    expect(reloaded).toBe(1)
  })

  // The pool resolves its seeds on connect, so a new list only reaches it by
  // rebuilding the session — where a ban is pushed into the pool that is up.
  it('restarts the session for a seed, and never pushes it as a ban', async () => {
    await setSeeds.handle(EVENT, 'testnet', ['seed.example.com'])
    await setSeeds.handle(EVENT, 'testnet', [])

    expect(await getSeeds.handle(EVENT, 'testnet')).toEqual([])
    expect(reloaded).toBe(2)
    expect(bansPushed).toBe(0)
  })

  // A non-empty list replaces the built-in seeds rather than adding to them, so
  // an entry that cannot resolve is discovery switched off.
  it('refuses a seed that is not a hostname', async () => {
    await expect(setSeeds.handle(EVENT, 'testnet', ['1.2.3.4'])).rejects.toThrow(/hostnames/)
    await expect(setSeeds.handle(EVENT, 'testnet', ['seed.example.com:19999'])).rejects.toThrow(/hostnames/)
    expect(await getSeeds.handle(EVENT, 'testnet')).toEqual([])
    expect(reloaded).toBe(0)
  })

  it('refuses an unknown network', async () => {
    await expect(setSeeds.handle(EVENT, 'regtest', ['seed.example.com'])).rejects.toThrow(/setDnsSeeds/)
    await expect(getSeeds.handle(EVENT, 'regtest')).rejects.toThrow(/getDnsSeeds/)
    await expect(setSeeds.handle(EVENT, 'testnet', 'seed.example.com')).rejects.toThrow(/setDnsSeeds/)
    expect(reloaded).toBe(0)
  })

  // Bans apply in both modes: the pool honours them, the mode only decides what
  // it dials in the first place.
  it('keeps a ban across a mode switch, and never restarts the session for one', async () => {
    await setPeers.handle(EVENT, 'testnet', ['1.2.3.4'])
    await setMode.handle(EVENT, 'static')
    const restarts = reloaded

    await setBanned.handle(EVENT, 'testnet', ['68.67.122.38:19999'])

    expect(await getBanned.handle(EVENT, 'testnet')).toEqual(['68.67.122.38:19999'])
    expect(reloaded).toBe(restarts)
  })
})
