import { IpcMainInvokeEvent } from 'electron/utility'
import {ShieldedService} from '../../services/ShieldedService'
import { Network } from '../../types'
import {ShieldedPoolInfo} from '../../types/Shielded'

export class GetShieldedPoolInfoHandler {
  private shieldedService: ShieldedService

  constructor(shieldedService: ShieldedService) {
    this.shieldedService = shieldedService
  }

  handle = async (_event: IpcMainInvokeEvent, network: Network): Promise<ShieldedPoolInfo> => {
    return this.shieldedService.getPoolInfo(network)
  }
}
