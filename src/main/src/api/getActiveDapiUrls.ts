import {IpcMainInvokeEvent} from 'electron/utility'
import type {DapiUrlStatus} from '../../platform/types/messages'
import {NetworkNameSchema} from '../preferences/network'
import {PlatformWorkerService} from '../services/platform/PlatformWorkerService'

export class GetActiveDapiUrlsHandler {
  private platformWorkerService: PlatformWorkerService

  constructor(platformWorkerService: PlatformWorkerService) {
    this.platformWorkerService = platformWorkerService
  }

  handle = async (_event: IpcMainInvokeEvent, network: unknown): Promise<DapiUrlStatus[]> => {
    const parsed = NetworkNameSchema.safeParse(network)
    if (!parsed.success) {
      throw new Error(`getActiveDapiUrls: expected 'mainnet' or 'testnet', got ${JSON.stringify(network)}`)
    }

    return this.platformWorkerService.request('activeDapiUrls', parsed.data, {})
  }
}
