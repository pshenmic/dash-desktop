import { BigNumber } from 'dash-ui-kit/react'
import { Text } from '@renderer/components/dash-ui-kit-enxtended'
import { PlatformAddressDto } from '@renderer/api/types'
import { formatCompactCredits } from '@renderer/utils/balance'
import CopyButton from '@renderer/components/ui/CopyButton'

export default function PlatformAddressCard({
  platformAddress,
  balanceCredits,
  nonce,
}: PlatformAddressDto): React.JSX.Element {
  return (
    <div className={"flex items-center justify-between px-[.9375rem] py-[.625rem] rounded-[.875rem] dash-block"}>
      <div className={"flex flex-col gap-1 min-w-0"}>
        <div className={"flex items-center gap-[.3125rem]"}>
          <Text size={12} weight={"medium"} color={"brand"}>
            {platformAddress}
          </Text>
          <CopyButton text={platformAddress} />
        </div>
        <Text size={10} weight={"medium"} color={"default"} opacity={50}>
          Nonce: <span className={"font-bold"}>{nonce}</span>
        </Text>
      </div>

      <div className={"flex items-center gap-2 shrink-0"}>
        <Text size={14} weight={"medium"} color={"brand"}>
          <span className={"font-bold"}>
            <BigNumber>{formatCompactCredits(BigInt(balanceCredits)).toString()}</BigNumber>
          </span>
          {' Credits'}
        </Text>
      </div>
    </div>
  )
}
