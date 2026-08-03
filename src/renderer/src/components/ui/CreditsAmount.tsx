import DashBigNumber from '@renderer/components/ui/DashBigNumber'
import { useFiat } from '@renderer/hooks/useFiat'
import { creditsToDuffs, formatCompactCredits, formatCredits, splitDashBalance } from '@renderer/utils/balance'

interface CreditsAmountProps {
  credits: bigint
  compact?: boolean
  unit?: string | null
  showFiat?: boolean
  align?: 'start' | 'end'
  amountClassName?: string
  unitClassName?: string
  className?: string
}

export default function CreditsAmount({
  credits,
  compact = false,
  unit = 'credits',
  showFiat = true,
  align = 'start',
  amountClassName,
  unitClassName,
  className,
}: CreditsAmountProps): React.JSX.Element {
  const { format: formatFiat, rateReady } = useFiat()
  const duffs = creditsToDuffs(credits)
  const dash = splitDashBalance(duffs)
  const fiat = showFiat && rateReady ? formatFiat(duffs) : null

  const face = 'col-start-1 row-start-1 whitespace-nowrap transition-[opacity,transform] duration-200 motion-reduce:transition-none'

  return (
    <span
      className={`group/credits inline-flex flex-col ${align === 'end' ? 'items-end' : 'items-start'} ${className ?? ''}`}
    >
      <span className={`relative inline-grid align-baseline ${align === 'end' ? 'justify-items-end' : 'justify-items-start'}`}>
        <span className={`${face} group-hover/credits:opacity-0 group-hover/credits:-translate-y-0.5`}>
          <DashBigNumber className={amountClassName}>{dash.main}</DashBigNumber>
          {dash.rest !== '' && <span className={`text-[.75em] ${amountClassName ?? ''}`}>{dash.rest}</span>}
          <span className={unitClassName}>{' Dash'}</span>
        </span>
        <span
          aria-hidden
          className={`${face} opacity-0 translate-y-0.5 group-hover/credits:opacity-100 group-hover/credits:translate-y-0`}
        >
          <span className={amountClassName}>{compact ? formatCompactCredits(credits) : formatCredits(credits)}</span>
          {unit && <span className={unitClassName}>{` ${unit}`}</span>}
        </span>
      </span>
      {fiat && (
        <span
          className={`whitespace-nowrap text-[.625rem] font-medium leading-[120%] text-dash-brand dark:text-dash-mint`}
        >
          ~ {fiat}
        </span>
      )}
    </span>
  )
}
