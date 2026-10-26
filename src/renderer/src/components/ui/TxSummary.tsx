import { useState } from 'react'
import { ShieldSmallIcon, Text } from '@renderer/components/dash-ui-kit-enxtended'
import CreditsAmount from '@renderer/components/ui/CreditsAmount'
import DashBigNumber from '@renderer/components/ui/DashBigNumber'
import { TxEndpointKind } from '@renderer/enums/TxEndpointKind'
import { DASH_UNIT } from '@renderer/constants/balance'
import { CHIP_ACTION, SURFACE_SECTION } from '@renderer/constants/surfaces'
import { TX_SUMMARY_LABELS, TX_SUMMARY_PENDING_VALUE, TX_SUMMARY_ROW_CLASS, TX_SUMMARY_VISIBLE_RECIPIENTS } from '@renderer/constants/txSummary'
import { useFiat } from '@renderer/hooks/useFiat'
import { formatApproxFiat } from '@renderer/utils/approxFiat'
import { davToDash } from '@renderer/utils/balance'
import { moreRecipientsLabel, splitVisibleRecipients, txAmountToDuffs } from '@renderer/utils/txSummary'
import type { TxAmountProps, TxEndpointProps, TxLineProps, TxSummaryProps } from '@renderer/types/TxSummary'

function TxAmount({ amount, unit, hero = false }: TxAmountProps): React.JSX.Element {
  const unitClassName = hero ? 'text-sm font-medium' : undefined
  if (unit === 'credits') {
    return <CreditsAmount credits={amount} exact showFiat={false} align={"end"} unitClassName={unitClassName} />
  }
  return (
    <span className={"whitespace-nowrap"}>
      <DashBigNumber>{davToDash(amount)}</DashBigNumber>
      <span className={unitClassName}>{` ${DASH_UNIT}`}</span>
    </span>
  )
}

function TxEndpoint({ endpoint, unit, showAmount }: TxEndpointProps): React.JSX.Element {
  const amountShown = showAmount && endpoint.amount !== undefined
  return (
    <div className={"flex flex-col items-end gap-0.5 min-w-0"}>
      <div className={"flex items-start justify-end gap-1.5 min-w-0"}>
        {endpoint.kind === TxEndpointKind.Shielded && (
          <ShieldSmallIcon size={14} className={"shrink-0 mt-0.5 text-dash-brand dark:text-dash-mint"} />
        )}
        <Text
          size={endpoint.kind === TxEndpointKind.Label ? 14 : 12}
          weight={"medium"}
          color={"brand"}
          className={endpoint.kind === TxEndpointKind.Label ? 'text-right' : 'font-mono break-all select-all text-right'}
        >
          {endpoint.value}
        </Text>
      </div>
      {(amountShown || endpoint.paysFee) && (
        <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"text-right"}>
          {amountShown && endpoint.amount !== undefined && <TxAmount amount={endpoint.amount} unit={unit} />}
          {endpoint.paysFee && ` · ${TX_SUMMARY_LABELS.paysFee}`}
        </Text>
      )}
    </div>
  )
}

function TxLine({ line }: TxLineProps): React.JSX.Element {
  return (
    <div className={TX_SUMMARY_ROW_CLASS}>
      <Text size={14} weight={"medium"} color={"brand"} opacity={50}>{line.label}</Text>
      <Text size={14} weight={"medium"} color={"brand"} className={"text-right"}>
        {line.amount === null ? TX_SUMMARY_PENDING_VALUE : <TxAmount amount={line.amount} unit={line.unit} />}
      </Text>
    </div>
  )
}

export default function TxSummary({
  unit,
  amount,
  amountLabel = TX_SUMMARY_LABELS.amount,
  from,
  to,
  toLabel = TX_SUMMARY_LABELS.to,
  fees = [],
  total,
  details = [],
  className = '',
}: TxSummaryProps): React.JSX.Element {
  const { format, rateReady } = useFiat()
  const [allRecipients, setAllRecipients] = useState(false)
  const { visible, hidden } = splitVisibleRecipients(to, allRecipients ? to.length : TX_SUMMARY_VISIBLE_RECIPIENTS)
  const fiat = rateReady && total != null ? format(txAmountToDuffs(total, unit)) : null

  return (
    <div className={`flex flex-col gap-3 ${SURFACE_SECTION} ${className}`}>
      {amount !== undefined && (
        <div className={TX_SUMMARY_ROW_CLASS}>
          <Text size={14} weight={"medium"} color={"brand"} opacity={50}>{amountLabel}</Text>
          <Text size={24} weight={"extrabold"} color={"brand"} className={"text-right break-words"}>
            <TxAmount amount={amount} unit={unit} hero />
          </Text>
        </div>
      )}
      {from && (
        <div className={TX_SUMMARY_ROW_CLASS}>
          <Text size={14} weight={"medium"} color={"brand"} opacity={50}>{TX_SUMMARY_LABELS.from}</Text>
          <TxEndpoint endpoint={from} unit={unit} showAmount={false} />
        </div>
      )}
      {to.length > 0 && (
        <div className={TX_SUMMARY_ROW_CLASS}>
          <Text size={14} weight={"medium"} color={"brand"} opacity={50}>{toLabel}</Text>
          <div className={"flex flex-col items-end gap-2 min-w-0"}>
            {visible.map((endpoint, index) => (
              <TxEndpoint key={`${endpoint.value}-${index}`} endpoint={endpoint} unit={unit} showAmount={to.length > 1} />
            ))}
            {hidden > 0 && (
              <button type={"button"} onClick={() => setAllRecipients(true)} className={CHIP_ACTION}>{moreRecipientsLabel(hidden)}</button>
            )}
          </div>
        </div>
      )}
      {fees.map(line => <TxLine key={line.label} line={line} />)}
      {total !== undefined && (
        <>
          <div className={"h-px bg-dash-primary-dark-blue/10 dark:bg-white/10"} />
          <div className={TX_SUMMARY_ROW_CLASS}>
            <Text size={14} weight={"medium"} color={"brand"} opacity={50}>{TX_SUMMARY_LABELS.total}</Text>
            <div className={"flex flex-col items-end gap-1"}>
              <Text size={16} weight={"extrabold"} color={"brand"} className={"text-right"}>
                {total === null ? TX_SUMMARY_PENDING_VALUE : <TxAmount amount={total} unit={unit} />}
              </Text>
              {fiat && <Text size={12} weight={"medium"} color={"blue-mint"}>{formatApproxFiat(fiat)}</Text>}
            </div>
          </div>
        </>
      )}
      {details.map(line => <TxLine key={line.label} line={line} />)}
    </div>
  )
}
