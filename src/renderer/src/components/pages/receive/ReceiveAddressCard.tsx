import React, { useState } from "react"
import QRCode from "react-qr-code"
import { Text, Input } from "@renderer/components/dash-ui-kit-enxtended"
import { ReceivePageType } from "@renderer/constants"
import { WalletAddressDto } from "@renderer/api/types"
import CopyButton from "@renderer/components/ui/CopyButton"
import CoreAddressSelect from "./CoreAddressSelect"
import { useTheme } from "dash-ui-kit/react"
import { defaultReceiveCoreAddress } from "@renderer/utils/receiveDefaults"

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

  const selected = addresses.find(a => a.address === selectedAddress)
    ?? defaultReceiveCoreAddress(addresses, defaultAddress)
  const address = selected?.address ?? defaultAddress
  const qrValue = `dash:${address}${amount ? `?amount=${amount}` : ""}`

  const qrCodeColor = theme === 'dark' ? 'white' : 'var(--color-dash-brand)'

  return (
      <div className={"flex items-center gap-8 rounded-4xl dash-block p-6  max-w-190"}>
        <QRCode
          value={qrValue}
          size={225}
          fgColor={qrCodeColor}
          bgColor={"transparent"}
          className={"rounded-[.5625rem] shrink-0"}
        />

        <div className={"flex flex-col w-full"}>
          <div className={"flex flex-col gap-[.5rem]"}>
            <Text size={12} weight={"normal"} color={"brand"} opacity={50}>
              {data.adressText}
            </Text>
            <div className={"flex items-center gap-[.625rem]"}>
              <div className={"flex-1 min-w-0"}>
                <CoreAddressSelect
                  addresses={addresses}
                  selected={selected}
                  onSelect={setSelectedAddress}
                />
              </div>
              <CopyButton text={address} />
            </div>
          </div>

          <label htmlFor={"amount-input"} className={"flex flex-col gap-[.5rem] mt-[.75rem]"}>
            <Text size={12} weight={"normal"} color={"brand"} opacity={50}>
              {data.amount}
            </Text>
            <Input
              placeholder={data.placeholder}
              value={amount}
              onChange={(e) => {
                const val = e.target.value.replace(/[^0-9.]/g, '')
                const parts = val.split('.')
                if (parts.length > 2) return
                setAmount(val)
              }}
              id={"amount-input"}
              variant={"outlined"}
              className={'h-full !rounded-[.75rem] !bg-transparent !px-6.25'}
              colorScheme={'primary'}
              size={'md'}
            />
          </label>

          <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"mt-8"}>
            {data.description}
          </Text>
        </div>
      </div>
  )
}
