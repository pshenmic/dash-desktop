import {IpcMainInvokeEvent} from 'electron/utility'
import {z} from 'zod'
import {NetworkNameSchema} from '../preferences/network'
import {ApplicationService} from '../services/app/ApplicationService'
import {PlatformWorkerService} from '../services/platform/PlatformWorkerService'

const ArgsSchema = z.object({network: NetworkNameSchema, dapiUrls: z.array(z.url({protocol: /^https$/}))})

export class SetDapiHandler {
  private applicationService: ApplicationService
  private platformWorkerService: PlatformWorkerService

  constructor(applicationService: ApplicationService, platformWorkerService: PlatformWorkerService) {
    this.applicationService = applicationService
    this.platformWorkerService = platformWorkerService
  }

  handle = async (_event: IpcMainInvokeEvent, network: unknown, dapiUrls: unknown): Promise<void> => {
    const args = ArgsSchema.safeParse({network, dapiUrls})
    // A ZodError crossing IPC arrives as its class name only.
    if (!args.success) {
      throw new Error(`setDapi: ${args.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join(', ')}`)
    }

    const preferences = this.applicationService.preferences
    const stored = preferences.network.dapi[args.data.network]
    const added = args.data.dapiUrls.filter(dapiUrl => !stored.includes(dapiUrl))
    const statuses = await Promise.all(added.map(dapiUrl =>
      this.platformWorkerService.request('dapiStatus', args.data.network, {dapiUrl})))
    const unreachable = statuses.filter(status => status.error != null)
    if (unreachable.length > 0) {
      throw new Error(`Unreachable DAPI ${unreachable.map(status => `${status.dapiUrl}: ${status.error}`).join(', ')}`)
    }

    await preferences.apply({
      ...preferences,
      network: {
        ...preferences.network,
        dapi: {...preferences.network.dapi, [args.data.network]: args.data.dapiUrls},
      },
    })

    this.platformWorkerService.reloadDapi()
  }
}
