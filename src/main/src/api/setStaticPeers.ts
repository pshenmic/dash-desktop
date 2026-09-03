import {IpcMainInvokeEvent} from 'electron/utility'
import {z} from 'zod'
import {parsePeerAddress} from '../../p2p/net/peerAddress'
import {NetworkNameSchema, PeerListSchema} from '../preferences/network'
import {ApplicationService} from '../services/app/ApplicationService'
import {WalletSyncService} from '../services/core/WalletSyncService'

const ArgsSchema = z.object({network: NetworkNameSchema, peers: PeerListSchema})

export class SetStaticPeersHandler {
  private applicationService: ApplicationService
  private walletSyncService: WalletSyncService

  constructor(applicationService: ApplicationService, walletSyncService: WalletSyncService) {
    this.applicationService = applicationService
    this.walletSyncService = walletSyncService
  }

  // Arguments are parsed rather than trusted: nothing between a renderer call
  // and here checks them, and a wrong shape reached the peer list as a
  // TypeError rather than a message anyone could act on.
  handle = async (_event: IpcMainInvokeEvent, network: unknown, peers: unknown): Promise<void> => {
    const args = ArgsSchema.safeParse({network, peers})
    // A ZodError crossing IPC arrives as its class name only.
    if (!args.success) {
      throw new Error(`setStaticPeers: ${args.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join(', ')}`)
    }

    // The pool drops an entry it cannot parse, so in static mode a typo is the
    // difference between the peer set the user named and no peers at all. The
    // port the parse defaults to is irrelevant to whether the entry is valid.
    const invalid = args.data.peers.filter(peer => parsePeerAddress(peer, 1) == null)
    if (invalid.length > 0) {
      throw new Error(`Invalid peer address(es): ${invalid.map(peer => JSON.stringify(peer)).join(', ')}`)
    }

    const preferences = this.applicationService.preferences
    await preferences.apply({
      ...preferences,
      network: {
        ...preferences.network,
        [args.data.network]: {...preferences.network[args.data.network], peers: args.data.peers},
      },
    })

    await this.walletSyncService.reloadPeerPreferences()
  }
}
