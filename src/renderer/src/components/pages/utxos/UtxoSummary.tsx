import { useMemo } from 'react'
import { Text } from '@renderer/components/dash-ui-kit-enxtended'
import CustomBadge from '@renderer/components/ui/CustomBadge'
import DashAmount from './DashAmount'
import { WalletUtxoDto } from '@renderer/api/types'
import { utxosPage } from '@renderer/constants'
import { totalDuffs } from '@renderer/utils/utxo'
import { useFiat } from '@renderer/hooks/useFiat'

type UtxoSummaryProps = {
  utxos: WalletUtxoDto[]
  selectedCount: number
  selectedDuffs: bigint
}

function SummaryToken({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className={"flex flex-1 items-center justify-between p-3 rounded-xl dash-block"}>
      <Text size={12} weight={"medium"} color={"brand"} opacity={50}>
        {label}
      </Text>
      <div className={"flex items-center gap-2"}>{children}</div>
    </div>
  )
}

export default function UtxoSummary({ utxos, selectedCount, selectedDuffs }: UtxoSummaryProps): React.JSX.Element {
  const { summary } = utxosPage
  const { format: formatFiat, rateReady } = useFiat()
  const total = useMemo(() => totalDuffs(utxos), [utxos])

  return (
    <div className={"flex gap-3"}>
      <SummaryToken label={summary.balance}>
        <DashAmount duffs={total} />
        {rateReady && <CustomBadge text={`~ ${formatFiat(total)}`} variant={"default"} size={"xs"} />}
      </SummaryToken>
      <SummaryToken label={summary.utxoCount}>
        <Text size={14} weight={"bold"} color={"brand"}>
          {utxos.length}
        </Text>
      </SummaryToken>
      <SummaryToken label={summary.selected}>
        <div className={"flex items-center"}>
          <Text size={14} weight={"bold"} color={"brand"}>
            {selectedCount}
          </Text>
          <Text size={14} weight={"medium"} color={"brand"}>
            {summary.selectedSeparator}
          </Text>
          <DashAmount duffs={selectedDuffs} />
        </div>
      </SummaryToken>
    </div>
  )
}
