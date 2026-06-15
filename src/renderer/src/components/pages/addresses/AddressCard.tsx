import { useState } from 'react'
import { BigNumber } from 'dash-ui-kit/react'
import { Text } from '@renderer/components/dash-ui-kit-enxtended'
import { ReceiveIcon } from '@renderer/components/dash-ui-kit-enxtended/icons'
import { WalletAddressDto } from '@renderer/api/types'
import { davToDash } from '@renderer/utils/balance'
import CustomBadge from '@renderer/components/ui/CustomBadge'
import CopyButton from '@renderer/components/ui/CopyButton'
import QrButton from '@renderer/components/ui/QrButton'
import AddressQrModal from '@renderer/components/modal/AddressQrModal'

export default function AddressCard({
  address,
  balance,
  usdBalance,
}: WalletAddressDto): React.JSX.Element {
  const [isQrOpen, setIsQrOpen] = useState(false)

  return (
    <div className={"flex items-center justify-between px-[.9375rem] py-[.625rem] rounded-[.875rem] dash-block"}>
      <div className={"flex flex-col gap-1"}>
        <div className={"flex items-center gap-[.3125rem]"}>
          <div className={"size-[.875rem] rounded-full dash-block-5 flex items-center justify-center"}>
            <ReceiveIcon size={6} color={"currentColor"} className={"dash-text-default"} />
          </div>
          <Text size={12} weight={"medium"} color={"brand"}>
            {address}
          </Text>
          <CopyButton text={address} />
          <QrButton onClick={() => setIsQrOpen(true)} />
        </div>
      </div>

      {isQrOpen && <AddressQrModal address={address} onClose={() => setIsQrOpen(false)} />}

      <div className={"flex flex-col items-end gap-1"}>
        <div className={"flex items-center gap-2"}>
          <Text size={14} weight={"medium"} color={"brand"}>
            <span className={"font-bold"}>
              <BigNumber>{davToDash(balance).toString()}</BigNumber>
            </span>
            {' Dash'}
          </Text>
          <CustomBadge text={`~ $${usdBalance}`} variant="default" size="xs" />
        </div>
      </div>
    </div>
  )
}
