import {IpcMainInvokeEvent} from 'electron/utility'
import {NetworkNameSchema} from '../preferences/network'
import {ApplicationService} from '../services/app/ApplicationService'

export class GetDapiUrlsHandler {
  private applicationService: ApplicationService

  constructor(applicationService: ApplicationService) {
    this.applicationService = applicationService
  }

  handle = async (_event: IpcMainInvokeEvent, network: unknown): Promise<string[]> => {
    const parsed = NetworkNameSchema.safeParse(network)
    if (!parsed.success) {
      throw new Error(`getDapiUrls: expected 'mainnet' or 'testnet', got ${JSON.stringify(network)}`)
    }

    return [...this.applicationService.preferences.network.dapi[parsed.data]]
  }
}
