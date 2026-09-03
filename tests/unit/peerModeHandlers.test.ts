import {describe, it, expect, beforeEach} from 'vitest'
import {SetPeerModeHandler} from '../../src/main/src/api/setPeerMode'
import {SetStaticPeersHandler} from '../../src/main/src/api/setStaticPeers'
import {GetStaticPeersHandler} from '../../src/main/src/api/getStaticPeers'
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
  let setMode: SetPeerModeHandler

  beforeEach(() => {
    preferences = Preferences.fromObject({version: 9})
    reloaded = 0
    const app = {preferences} as ApplicationService
    const sync = {reloadPeerPreferences: async (): Promise<void> => { reloaded++ }} as WalletSyncService
    setPeers = new SetStaticPeersHandler(app, sync)
    getPeers = new GetStaticPeersHandler(app)
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
})
