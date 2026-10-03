import {IpcMainInvokeEvent} from 'electron/utility'
import {ApplicationService} from '../services/app/ApplicationService'

export class GetCollectMetricsHandler {
  private applicationService: ApplicationService

  constructor(applicationService: ApplicationService) {
    this.applicationService = applicationService
  }

  handle = async (_event: IpcMainInvokeEvent): Promise<boolean> => {
    return this.applicationService.preferences.general.collectMetrics
  }
}
