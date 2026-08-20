import {net} from 'electron'
import {DASHSCAN_BASE_URLS, RPC_STATUS_REQUEST_TIMEOUT_MS} from '../../constants'
import {Network} from '../../types/Network'
import {RpcStatusFetcher} from '../../types/Connection'

export class ConnectionService {
  private readonly fetchStatus: RpcStatusFetcher

  constructor(fetchStatus: RpcStatusFetcher = (url, init) => net.fetch(url, init)) {
    this.fetchStatus = fetchStatus
  }

  async getRpcStatus(network: Network): Promise<boolean> {
    const baseUrl = DASHSCAN_BASE_URLS[network]
    if (!baseUrl) return false

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), RPC_STATUS_REQUEST_TIMEOUT_MS)

    try {
      const response = await this.fetchStatus(`${baseUrl}/status`, {signal: controller.signal})
      return response.ok
    } catch {
      return false
    } finally {
      clearTimeout(timer)
    }
  }
}
