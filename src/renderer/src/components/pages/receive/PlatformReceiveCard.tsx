import { useState } from 'react'
import { Text } from '@renderer/components/dash-ui-kit-extended'
import CopyButton from '@renderer/components/ui/CopyButton'
import ListSkeleton from '@renderer/components/ui/Skeleton'
import NoResults from '@renderer/components/ui/NoResults'
import RetryButton from '@renderer/components/ui/RetryButton'
import PlatformUnlockTab from '@renderer/components/pages/addresses/PlatformUnlockTab'
import PlatformAddressSelect from '@renderer/components/pages/transfer/PlatformAddressSelect'
import ReceiveQr from './ReceiveQr'
import { useAuth } from '@renderer/contexts/AuthContext'
import { refreshPlatformAddresses, usePlatformAddresses } from '@renderer/hooks/usePlatformAddresses'
import { defaultReceivePlatformAddress, receivePlatformAddresses } from '@renderer/utils/receiveDefaults'
import { NoResultsTone } from '@renderer/enums/NoResultsTone'
import { receiveCardCopy } from '@renderer/constants'
import { SURFACE_SECTION } from '@renderer/constants/surfaces'
import { RECEIVE_EMPTY_TEXTS } from '@renderer/constants/receiveCard'
import { RECEIVE_INVOICE_ADDRESS_LABELS } from '@renderer/constants/receiveInvoice'

export default function PlatformReceiveCard({ walletId }: { walletId: string | undefined }): React.JSX.Element {
  const { platformAddresses, loading, err } = usePlatformAddresses(walletId)
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null)
  const { status } = useAuth()

  if (loading) {
    return <ListSkeleton rows={1} rowClassName="h-[2.5rem] rounded-[.875rem]" />
  }

  if (err) {
    return (
      <NoResults
        tone={NoResultsTone.Error}
        noResults={RECEIVE_EMPTY_TEXTS.platformLoadFailed}
        action={walletId !== undefined && <RetryButton onRetry={() => refreshPlatformAddresses(walletId)} />}
      />
    )
  }

  if (platformAddresses.length === 0) {
    return <PlatformUnlockTab walletId={walletId} />
  }

  const receiveAddresses = receivePlatformAddresses(platformAddresses)
  if (receiveAddresses.length === 0) {
    return <NoResults noResults={RECEIVE_EMPTY_TEXTS.noPlatformAddresses} />
  }

  const selected = receiveAddresses.find(a => a.platformAddress === selectedAddress)
    ?? defaultReceivePlatformAddress(receiveAddresses)!

  return (
    <div className={`flex w-min items-center gap-8 ${SURFACE_SECTION}`}>
      <ReceiveQr
        value={selected.platformAddress}
        invoice={{
          addressLabel: RECEIVE_INVOICE_ADDRESS_LABELS.platform,
          address: selected.platformAddress,
          amount: null,
          paymentLink: null,
          network: status?.network ?? null,
        }}
      />

      <div className={"flex flex-1 flex-col"}>
        <div className={"flex flex-col gap-[.5rem]"}>
          <Text size={12} weight={"medium"} color={"brand"} opacity={50}>
            Platform Address
          </Text>
          <div className={"flex items-center gap-[.625rem]"}>
            <PlatformAddressSelect
              addresses={receiveAddresses}
              selected={selected}
              onSelect={setSelectedAddress}
            />
            <CopyButton text={selected.platformAddress} />
          </div>
        </div>

        <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"mt-8"}>
          {receiveCardCopy.platformNote}
        </Text>
      </div>
    </div>
  )
}
