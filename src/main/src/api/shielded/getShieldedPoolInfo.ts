import { IpcMainInvokeEvent } from 'electron/utility'
import { ShieldedService, ShieldedPoolInfo } from '../../services/ShieldedService'
import { Network } from '../../types'

export class GetShieldedPoolInfoHandler {
  private shieldedService: ShieldedService

  constructor(shieldedService: ShieldedService) {
    this.shieldedService = shieldedService
  }

  handle = async (_event: IpcMainInvokeEvent, network: Network): Promise<ShieldedPoolInfo> => {
    return this.shieldedService.getPoolInfo(network)
  }
}
