import React from 'react'
import SensitiveValue from '@renderer/components/ui/SensitiveValue'
import { DASH_UNIT } from '@renderer/constants/balance'
import { STAT_FLOW_LABELS, STAT_SOURCE_CLASSES } from '@renderer/constants/dashboardStats'
import { useFiat } from '@renderer/hooks/useFiat'
import type { StatFlowAmountsProps } from '@renderer/types/DashboardStats'
import { formatApproxFiat } from '@renderer/utils/approxFiat'
import { creditsToDash, creditsToDuffs } from '@renderer/utils/balance'
import { formatStatCredits } from '@renderer/utils/dashboardStatCharts'

export default function StatFlowAmounts({ flows, metric, hidden, showFiat = true }: StatFlowAmountsProps): React.JSX.Element {
  const { format, rateReady } = useFiat()
  const compact = metric === 'largestReceived'

  return (
    <div className={compact ? 'grid grid-cols-2 gap-3' : 'flex flex-col gap-[7px]'}>
      {flows.map(flow => (
        <div key={flow.source} className={`${STAT_SOURCE_CLASSES[flow.source]} ${compact ? 'flex flex-col-reverse items-start justify-end gap-[3px]' : 'grid grid-cols-[36px_minmax(0,1fr)] items-baseline gap-1.5'}`}>
          <span className={`text-(--stat-muted) ${compact ? 'text-xs leading-4' : 'text-[10px]'}`}><i className="mr-1 inline-block size-[5px] rounded-full bg-(--stat-series)" aria-hidden="true" />{STAT_FLOW_LABELS[flow.source]}</span>
          <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
            <div className={`font-bold tabular-nums wrap-anywhere [&_.sensitive-value]:max-w-full ${compact ? 'text-lg leading-[22px]' : 'text-base leading-[21px]'}`} title={hidden ? undefined : `${creditsToDash(flow[metric])} ${DASH_UNIT}`}>
              <SensitiveValue hidden={hidden} size="compact" label={`${STAT_FLOW_LABELS[flow.source]} amount hidden`}>
                {formatStatCredits(flow[metric])} <small className="text-[10px] font-medium whitespace-nowrap text-(--stat-muted)">{DASH_UNIT}</small>
              </SensitiveValue>
            </div>
            {showFiat && <div className="text-[10px] leading-3 text-(--stat-muted) [&_.sensitive-value]:max-w-full">
              <SensitiveValue hidden={hidden} size="subtext" label="Statistic detail hidden">
                {rateReady ? formatApproxFiat(format(creditsToDuffs(flow[metric]))) : undefined}
              </SensitiveValue>
            </div>}
          </div>
        </div>
      ))}
    </div>
  )
}
