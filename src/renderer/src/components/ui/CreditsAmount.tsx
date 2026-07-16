import { BigNumber } from 'dash-ui-kit/react'
import { useFiat } from '@renderer/hooks/useFiat'
import { creditsToDuffs, davToDash, davToDashCompact, formatCompactCredits } from '@renderer/utils/balance'

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
  const fiat = showFiat && rateReady ? formatFiat(duffs) : null

  const face = 'col-start-1 row-start-1 whitespace-nowrap transition-[opacity,transform] duration-200 motion-reduce:transition-none'

  return (
    <span
      className={`group/credits relative inline-grid align-baseline ${align === 'end' ? 'justify-items-end' : 'justify-items-start'} ${className ?? ''}`}
      title={`≈ ${davToDash(duffs)} Dash`}
    >
      <span className={`${face} group-hover/credits:opacity-0 group-hover/credits:-translate-y-0.5`}>
        <BigNumber className={amountClassName}>{compact ? formatCompactCredits(credits) : credits.toString()}</BigNumber>
        {unit && <span className={unitClassName}>{` ${unit}`}</span>}
      </span>
      <span
        aria-hidden
        className={`${face} opacity-0 translate-y-0.5 group-hover/credits:opacity-100 group-hover/credits:translate-y-0`}
      >
        <span className={amountClassName}>{davToDashCompact(duffs)}</span>
        <span className={unitClassName}>{' Dash'}</span>
      </span>
      {fiat && (
        <span
          aria-hidden
          className={`absolute top-full ${align === 'end' ? 'right-0' : 'left-0'} whitespace-nowrap text-[.625rem] font-medium leading-[120%] text-dash-brand dark:text-dash-mint opacity-0 transition-opacity duration-200 group-hover/credits:opacity-100 pointer-events-none`}
        >
          ~ {fiat}
        </span>
      )}
    </span>
  )
}
