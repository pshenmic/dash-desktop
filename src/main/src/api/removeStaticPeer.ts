import {IpcMainInvokeEvent} from 'electron/utility'
import {z} from 'zod'
import {DEFAULT_PEER_PORT} from '../../p2p/constants'
import {entryTarget} from '../../p2p/net/peerAddress'
import {NetworkNameSchema, PeerEntrySchema} from '../preferences/network'
import {ApplicationService} from '../services/app/ApplicationService'
import {WalletSyncService} from '../services/core/WalletSyncService'

const ArgsSchema = z.object({network: NetworkNameSchema, peer: PeerEntrySchema})

export class RemoveStaticPeerHandler {
  private applicationService: ApplicationService
  private walletSyncService: WalletSyncService

  constructor(applicationService: ApplicationService, walletSyncService: WalletSyncService) {
    this.applicationService = applicationService
    this.walletSyncService = walletSyncService
  }

  handle = async (_event: IpcMainInvokeEvent, network: unknown, peer: unknown): Promise<string[]> => {
    const args = ArgsSchema.safeParse({network, peer})
    if (!args.success) {
      throw new Error(`removeStaticPeer: ${args.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join(', ')}`)
    }

    const preferences = this.applicationService.preferences
    const port = DEFAULT_PEER_PORT[args.data.network]
    const target = entryTarget(args.data.peer, port)
    const pinned = preferences.network[args.data.network].staticPeers
    const next = pinned.filter(entry => entryTarget(entry, port) !== target)
    if (next.length === pinned.length) return [...pinned]

    // Static mode dials this list and nothing else, so dropping the last entry
    // leaves that network with no peers — what setBannedPeers also refuses.
    if (preferences.network.mode === 'static' && next.length === 0) {
      throw new Error(`Removing ${args.data.peer} would leave ${args.data.network} with nothing to dial`)
    }

    await preferences.apply({
      ...preferences,
      network: {
        ...preferences.network,
        [args.data.network]: {...preferences.network[args.data.network], staticPeers: next},
      },
    })

    await this.walletSyncService.reloadPeerPreferences()
    return next
  }
}
