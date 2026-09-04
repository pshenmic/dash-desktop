import {IpcMainInvokeEvent} from 'electron/utility'
import {z} from 'zod'
import {bannedSet, dialTarget, parsePeerAddress} from '../../p2p/net/peerAddress'
import {NetworkNameSchema, PeerListSchema} from '../preferences/network'
import {ApplicationService} from '../services/app/ApplicationService'
import {WalletSyncService} from '../services/core/WalletSyncService'

const ArgsSchema = z.object({network: NetworkNameSchema, peers: PeerListSchema})

export class SetBannedPeersHandler {
  private applicationService: ApplicationService
  private walletSyncService: WalletSyncService

  constructor(applicationService: ApplicationService, walletSyncService: WalletSyncService) {
    this.applicationService = applicationService
    this.walletSyncService = walletSyncService
  }

  // The whole list, so lifting a ban is the same call as adding one. An empty
  // list is how the last one is lifted.
  handle = async (_event: IpcMainInvokeEvent, network: unknown, peers: unknown): Promise<void> => {
    const args = ArgsSchema.safeParse({network, peers})
    if (!args.success) {
      throw new Error(`setBannedPeers: ${args.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join(', ')}`)
    }

    // A ban is matched against the socket a peer opened, which always names a
    // port, so an entry without one would sit in the list matching nothing. A
    // parse that defaults the port to 0 is how an entry missing it is spotted.
    const invalid = args.data.peers.filter(peer => (parsePeerAddress(peer, 0)?.port ?? 0) === 0)
    if (invalid.length > 0) {
      throw new Error(`Banned peers are written as ip:port — invalid: ${invalid.map(peer => JSON.stringify(peer)).join(', ')}`)
    }

    const preferences = this.applicationService.preferences
    // Static mode dials the pinned list and nothing else — no DNS seeds, no
    // gossip — so a ban covering all of it is a network with no peers at all,
    // which is the state the schema already refuses to be configured into.
    const pinned = preferences.network[args.data.network].peers
    if (preferences.network.mode === 'static' && pinned.length > 0) {
      const banned = bannedSet(args.data.peers)
      const dialable = pinned.filter(peer => {
        const addr = parsePeerAddress(peer, 0)
        return addr != null && !banned.has(dialTarget(addr, 0))
      })
      if (dialable.length === 0) {
        throw new Error(`Banning every pinned peer would leave ${args.data.network} with nothing to dial`)
      }
    }

    await preferences.apply({
      ...preferences,
      network: {
        ...preferences.network,
        [args.data.network]: {...preferences.network[args.data.network], banned: args.data.peers},
      },
    })

    await this.walletSyncService.reloadBannedPeers()
  }
}
