import React, { useState } from "react"
import { Text } from "@renderer/components/dash-ui-kit-extended"
import { ReceivePageType } from "@renderer/constants"
import { RECEIVE_EMPTY_TEXTS } from "@renderer/constants/receiveCard"
import { SURFACE_SECTION } from "@renderer/constants/surfaces"
import { WalletAddressDto } from "@renderer/api/types"
import CopyButton from "@renderer/components/ui/CopyButton"
import HashField from "@renderer/components/ui/HashField"
import NoResults from "@renderer/components/ui/NoResults"
import CoreAddressSelect from "./CoreAddressSelect"
import ReceiveQr from "./ReceiveQr"
import { useAuth } from "@renderer/contexts/AuthContext"
import { RECEIVE_INVOICE_ADDRESS_LABELS, RECEIVE_INVOICE_COPY } from "@renderer/constants/receiveInvoice"
import { SEND_AMOUNT_PATTERN } from "@renderer/constants/sendRecipients"
import { defaultReceiveCoreAddress, receiveCoreAddresses } from "@renderer/utils/receiveDefaults"
import { corePaymentUri, receiveAmountParam } from "@renderer/utils/receiveInvoice"

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
  const { status } = useAuth()

  const receiveAddresses = receiveCoreAddresses(addresses)
  const selected = defaultReceiveCoreAddress(receiveAddresses, selectedAddress ?? defaultAddress)
  if (!selected) {
    return <NoResults noResults={RECEIVE_EMPTY_TEXTS.noCoreAddresses} />
  }

  const address = selected.address
  const amountParam = receiveAmountParam(amount)
  const paymentUri = corePaymentUri(address, amountParam)

  return (
      <div className={`flex w-min max-w-190 items-center gap-8 ${SURFACE_SECTION}`}>
        <ReceiveQr
          value={paymentUri}
          invoice={{
            addressLabel: RECEIVE_INVOICE_ADDRESS_LABELS.core,
            address,
            amount: amountParam,
            paymentLink: amountParam == null ? null : paymentUri,
            network: status?.network ?? null,
          }}
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
                if (SEND_AMOUNT_PATTERN.test(val)) setAmount(val)
              }}
              id={"amount-input"}
              className={"w-full rounded-[.875rem] dash-block px-4 py-3.5 text-sm font-medium dash-text-default outline-none placeholder:text-current placeholder:opacity-40 focus-visible:ring-2 focus-visible:ring-dash-brand dark:focus-visible:ring-dash-mint"}
            />
          </label>

          <div className={"mt-[.75rem]"}>
            <HashField hash={paymentUri} label={RECEIVE_INVOICE_COPY.paymentLink} />
          </div>
        </div>
      </div>
  )
}
