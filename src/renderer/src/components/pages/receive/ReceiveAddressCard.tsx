import React, { useState } from "react"
import QRCode from "react-qr-code"
import { Text } from "@renderer/components/dash-ui-kit-enxtended"
import { ReceivePageType } from "@renderer/constants"
import { RECEIVE_AMOUNT_INPUT, RECEIVE_EMPTY_TEXTS } from "@renderer/constants/receiveCard"
import { SURFACE_SECTION } from "@renderer/constants/surfaces"
import { WalletAddressDto } from "@renderer/api/types"
import CopyButton from "@renderer/components/ui/CopyButton"
import NoResults from "@renderer/components/ui/NoResults"
import CoreAddressSelect from "./CoreAddressSelect"
import { useTheme } from "dash-ui-kit/react"
import { defaultReceiveCoreAddress, receiveCoreAddresses } from "@renderer/utils/receiveDefaults"

type ReceiveAddressCardProps = {
  addresses: WalletAddressDto[]
  defaultAddress: string
  data: ReceivePageType['receiveAddressCard']
}

export default function ReceiveAddressCard({
  addresses,
  defaultAddress,
  data,
}: ReceiveAddressCardProps): React.JSX.Element {
  const [amount, setAmount] = useState('');
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null)
  const { theme } = useTheme()

  const receiveAddresses = receiveCoreAddresses(addresses)
  const selected = defaultReceiveCoreAddress(receiveAddresses, selectedAddress ?? defaultAddress)
  if (!selected) {
    return <NoResults noResults={RECEIVE_EMPTY_TEXTS.noCoreAddresses} />
  }

  const address = selected.address
  const qrValue = `dash:${address}${amount ? `?amount=${amount}` : ""}`

  const qrCodeColor = theme === 'dark' ? 'white' : 'var(--color-dash-brand)'

  return (
      <div className={`flex w-min max-w-190 items-center gap-8 ${SURFACE_SECTION}`}>
        <QRCode
          value={qrValue}
          size={225}
          fgColor={qrCodeColor}
          bgColor={"transparent"}
          className={"rounded-[.5625rem] shrink-0"}
        />

        <div className={"flex flex-col w-full"}>
          <div className={"flex flex-col gap-[.5rem]"}>
            <Text size={12} weight={"medium"} color={"brand"} opacity={50}>
              {data.addressText}
            </Text>
            <div className={"flex items-center gap-[.625rem]"}>
              <CoreAddressSelect
                addresses={receiveAddresses}
                selected={selected}
                onSelect={setSelectedAddress}
              />
              <CopyButton text={address} />
            </div>
          </div>

          <label htmlFor={"amount-input"} className={"flex flex-col gap-[.5rem] mt-[.75rem]"}>
            <Text size={12} weight={"medium"} color={"brand"} opacity={50}>
              {data.amount}
            </Text>
            <input
              placeholder={data.placeholder}
              value={amount}
              onChange={(e) => {
                const val = e.target.value.replace(/[^0-9.]/g, '')
                const parts = val.split('.')
                if (parts.length > 2) return
                setAmount(val)
              }}
              id={"amount-input"}
              className={RECEIVE_AMOUNT_INPUT}
            />
          </label>
        </div>
      </div>
  )
}
