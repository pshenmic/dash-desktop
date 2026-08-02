import { Text, ExternalLinkIcon } from '@renderer/components/dash-ui-kit-enxtended'
import { PlatformAddressDto } from '@renderer/api/types'
import { useAuth } from '@renderer/contexts/AuthContext'
import { platformAddressUrl, openExternal } from '@renderer/utils/explorer'
import CopyButton from '@renderer/components/ui/CopyButton'
import CreditsAmount from '@renderer/components/ui/CreditsAmount'

export default function PlatformAddressCard({
  platformAddress,
  balanceCredits,
  nonce,
}: PlatformAddressDto): React.JSX.Element {
  const { status: appStatus } = useAuth()
  const network = appStatus?.network ?? null

  return (
    <div className={"flex items-center justify-between px-[.9375rem] py-[.625rem] rounded-[.875rem] dash-block"}>
      <div className={"flex flex-col gap-1 min-w-0"}>
        <div className={"flex items-center gap-[.3125rem]"}>
          <Text size={12} weight={"medium"} color={"brand"}>
            {platformAddress}
          </Text>
          <CopyButton text={platformAddress} />
          {network && (
            <button
              onClick={() => openExternal(platformAddressUrl(platformAddress, network))}
              title={"Open in explorer"}
              className={"size-5 rounded-[.3125rem] flex items-center justify-center dash-block-5 hover:opacity-80 transition-opacity duration-200 cursor-pointer"}
            >
              <ExternalLinkIcon size={10} color={"currentColor"} className={"dash-text-default opacity-50"} />
            </button>
          )}
        </div>
        <Text size={10} weight={"medium"} color={"default"} opacity={50}>
          Tx count: <span className={"font-bold"}>{nonce}</span>
        </Text>
      </div>

      <div className={"flex items-center gap-2 shrink-0"}>
        <Text size={14} weight={"medium"} color={"brand"}>
          <CreditsAmount credits={BigInt(balanceCredits)} compact unit={"Credits"} align={"end"} amountClassName={"font-bold"} />
        </Text>
      </div>
    </div>
  )
}
