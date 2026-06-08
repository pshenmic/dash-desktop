import { Network } from '@renderer/api/types'

const EXPLORER_HOST: Record<Network, string> = {
  mainnet: 'https://dashscan.io',
  testnet: 'https://testnet.dashscan.io',
}

export function transactionUrl(txid: string, network: Network): string {
  return `${EXPLORER_HOST[network]}/transactions/${txid}`
}

export function openExternal(url: string): void {
  window.open(url, '_blank', 'noopener,noreferrer')
}
