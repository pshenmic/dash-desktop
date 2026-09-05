import {IpcMainInvokeEvent} from 'electron/utility'
import {PeerInfo} from '../../p2p/types/pool'
import {WalletSyncService} from '../services/core/WalletSyncService'

export class GetConnectedPeersHandler {
  private walletSyncService: WalletSyncService

  constructor(walletSyncService: WalletSyncService) {
    this.walletSyncService = walletSyncService
  }

  handle = async (_event: IpcMainInvokeEvent): Promise<PeerInfo[]> =>
    this.walletSyncService.getConnectedPeers()
}
