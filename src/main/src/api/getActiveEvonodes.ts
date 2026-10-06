import {IpcMainInvokeEvent} from 'electron/utility'
import type {EvonodeStatus} from '../../platform/types/messages'
import {NetworkNameSchema} from '../preferences/network'
import {PlatformWorkerService} from '../services/platform/PlatformWorkerService'

export class GetActiveEvonodesHandler {
  private platformWorkerService: PlatformWorkerService

  constructor(platformWorkerService: PlatformWorkerService) {
    this.platformWorkerService = platformWorkerService
  }

  handle = async (_event: IpcMainInvokeEvent, network: unknown): Promise<EvonodeStatus[]> => {
    const parsed = NetworkNameSchema.safeParse(network)
    if (!parsed.success) {
      throw new Error(`getActiveEvonodes: expected 'mainnet' or 'testnet', got ${JSON.stringify(network)}`)
    }

    return this.platformWorkerService.request('activeEvonodes', parsed.data, {})
  }
}
