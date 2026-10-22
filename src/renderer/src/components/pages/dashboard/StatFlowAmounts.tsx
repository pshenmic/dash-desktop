import React from 'react'
import { Text } from '@renderer/components/dash-ui-kit-enxtended'
import DashBigNumber from '@renderer/components/ui/DashBigNumber'
import SensitiveValue from '@renderer/components/ui/SensitiveValue'
import { DASH_UNIT } from '@renderer/constants/balance'
import { STAT_FLOW_LABELS, STAT_SOURCE_KIND } from '@renderer/constants/dashboardStats'
import { useFiat } from '@renderer/hooks/useFiat'
import type { StatFlowAmountsProps } from '@renderer/types/DashboardStats'
import { formatApproxFiat } from '@renderer/utils/approxFiat'
import { creditsToDash, creditsToDuffs } from '@renderer/utils/balance'
import { formatStatCredits } from '@renderer/utils/dashboardStatCharts'
import MetricRow from './MetricRow'
import SourceBadge from './SourceBadge'

export default function StatFlowAmounts({ flows, metric, hidden, showFiat = true }: StatFlowAmountsProps): React.JSX.Element {
  const { format, rateReady } = useFiat()

  return (
    <div className="flex flex-col gap-2">
      {flows.map(flow => (
        <MetricRow
          key={flow.source}
          lead={<SourceBadge kind={STAT_SOURCE_KIND[flow.source]} />}
          value={(
            <Text as="div" size={16} weight="bold" color="brand" className="min-w-0 leading-[140%] wrap-anywhere [&_.sensitive-value]:max-w-full">
              <span title={hidden ? undefined : `${creditsToDash(flow[metric])} ${DASH_UNIT}`}>
                <SensitiveValue hidden={hidden} size="compact" label={`${STAT_FLOW_LABELS[flow.source]} amount hidden`}>
                  <DashBigNumber>{formatStatCredits(flow[metric])}</DashBigNumber>
                  <span className="font-medium"> {DASH_UNIT}</span>
                </SensitiveValue>
              </span>
            </Text>
          )}
          aside={showFiat ? (
            <Text size={10} weight="medium" color="blue-mint" className="[&_.sensitive-value]:max-w-full">
              <SensitiveValue hidden={hidden} size="subtext" label="Statistic detail hidden">
                {rateReady ? formatApproxFiat(format(creditsToDuffs(flow[metric]))) : undefined}
              </SensitiveValue>
            </Text>
          ) : undefined}
        />
      ))}
    </div>
  )
}
