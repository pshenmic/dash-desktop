import { BigNumber } from 'dash-ui-kit/react'
import { Text } from '@renderer/components/dash-ui-kit-enxtended'
import { utxosPage } from '@renderer/constants'
import { davToDashCompact } from '@renderer/utils/balance'

type DashAmountProps = {
  duffs: bigint
  className?: string
}

export default function DashAmount({ duffs, className }: DashAmountProps): React.JSX.Element {
  return (
    <Text size={14} weight={"medium"} color={"brand"} className={className}>
      <span className={"font-bold"}>
        <BigNumber>{davToDashCompact(duffs)}</BigNumber>
      </span>
      {` ${utxosPage.unit}`}
    </Text>
  )
}
