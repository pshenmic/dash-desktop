import { useMemo } from 'react'
import { usePlatformAddresses } from './usePlatformAddresses'
import { useWalletBalance } from './useWalletBalance'

export function usePlatformCredits(walletId: string | undefined): bigint {
  const { balance } = useWalletBalance(walletId)
  const { platformAddresses } = usePlatformAddresses(walletId)

  return useMemo(
    () => platformAddresses.reduce((sum, a) => sum + BigInt(a.balanceCredits), balance.credits.amount),
    [platformAddresses, balance.credits.amount]
  )
}
