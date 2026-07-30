import { Network } from '@renderer/api/types'

const EXPLORER_HOST: Record<Network, string> = {
  mainnet: 'https://dashscan.io',
  testnet: 'https://testnet.dashscan.io',
}

const PLATFORM_EXPLORER_HOST: Record<Network, string> = {
  mainnet: 'https://platform-explorer.com',
  testnet: 'https://testnet.platform-explorer.com',
}

export function transactionUrl(txid: string, network: Network): string {
  return `${EXPLORER_HOST[network]}/transactions/${txid}`
}

export function platformTransactionUrl(hash: string, network: Network): string {
  return `${PLATFORM_EXPLORER_HOST[network]}/transaction/${hash}`
}

export function addressUrl(address: string, network: Network): string {
  return `${EXPLORER_HOST[network]}/address/${address}`
}

export function openExternal(url: string): void {
  window.open(url, '_blank', 'noopener,noreferrer')
}
