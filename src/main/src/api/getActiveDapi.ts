import {IpcMainInvokeEvent} from 'electron/utility'
import type {DapiStatus} from '../../platform/types/messages'
import {NetworkNameSchema} from '../preferences/network'
import {PlatformWorkerService} from '../services/platform/PlatformWorkerService'

export class GetActiveDapiHandler {
  private platformWorkerService: PlatformWorkerService

  constructor(platformWorkerService: PlatformWorkerService) {
    this.platformWorkerService = platformWorkerService
  }

  handle = async (_event: IpcMainInvokeEvent, network: unknown): Promise<DapiStatus[]> => {
    const parsed = NetworkNameSchema.safeParse(network)
    if (!parsed.success) {
      throw new Error(`getActiveDapi: expected 'mainnet' or 'testnet', got ${JSON.stringify(network)}`)
    }

    return this.platformWorkerService.request('activeDapi', parsed.data, {})
  }
}
