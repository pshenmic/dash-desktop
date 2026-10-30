import type { WalletDto } from '@renderer/api/types'
import { walletDisplayName } from '@renderer/utils/wallets'

export function walletDisplayNameById(wallets: WalletDto[], walletId: string | null): string | null {
  const index = wallets.findIndex((wallet) => wallet.walletId === walletId)
  return index === -1 ? null : walletDisplayName(wallets[index], index)
}
