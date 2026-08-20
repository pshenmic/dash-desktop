import { useState } from 'react'
import QRCode from 'react-qr-code'
import { useTheme } from 'dash-ui-kit/react'
import { Text } from '@renderer/components/dash-ui-kit-enxtended'
import CopyButton from '@renderer/components/ui/CopyButton'
import ListSkeleton from '@renderer/components/ui/Skeleton'
import PlatformUnlockTab from '@renderer/components/pages/addresses/PlatformUnlockTab'
import PlatformAddressSelect from '@renderer/components/pages/transfer/PlatformAddressSelect'
import { usePlatformAddresses } from '@renderer/hooks/usePlatformAddresses'
import { defaultReceivePlatformAddress, receivePlatformAddresses } from '@renderer/utils/receiveDefaults'

export default function PlatformReceiveCard({ walletId }: { walletId: string | undefined }): React.JSX.Element {
  const { platformAddresses, loading, err } = usePlatformAddresses(walletId)
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null)
  const { theme } = useTheme()

  if (loading) {
    return <ListSkeleton rows={1} rowClassName="h-[2.5rem] rounded-[.875rem]" />
  }

  if (err) {
    return <Text size={12} weight={"medium"} color={"red"}>Failed to load platform addresses</Text>
  }

  if (platformAddresses.length === 0) {
    return <PlatformUnlockTab walletId={walletId} />
  }

  const receiveAddresses = receivePlatformAddresses(platformAddresses)
  if (receiveAddresses.length === 0) {
    return <Text size={12} weight={"medium"} color={"brand"} opacity={50}>No unused Platform addresses available.</Text>
  }

  const selected = receiveAddresses.find(a => a.platformAddress === selectedAddress)
    ?? defaultReceivePlatformAddress(receiveAddresses)!
  const qrCodeColor = theme === 'dark' ? 'white' : 'var(--color-dash-brand)'

  return (
    <div className={"flex w-full min-w-260 items-center gap-8 rounded-4xl dash-block p-6"}>
      <QRCode
        value={selected.platformAddress}
        size={225}
        fgColor={qrCodeColor}
        bgColor={"transparent"}
        className={"rounded-[.5625rem] shrink-0"}
      />

      <div className={"flex flex-1 flex-col"}>
        <div className={"flex flex-col gap-[.5rem]"}>
          <Text size={12} weight={"normal"} color={"brand"} opacity={50}>
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
          Share this address to receive credits on Dash Platform. Balances are account-based, so it is safe to reuse this address.
        </Text>
      </div>
    </div>
  )
}
