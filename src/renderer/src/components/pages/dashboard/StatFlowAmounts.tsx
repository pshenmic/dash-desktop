import React from 'react'
import SensitiveValue from '@renderer/components/ui/SensitiveValue'
import { STAT_FLOW_LABELS } from '@renderer/constants/dashboardStats'
import { useFiat } from '@renderer/hooks/useFiat'
import type { StatFlowAmountsProps } from '@renderer/types/DashboardStats'
import { creditsToDash, creditsToDuffs } from '@renderer/utils/balance'
import { formatStatCredits } from '@renderer/utils/dashboardStatCharts'

export default function StatFlowAmounts({ flows, metric, hidden, platformFailed, showFiat = true }: StatFlowAmountsProps): React.JSX.Element {
  const { format, rateReady } = useFiat()

  return (
    <div className="stat-flow-amounts">
      {flows.map(flow => (
        <div key={flow.source} className={`stat-flow-amount stat-flow-${flow.source}`}>
          <span className="stat-flow-label"><i aria-hidden="true" />{STAT_FLOW_LABELS[flow.source]}</span>
          <div className="stat-flow-details">
            <div className="stat-flow-value" title={hidden ? undefined : `${creditsToDash(flow[metric])} DASH`}>
              <SensitiveValue hidden={hidden} size="compact" label={`${STAT_FLOW_LABELS[flow.source]} amount hidden`}>
                {formatStatCredits(flow[metric])} <small>DASH</small>
              </SensitiveValue>
            </div>
            {(showFiat || (flow.source === 'evo' && platformFailed)) && <div className="stat-sub">
              <SensitiveValue hidden={hidden} size="subtext" label="Statistic detail hidden">
                {flow.source === 'evo' && platformFailed ? 'Partial history' : rateReady ? `≈ ${format(creditsToDuffs(flow[metric]))}` : undefined}
              </SensitiveValue>
            </div>}
          </div>
        </div>
      ))}
    </div>
  )
}
