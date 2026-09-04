import {IpcMainInvokeEvent} from 'electron/utility'
import {NetworkNameSchema} from '../preferences/network'
import {ApplicationService} from '../services/app/ApplicationService'

export class GetDynamicPeersHandler {
  private applicationService: ApplicationService

  constructor(applicationService: ApplicationService) {
    this.applicationService = applicationService
  }

  // The peers dynamic mode dials on top of what DNS and gossip find. Kept
  // whatever mode is in force: static mode leaves the list alone and dials
  // staticPeers instead.
  handle = async (_event: IpcMainInvokeEvent, network: unknown): Promise<string[]> => {
    const parsed = NetworkNameSchema.safeParse(network)
    if (!parsed.success) {
      throw new Error(`getDynamicPeers: expected 'mainnet' or 'testnet', got ${JSON.stringify(network)}`)
    }

    return [...this.applicationService.preferences.network[parsed.data].dynamicPeers]
  }
}
