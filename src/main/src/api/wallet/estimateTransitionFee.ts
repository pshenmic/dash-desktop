import { IpcMainInvokeEvent } from 'electron/utility'
import { PlatformAddressService } from '../../services/PlatformAddressService'
import { Network } from '../../types/Network'
import { FeeQuery, FeeQuote } from '../../../platform/types/messages'

export class EstimateTransitionFeeHandler {
  private platformAddressService: PlatformAddressService

  constructor(platformAddressService: PlatformAddressService) {
    this.platformAddressService = platformAddressService
  }

  handle = async (
    _event: IpcMainInvokeEvent,
    network: Network,
    query: FeeQuery,
  ): Promise<FeeQuote> => {
    return this.platformAddressService.estimateTransitionFee(network, query)
  }
}