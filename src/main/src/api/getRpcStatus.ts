import {IpcMainInvokeEvent} from 'electron/utility'
import {ConnectionService} from '../services/app/ConnectionService'
import {Network} from '../types/Network'

export class GetRpcStatusHandler {
  private readonly connectionService: ConnectionService

  constructor(connectionService: ConnectionService) {
    this.connectionService = connectionService
  }

  handle = async (_event: IpcMainInvokeEvent, network: Network): Promise<boolean> => {
    return this.connectionService.getRpcStatus(network)
  }
}
