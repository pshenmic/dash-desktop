import React from 'react'
import SensitiveValue from '@renderer/components/ui/SensitiveValue'
import { STAT_FLOW_LABELS } from '@renderer/constants/dashboardStats'
import { useFiat } from '@renderer/hooks/useFiat'
import type { StatFlowAmountsProps } from '@renderer/types/DashboardStats'
import { creditsToDash, creditsToDuffs } from '@renderer/utils/balance'
import { formatStatCredits } from '@renderer/utils/dashboardStatCharts'

export default function StatFlowAmounts({ flows, direction, hidden, platformFailed }: StatFlowAmountsProps): React.JSX.Element {
  const { format, rateReady } = useFiat()

  return (
    <div className="stat-flow-amounts">
      {flows.map(flow => (
        <div key={flow.source} className={`stat-flow-amount stat-flow-${flow.source}`}>
          <span className="stat-flow-label"><i aria-hidden="true" />{STAT_FLOW_LABELS[flow.source]}</span>
          <div>
            <div className="stat-flow-value" title={hidden ? undefined : `${creditsToDash(flow[direction])} DASH`}>
              <SensitiveValue hidden={hidden} size="compact" label={`${STAT_FLOW_LABELS[flow.source]} amount hidden`}>
                {formatStatCredits(flow[direction])} <small>DASH</small>
              </SensitiveValue>
            </div>
            <div className="stat-sub">
              <SensitiveValue hidden={hidden} size="subtext" label="Statistic detail hidden">
                {flow.source === 'evo' && platformFailed ? 'Partial history' : rateReady ? `≈ ${format(creditsToDuffs(flow[direction]))}` : undefined}
              </SensitiveValue>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
