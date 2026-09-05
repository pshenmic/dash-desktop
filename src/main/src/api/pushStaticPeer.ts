import {IpcMainInvokeEvent} from 'electron/utility'
import {z} from 'zod'
import {DEFAULT_PEER_PORT} from '../../p2p/constants'
import {entryTarget, parsePeerAddress, peerListEntry} from '../../p2p/net/peerAddress'
import {NetworkNameSchema, PeerEntrySchema} from '../preferences/network'
import {ApplicationService} from '../services/app/ApplicationService'
import {WalletSyncService} from '../services/core/WalletSyncService'

const ArgsSchema = z.object({network: NetworkNameSchema, peer: PeerEntrySchema})

export class PushStaticPeerHandler {
  private applicationService: ApplicationService
  private walletSyncService: WalletSyncService

  constructor(applicationService: ApplicationService, walletSyncService: WalletSyncService) {
    this.applicationService = applicationService
    this.walletSyncService = walletSyncService
  }

  // Static mode dials the pinned list and nothing else — no DNS, no gossip — so
  // a peer that turns out to be dead is not one the wallet can replace, and it
  // is dialled for a version handshake before it is written.
  handle = async (_event: IpcMainInvokeEvent, network: unknown, peer: unknown): Promise<string[]> => {
    const args = ArgsSchema.safeParse({network, peer})
    // A ZodError crossing IPC arrives as its class name only.
    if (!args.success) {
      throw new Error(`pushStaticPeer: ${args.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join(', ')}`)
    }

    const port = DEFAULT_PEER_PORT[args.data.network]
    const addr = parsePeerAddress(args.data.peer, port)
    if (addr == null) {
      throw new Error(`Invalid peer address: ${JSON.stringify(args.data.peer)}`)
    }

    // Stored with the port spelled out rather than as typed: a ban is matched
    // at port 0, so a pinned entry without one never matches the peer it names.
    const peerEntry = peerListEntry(addr, port)
    const preferences = this.applicationService.preferences
    const pinned = preferences.network[args.data.network].staticPeers
    // A node dialled twice from one host drops both connections, and rewriting
    // the preferences would rebuild the session — in static mode that costs the
    // sync its peers and its progress for no change at all.
    const target = entryTarget(peerEntry, port)
    if (pinned.some(entry => entryTarget(entry, port) === target)) return [...pinned]

    const probe = await this.walletSyncService.probePeer(args.data.network, peerEntry)
    if (!probe.ok) {
      throw new Error(`Unreachable peer ${peerEntry}: ${probe.error}`)
    }

    const next = [...pinned, peerEntry]
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
