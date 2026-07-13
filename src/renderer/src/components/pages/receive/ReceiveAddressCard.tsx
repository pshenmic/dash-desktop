import React, { useState } from "react"
import QRCode from "react-qr-code"
import { Text, Input } from "@renderer/components/dash-ui-kit-enxtended"
import { ReceivePageType } from "@renderer/constants"
import CopyButton from "@renderer/components/ui/CopyButton"
import { useTheme } from "dash-ui-kit/react"

type ReceiveAddressCardProps = {
  address: string
  data: ReceivePageType['receiveAddressCard']
}

export default function ReceiveAddressCard({
  address,
  data,
}: ReceiveAddressCardProps): React.JSX.Element {
  const [amount, setAmount] = useState('');
  const { theme } = useTheme()
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
              <Text size={14} weight={"medium"} color={"brand"} className={"min-w-0 break-all"}>
                {address}
              </Text>
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
