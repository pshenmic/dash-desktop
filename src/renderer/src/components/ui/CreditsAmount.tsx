import DashBigNumber from '@renderer/components/ui/DashBigNumber'
import { useFiat } from '@renderer/hooks/useFiat'
import type { CreditsAmountProps } from '@renderer/types/Amount'
import { creditsToDash, creditsToDuffs, davToDash, formatCompactCredits, formatCredits } from '@renderer/utils/balance'

export default function CreditsAmount({
  credits,
  compact = false,
  exact = false,
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
  let items = 'items-start'
  let justifyItems = 'justify-items-start'
  if (align === 'end') {
    items = 'items-end'
    justifyItems = 'justify-items-end'
  } else if (align === 'center') {
    items = 'items-center'
    justifyItems = 'justify-items-center'
  }

  return (
    <span
      className={`group/credits inline-flex flex-col ${items} ${className ?? ''}`}
    >
      <span className={`relative inline-grid align-baseline ${justifyItems}`}>
        <span className={`${face} group-hover/credits:opacity-0 group-hover/credits:-translate-y-0.5`}>
          <DashBigNumber className={amountClassName}>{exact ? creditsToDash(credits) : davToDash(duffs)}</DashBigNumber>
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
