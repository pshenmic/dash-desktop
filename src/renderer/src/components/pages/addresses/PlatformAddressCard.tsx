import { Text } from '@renderer/components/dash-ui-kit-enxtended'
import { PlatformAddressDto } from '@renderer/api/types'
import { useAuth } from '@renderer/contexts/AuthContext'
import { platformAddressUrl } from '@renderer/utils/explorer'
import { creditsToDuffs } from '@renderer/utils/balance'
import AddressRow from '@renderer/components/ui/AddressRow'
import CreditsAmount from '@renderer/components/ui/CreditsAmount'
import { useBalanceVisibility } from '@renderer/hooks/useBalanceVisibility'

export default function PlatformAddressCard({
  platformAddress,
  balanceCredits,
  nonce,
}: PlatformAddressDto): React.JSX.Element {
  const { status: appStatus } = useAuth()
  const { isBalanceVisible } = useBalanceVisibility()
  const network = appStatus?.network ?? null

  return (
    <AddressRow
      address={platformAddress}
      meta={
        <Text size={10} weight={"medium"} color={"brand"} opacity={50}>
          Tx count: <span className={"font-bold"}>{nonce}</span>
        </Text>
      }
      amount={<CreditsAmount credits={balanceCredits} compact unit={"Credits"} showFiat={false} align={"end"} amountClassName={"font-bold"} />}
      fiatDuffs={creditsToDuffs(balanceCredits)}
      explorerUrl={network ? platformAddressUrl(platformAddress, network) : undefined}
      hidden={!isBalanceVisible}
    />
  )
}
