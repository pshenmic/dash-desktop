import {IpcMainInvokeEvent} from 'electron/utility'
import {z} from 'zod'
import {parsePeerAddress} from '../../p2p/net/peerAddress'
import {NetworkNameSchema, PeerListSchema} from '../preferences/network'
import {ApplicationService} from '../services/app/ApplicationService'
import {WalletSyncService} from '../services/core/WalletSyncService'

const ArgsSchema = z.object({network: NetworkNameSchema, peers: PeerListSchema})

export class SetDynamicPeersHandler {
  private applicationService: ApplicationService
  private walletSyncService: WalletSyncService

  constructor(applicationService: ApplicationService, walletSyncService: WalletSyncService) {
    this.applicationService = applicationService
    this.walletSyncService = walletSyncService
  }

  handle = async (_event: IpcMainInvokeEvent, network: unknown, peers: unknown): Promise<void> => {
    const args = ArgsSchema.safeParse({network, peers})
    // A ZodError crossing IPC arrives as its class name only.
    if (!args.success) {
      throw new Error(`setDynamicPeers: ${args.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join(', ')}`)
    }

    // Dropped by the pool if it cannot parse. Unlike the pinned list an entry
    // lost here costs the user nothing but that peer, so the port stays
    // optional — the pool fills in the network default.
    const invalid = args.data.peers.filter(peer => parsePeerAddress(peer, 1) == null)
    if (invalid.length > 0) {
      throw new Error(`Invalid peer address(es): ${invalid.map(peer => JSON.stringify(peer)).join(', ')}`)
    }

    const preferences = this.applicationService.preferences
    await preferences.apply({
      ...preferences,
      network: {
        ...preferences.network,
        [args.data.network]: {...preferences.network[args.data.network], dynamicPeers: args.data.peers},
      },
    })

    await this.walletSyncService.reloadPeerPreferences()
  }
}
