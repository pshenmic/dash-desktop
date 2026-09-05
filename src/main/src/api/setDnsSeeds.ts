import {IpcMainInvokeEvent} from 'electron/utility'
import {z} from 'zod'
import {isDnsSeedHost} from '../../p2p/net/peerAddress'
import {NetworkNameSchema, PeerListSchema} from '../preferences/network'
import {ApplicationService} from '../services/app/ApplicationService'
import {WalletSyncService} from '../services/core/WalletSyncService'

const ArgsSchema = z.object({network: NetworkNameSchema, seeds: PeerListSchema})

export class SetDnsSeedsHandler {
  private applicationService: ApplicationService
  private walletSyncService: WalletSyncService

  constructor(applicationService: ApplicationService, walletSyncService: WalletSyncService) {
    this.applicationService = applicationService
    this.walletSyncService = walletSyncService
  }

  handle = async (_event: IpcMainInvokeEvent, network: unknown, seeds: unknown): Promise<void> => {
    const args = ArgsSchema.safeParse({network, seeds})
    // A ZodError crossing IPC arrives as its class name only.
    if (!args.success) {
      throw new Error(`setDnsSeeds: ${args.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join(', ')}`)
    }

    const invalid = args.data.seeds.filter(seed => !isDnsSeedHost(seed))
    if (invalid.length > 0) {
      throw new Error(`DNS seeds are hostnames — invalid: ${invalid.map(seed => JSON.stringify(seed)).join(', ')}`)
    }

    const preferences = this.applicationService.preferences
    await preferences.apply({
      ...preferences,
      network: {
        ...preferences.network,
        [args.data.network]: {...preferences.network[args.data.network], dnsSeeds: args.data.seeds},
      },
    })

    // A pool resolves its seeds once, on connect, so the session has to be
    // rebuilt — unlike a ban, which the running pools take in place.
    await this.walletSyncService.reloadPeerPreferences()
  }
}
