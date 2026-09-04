import {describe, it, expect, beforeEach} from 'vitest'
import {SetPeerModeHandler} from '../../src/main/src/api/setPeerMode'
import {SetStaticPeersHandler} from '../../src/main/src/api/setStaticPeers'
import {GetStaticPeersHandler} from '../../src/main/src/api/getStaticPeers'
import {SetBannedPeersHandler} from '../../src/main/src/api/setBannedPeers'
import {GetBannedPeersHandler} from '../../src/main/src/api/getBannedPeers'
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
  })

  it('pins the peers it is given', async () => {
    await setPeers.handle(EVENT, 'testnet', ['1.2.3.4', '5.6.7.8:19999'])

    expect(preferences.network.testnet.peers).toEqual(['1.2.3.4', '5.6.7.8:19999'])
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
    expect(preferences.network.testnet.peers).toEqual([])
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
