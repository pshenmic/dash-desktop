import {Network} from '../src/types/Network'
import {Logger} from '../src/utils/logger'
import {DAPI_REPROBE_MS} from './constants'
import {reachableDapiUrls} from './operations/dapi'

const log = new Logger('platform')

// Turns each evonode list p2p verifies into the reachable few an SDK is built on.
export class EvonodePins {
  // The list each network was last asked to probe: an older probe finishing
  // later must neither pin nor retry.
  private readonly latest = new Map<Network, string[]>()

  constructor(private readonly onPinned: (network: Network, dapiUrls: string[]) => void) {}

  probe(network: Network, dapiUrls: string[]): void {
    this.latest.set(network, dapiUrls)
    log.info(`${network}: probing ${dapiUrls.length} evonode(s)`)
    const started = Date.now()
    reachableDapiUrls(dapiUrls, network)
      .then(reachable => {
        if (reachable.length === 0) throw new Error(`none of ${dapiUrls.length} evonode(s) answered`)
        if (this.latest.get(network) !== dapiUrls) return
        log.info(`${network}: pinned to ${reachable.length} of ${dapiUrls.length} evonode(s) in ${Date.now() - started}ms: ${reachable.join(', ')}`)
        this.onPinned(network, reachable)
      })
      .catch(err => {
        if (this.latest.get(network) !== dapiUrls) return
        log.warn(`${network}: no reachable evonode, probing again in ${DAPI_REPROBE_MS / 1000}s:`, err)
        setTimeout(() => {
          if (this.latest.get(network) === dapiUrls) this.probe(network, dapiUrls)
        }, DAPI_REPROBE_MS).unref?.()
      })
  }
}
