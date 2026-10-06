import {IpcMainInvokeEvent} from 'electron/utility'
import {z} from 'zod'
import {NetworkNameSchema} from '../preferences/network'
import {ApplicationService} from '../services/app/ApplicationService'
import {PlatformWorkerService} from '../services/platform/PlatformWorkerService'

const ArgsSchema = z.object({network: NetworkNameSchema, evonodes: z.array(z.url({protocol: /^https$/}))})

export class SetEvonodesHandler {
  private applicationService: ApplicationService
  private platformWorkerService: PlatformWorkerService

  constructor(applicationService: ApplicationService, platformWorkerService: PlatformWorkerService) {
    this.applicationService = applicationService
    this.platformWorkerService = platformWorkerService
  }

  handle = async (_event: IpcMainInvokeEvent, network: unknown, evonodes: unknown): Promise<void> => {
    const args = ArgsSchema.safeParse({network, evonodes})
    // A ZodError crossing IPC arrives as its class name only.
    if (!args.success) {
      throw new Error(`setEvonodes: ${args.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join(', ')}`)
    }

    const preferences = this.applicationService.preferences
    await preferences.apply({
      ...preferences,
      network: {
        ...preferences.network,
        evonodes: {...preferences.network.evonodes, [args.data.network]: args.data.evonodes},
      },
    })

    this.platformWorkerService.reloadEvonodes()
  }
}
