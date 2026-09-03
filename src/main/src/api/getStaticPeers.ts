import {IpcMainInvokeEvent} from 'electron/utility'
import {NetworkNameSchema} from '../preferences/network'
import {ApplicationService} from '../services/app/ApplicationService'

export class GetStaticPeersHandler {
  private applicationService: ApplicationService

  constructor(applicationService: ApplicationService) {
    this.applicationService = applicationService
  }

  // The peers the user pinned for one network, whatever mode is in force —
  // 'dynamic' keeps the list, it just dials past it.
  handle = async (_event: IpcMainInvokeEvent, network: unknown): Promise<string[]> => {
    const parsed = NetworkNameSchema.safeParse(network)
    if (!parsed.success) {
      throw new Error(`getStaticPeers: expected 'mainnet' or 'testnet', got ${JSON.stringify(network)}`)
    }

    return [...this.applicationService.preferences.network[parsed.data].peers]
  }
}
