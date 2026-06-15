import type { WalletDto as ApiWalletDto, Network } from '@renderer/api/types'

export interface WalletDropdownOption {
  value: string
  label: string
  isSelected: boolean
  network: Network
}

export function walletDisplayName(wallet: ApiWalletDto, index: number): string {
  const raw = wallet.label?.trim()
  return raw && raw.length > 0 ? raw : `Wallet_${index + 1}`
}
export function toDropdownOptions(
  wallets: ApiWalletDto[],
  filter: (w: ApiWalletDto) => boolean = () => true,
): WalletDropdownOption[] {
  const result: WalletDropdownOption[] = []
  wallets.forEach((w, i) => {
    if (!filter(w)) return
    result.push({
      value: w.walletId,
      label: walletDisplayName(w, i),
      isSelected: w.selected,
      network: w.network,
    })
  })
  return result
}
