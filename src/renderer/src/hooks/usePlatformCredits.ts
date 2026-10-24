import { useMemo } from 'react'
import { usePlatformAddresses } from './usePlatformAddresses'
import { useWalletBalance } from './useWalletBalance'
import { totalPlatformAddressCredits } from '../utils/platformBalances'

export function usePlatformCredits(walletId: string | undefined): bigint {
  const { balance } = useWalletBalance(walletId)
  const { platformAddresses } = usePlatformAddresses(walletId)

  return useMemo(
    () => totalPlatformAddressCredits(platformAddresses) + balance.credits.amount,
    [platformAddresses, balance.credits.amount]
  )
}
