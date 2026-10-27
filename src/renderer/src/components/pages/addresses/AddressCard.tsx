import { useState } from 'react'
import { Text } from '@renderer/components/dash-ui-kit-extended'
import { WalletAddressDto } from '@renderer/api/types'
import { davToDashCompact } from '@renderer/utils/balance'
import { useAuth } from '@renderer/contexts/AuthContext'
import { addressUrl } from '@renderer/utils/explorer'
import AddressRow from '@renderer/components/ui/AddressRow'
import CustomBadge from '@renderer/components/ui/CustomBadge'
import DashBigNumber from '@renderer/components/ui/DashBigNumber'
import AddressQrModal from '@renderer/components/modal/AddressQrModal'
import { useBalanceVisibility } from '@renderer/hooks/useBalanceVisibility'
import { isUsedCoreAddress } from '@renderer/utils/addressUsage'
import { addressesPage } from '@renderer/constants'
import { DASH_UNIT } from '@renderer/constants/balance'

export default function AddressCard({
  address,
  balance,
  txCount,
  isUsed,
}: WalletAddressDto): React.JSX.Element {
  const [isQrOpen, setIsQrOpen] = useState(false)
  const { isBalanceVisible } = useBalanceVisibility()
  const { status: appStatus } = useAuth()
  const network = appStatus?.network ?? null

  return (
    <>
      <AddressRow
        address={address}
        meta={
          <div className={"flex items-center gap-[.3125rem]"}>
            <Text size={10} weight={"medium"} color={"brand"} opacity={50}>
              Tx count: <span className={"font-bold"}>{txCount}</span>
            </Text>
            {isUsedCoreAddress({ isUsed, txCount }) && <CustomBadge text={addressesPage.usedBadge} variant="muted" size="xs" />}
          </div>
        }
        amount={
          <>
            <span className={"font-bold"}>
              <DashBigNumber>{davToDashCompact(balance).toString()}</DashBigNumber>
            </span>
            <span className={"font-normal"}>{` ${DASH_UNIT}`}</span>
          </>
        }
        fiatDuffs={balance}
        onQr={() => setIsQrOpen(true)}
        explorerUrl={network ? addressUrl(address, network) : undefined}
        hidden={!isBalanceVisible}
      />
      {isQrOpen && <AddressQrModal address={address} onClose={() => setIsQrOpen(false)} />}
    </>
  )
}
