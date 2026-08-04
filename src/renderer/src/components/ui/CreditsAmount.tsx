import DashBigNumber from '@renderer/components/ui/DashBigNumber'
import { useFiat } from '@renderer/hooks/useFiat'
import { creditsToDuffs, davToDash, formatCompactCredits, formatCredits } from '@renderer/utils/balance'

interface CreditsAmountProps {
  credits: bigint
  compact?: boolean
  unit?: string | null
  showFiat?: boolean
  align?: 'start' | 'end' | 'center'
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
  const items = align === 'end' ? 'items-end' : align === 'center' ? 'items-center' : 'items-start'
  const justifyItems = align === 'end' ? 'justify-items-end' : align === 'center' ? 'justify-items-center' : 'justify-items-start'

  return (
    <span
      className={`group/credits inline-flex flex-col ${items} ${className ?? ''}`}
    >
      <span className={`relative inline-grid align-baseline ${justifyItems}`}>
        <span className={`${face} group-hover/credits:opacity-0 group-hover/credits:-translate-y-0.5`}>
          <DashBigNumber className={amountClassName}>{davToDash(duffs)}</DashBigNumber>
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
