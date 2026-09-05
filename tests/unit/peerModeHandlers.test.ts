import {describe, it, expect, beforeEach} from 'vitest'
import {SetPeerModeHandler} from '../../src/main/src/api/setPeerMode'
import {PushStaticPeerHandler} from '../../src/main/src/api/pushStaticPeer'
import {RemoveStaticPeerHandler} from '../../src/main/src/api/removeStaticPeer'
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
import type {PeerProbeResult} from '../../src/main/p2p/types/pool'
import type {Network} from '../../src/main/src/types/Network'

const EVENT = {} as IpcMainInvokeEvent

describe('peer settings handlers', () => {
  let preferences: Preferences
  let reloaded: number
  let pushPeer: PushStaticPeerHandler
  let removePeer: RemoveStaticPeerHandler
  let getPeers: GetStaticPeersHandler
  let setBanned: SetBannedPeersHandler
  let getBanned: GetBannedPeersHandler
  let setMode: SetPeerModeHandler
  let setSeeds: SetDnsSeedsHandler
  let getSeeds: GetDnsSeedsHandler
  let setDynamic: SetDynamicPeersHandler
  let getDynamic: GetDynamicPeersHandler
  let bansPushed: number
  // What the handler asked the p2p process to dial, and which of those entries
  // the stubbed probe reports as dead.
  let probed: string[]
  let unreachable: Set<string>

  beforeEach(() => {
    preferences = Preferences.fromObject({version: 9})
    reloaded = 0
    bansPushed = 0
    probed = []
    unreachable = new Set()
    const app = {preferences} as ApplicationService
    const sync = {
      reloadPeerPreferences: async (): Promise<void> => { reloaded++ },
      reloadBannedPeers: async (): Promise<void> => { bansPushed++ },
      probePeer: async (_network: Network, peer: string): Promise<PeerProbeResult> => {
        probed.push(peer)
        return unreachable.has(peer)
          ? {ok: false, error: 'closed before the handshake'}
          : {ok: true, error: null}
      },
    } as WalletSyncService
    pushPeer = new PushStaticPeerHandler(app, sync)
    removePeer = new RemoveStaticPeerHandler(app, sync)
    getPeers = new GetStaticPeersHandler(app)
    setBanned = new SetBannedPeersHandler(app, sync)
    getBanned = new GetBannedPeersHandler(app)
    setMode = new SetPeerModeHandler(app, sync)
    setSeeds = new SetDnsSeedsHandler(app, sync)
    getSeeds = new GetDnsSeedsHandler(app)
    setDynamic = new SetDynamicPeersHandler(app, sync)
    getDynamic = new GetDynamicPeersHandler(app)
  })

  it('pins the peer it is given, once it has answered a handshake', async () => {
    expect(await pushPeer.handle(EVENT, 'testnet', '5.6.7.8:19999')).toEqual(['5.6.7.8:19999'])

    expect(probed).toEqual(['5.6.7.8:19999'])
    expect(reloaded).toBe(1)
  })

  // A ban is matched at port 0, so an entry stored without a port never matches
  // the peer it names — and the default is per network.
  it('stores the entry with the network default port spelled out', async () => {
    expect(await pushPeer.handle(EVENT, 'testnet', '1.2.3.4')).toEqual(['1.2.3.4:19999'])
    expect(await pushPeer.handle(EVENT, 'mainnet', '1.2.3.4')).toEqual(['1.2.3.4:9999'])
    expect(await pushPeer.handle(EVENT, 'testnet', '[2001:db8::1]')).toEqual(['1.2.3.4:19999', '[2001:db8::1]:19999'])
    expect(probed).toEqual(['1.2.3.4:19999', '1.2.3.4:9999', '[2001:db8::1]:19999'])
  })

  it('adds to the list it already pinned, and answers with all of it', async () => {
    await pushPeer.handle(EVENT, 'testnet', '1.2.3.4:19999')

    expect(await pushPeer.handle(EVENT, 'testnet', '5.6.7.8:19999'))
      .toEqual(['1.2.3.4:19999', '5.6.7.8:19999'])
    expect(reloaded).toBe(2)
  })

  // One node dialled twice from one host drops both connections, and the
  // default port is what makes those two entries the same node. A rewrite would
  // also rebuild the session, which in static mode costs the sync its progress.
  it('leaves a peer it already pinned alone, however it was spelled', async () => {
    await pushPeer.handle(EVENT, 'testnet', '1.2.3.4:19999')
    probed = []

    expect(await pushPeer.handle(EVENT, 'testnet', '1.2.3.4')).toEqual(['1.2.3.4:19999'])
    expect(probed).toEqual([])
    expect(reloaded).toBe(1)
  })

  // Static mode dials this list and nothing else, so an entry that answers
  // nothing is not a peer the wallet can replace.
  it('refuses a peer that never completes the handshake', async () => {
    unreachable.add('5.6.7.8:19999')

    await expect(pushPeer.handle(EVENT, 'testnet', '5.6.7.8:19999'))
      .rejects.toThrow(/Unreachable peer 5\.6\.7\.8:19999: closed before the handshake/)
    expect(preferences.network.testnet.staticPeers).toEqual([])
    expect(reloaded).toBe(0)
  })

  it('unpins a peer without dialling it, however it was spelled', async () => {
    await pushPeer.handle(EVENT, 'testnet', '1.2.3.4:19999')
    await pushPeer.handle(EVENT, 'testnet', '5.6.7.8:19999')
    probed = []

    expect(await removePeer.handle(EVENT, 'testnet', '1.2.3.4')).toEqual(['5.6.7.8:19999'])
    expect(await getPeers.handle(EVENT, 'testnet')).toEqual(['5.6.7.8:19999'])
    expect(probed).toEqual([])
    expect(reloaded).toBe(3)
  })

  it('leaves the session alone when the peer was not pinned', async () => {
    await pushPeer.handle(EVENT, 'testnet', '1.2.3.4:19999')

    expect(await removePeer.handle(EVENT, 'testnet', '5.6.7.8:19999')).toEqual(['1.2.3.4:19999'])
    expect(reloaded).toBe(1)
  })

  // The state setBannedPeers refuses to ban a network into: static mode has no
  // DNS and no gossip to fall back on.
  it('refuses to unpin the last peer of a network in static mode', async () => {
    await pushPeer.handle(EVENT, 'testnet', '1.2.3.4:19999')
    await setMode.handle(EVENT, 'static')

    await expect(removePeer.handle(EVENT, 'testnet', '1.2.3.4:19999')).rejects.toThrow(/nothing to dial/)
    expect(await getPeers.handle(EVENT, 'testnet')).toEqual(['1.2.3.4:19999'])
  })

  it('unpins the last peer of a network in dynamic mode', async () => {
    await pushPeer.handle(EVENT, 'testnet', '1.2.3.4:19999')

    expect(await removePeer.handle(EVENT, 'testnet', '1.2.3.4:19999')).toEqual([])
    expect(reloaded).toBe(2)
  })

  it('refuses an unknown network and a peer that is not a string on remove', async () => {
    await expect(removePeer.handle(EVENT, 'regtest', '1.2.3.4')).rejects.toThrow(/removeStaticPeer/)
    await expect(removePeer.handle(EVENT, 'testnet', ['1.2.3.4'])).rejects.toThrow(/removeStaticPeer/)
    await expect(removePeer.handle(EVENT, 'testnet', undefined)).rejects.toThrow(/removeStaticPeer/)
  })

  it('reads back the peers pinned for one network', async () => {
    await pushPeer.handle(EVENT, 'testnet', '1.2.3.4')
    await pushPeer.handle(EVENT, 'testnet', '5.6.7.8:19999')

    expect(await getPeers.handle(EVENT, 'testnet')).toEqual(['1.2.3.4:19999', '5.6.7.8:19999'])
    expect(await getPeers.handle(EVENT, 'mainnet')).toEqual([])
  })

  // The list is per network and the mode is not, so it survives a switch back.
  it('keeps reading the list in dynamic mode', async () => {
    await pushPeer.handle(EVENT, 'testnet', '1.2.3.4')
    await setMode.handle(EVENT, 'static')
    await setMode.handle(EVENT, 'dynamic')

    expect(await getPeers.handle(EVENT, 'testnet')).toEqual(['1.2.3.4:19999'])
  })

  it('refuses an unknown network on read', async () => {
    await expect(getPeers.handle(EVENT, 'regtest')).rejects.toThrow(/getStaticPeers/)
    await expect(getPeers.handle(EVENT, undefined)).rejects.toThrow(/getStaticPeers/)
  })

  // Nothing between a renderer call and the handler checks the shape, so a bad
  // one reached the peer list as a TypeError.
  it('refuses a peer that is not a string', async () => {
    await expect(pushPeer.handle(EVENT, 'testnet', ['1.2.3.4'])).rejects.toThrow(/pushStaticPeer/)
    await expect(pushPeer.handle(EVENT, 'testnet', 4)).rejects.toThrow(/pushStaticPeer/)
    await expect(pushPeer.handle(EVENT, 'mainnet', undefined)).rejects.toThrow(/pushStaticPeer/)
    expect(probed).toEqual([])
    expect(reloaded).toBe(0)
  })

  it('refuses an unknown network', async () => {
    await expect(pushPeer.handle(EVENT, 'regtest', '1.2.3.4')).rejects.toThrow(/pushStaticPeer/)
  })

  it('refuses a peer address the pool could not dial', async () => {
    await expect(pushPeer.handle(EVENT, 'testnet', '1.2.3.4:99999')).rejects.toThrow(/Invalid peer address/)
    expect(preferences.network.testnet.staticPeers).toEqual([])
    expect(probed).toEqual([])
  })

  it('switches the mode for every network at once', async () => {
    await pushPeer.handle(EVENT, 'testnet', '1.2.3.4')
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
    await pushPeer.handle(EVENT, 'testnet', '1.2.3.4:19999')
    await setMode.handle(EVENT, 'static')

    await expect(setBanned.handle(EVENT, 'testnet', ['1.2.3.4:19999'])).rejects.toThrow(/nothing to dial/)
    expect(await getBanned.handle(EVENT, 'testnet')).toEqual([])
    expect(bansPushed).toBe(0)
  })

  // Two lists, because the modes dial them differently: one is everything
  // static mode has, the other is added to what discovery already found.
  it('keeps the pinned and the dynamic list apart', async () => {
    await pushPeer.handle(EVENT, 'testnet', '1.2.3.4:19999')
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
    await pushPeer.handle(EVENT, 'testnet', '1.2.3.4')
    await setMode.handle(EVENT, 'static')
    const restarts = reloaded

    await setBanned.handle(EVENT, 'testnet', ['68.67.122.38:19999'])

    expect(await getBanned.handle(EVENT, 'testnet')).toEqual(['68.67.122.38:19999'])
    expect(reloaded).toBe(restarts)
  })
})
