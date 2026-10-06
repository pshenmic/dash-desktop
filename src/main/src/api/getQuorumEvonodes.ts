import {IpcMainInvokeEvent} from 'electron/utility'
import type {Evonode} from '../../platform/types/messages'
import {NetworkNameSchema} from '../preferences/network'
import {PlatformWorkerService} from '../services/platform/PlatformWorkerService'

export class GetQuorumEvonodesHandler {
  private platformWorkerService: PlatformWorkerService

  constructor(platformWorkerService: PlatformWorkerService) {
    this.platformWorkerService = platformWorkerService
  }

  handle = async (_event: IpcMainInvokeEvent, network: unknown): Promise<Evonode[]> => {
    const parsed = NetworkNameSchema.safeParse(network)
    if (!parsed.success) {
      throw new Error(`getQuorumEvonodes: expected 'mainnet' or 'testnet', got ${JSON.stringify(network)}`)
    }

    return this.platformWorkerService.request('quorumEvonodes', parsed.data, {})
  }
}
