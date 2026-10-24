import {Network} from '../types/Network'

// The platform worker builds no SDK for a network before its first evonode list
// has been probed, so requests for it wait here until the worker pins one.
export class DapiPinGate {
  private readonly pinned = new Set<Network>()
  private readonly waiters = new Map<Network, Set<() => void>>()

  pin(network: Network): void {
    this.pinned.add(network)
    for (const wake of this.waiters.get(network) ?? []) wake()
    this.waiters.delete(network)
  }

  // A restarted worker starts with no pins of its own.
  reset(): void {
    this.pinned.clear()
  }

  wait(network: Network, timeoutMs: number): Promise<void> | null {
    if (this.pinned.has(network)) return null
    return new Promise((resolve, reject) => {
      const waiters = this.waiters.get(network) ?? new Set<() => void>()
      this.waiters.set(network, waiters)
      const wake = (): void => {
        clearTimeout(timer)
        resolve()
      }
      const timer = setTimeout(() => {
        waiters.delete(wake)
        reject(new Error(`no reachable evonode for ${network} after ${timeoutMs / 1000}s`))
      }, timeoutMs)
      waiters.add(wake)
    })
  }
}
