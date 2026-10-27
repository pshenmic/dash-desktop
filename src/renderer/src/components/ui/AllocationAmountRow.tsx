import { DashLogo } from 'dash-ui-kit/react'
import { Tooltip } from '@renderer/components/dash-ui-kit-extended/tooltip'
import { ALLOCATION_EMPTY_VALUE, ALLOCATION_MAX_CHIP_CLASS, ALLOCATION_MAX_LABEL, ALLOCATION_UNDERLINE } from '@renderer/constants/allocationAmountRow'
import { useFiat } from '@renderer/hooks/useFiat'
import type { AllocationAmountRowProps } from '@renderer/types/AllocationAmountRow'
import { fiatFieldParts } from '@renderer/utils/fiatField'

export default function AllocationAmountRow({
  id, value, onChange, fiatDuffs, ariaLabel, amountTooltip, invalid = false, disabled = false, centered = false, slider,
}: AllocationAmountRowProps): React.JSX.Element {
  const {format, rateReady, currency} = useFiat()
  const fiat = fiatFieldParts(fiatDuffs > 0n ? format(fiatDuffs) : null, currency)
  const textAlign = centered ? 'text-center' : 'text-left'

  return (
    <div className="flex w-full min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
      <div className="flex min-w-48 flex-1 items-stretch gap-2.5">
        <label className={`${ALLOCATION_UNDERLINE} min-w-0 flex-1 ${invalid ? 'border-dash-red' : 'border-dash-primary-dark-blue/15 dark:border-white/15 focus-within:border-dash-brand dark:focus-within:border-dash-mint'}`}>
          <Tooltip label={amountTooltip}>
            <input
              id={id}
              type="text"
              inputMode="decimal"
              aria-label={ariaLabel}
              aria-invalid={invalid}
              value={value}
              onChange={event => onChange(event.target.value)}
              disabled={disabled}
              placeholder={ALLOCATION_EMPTY_VALUE}
              className={`w-full min-w-0 bg-transparent ${textAlign} text-sm font-bold tabular-nums dash-text-default outline-none placeholder:opacity-30 disabled:cursor-default`}
            />
          </Tooltip>
          <DashLogo size={10} color="currentColor" containerClassName="shrink-0 dash-text-default" />
        </label>
        {rateReady && (
          <span className={`${ALLOCATION_UNDERLINE} min-w-[4.75rem] shrink-0 border-dash-primary-dark-blue/10 dark:border-white/10`}>
            <span className={`flex-1 ${textAlign} text-[.625rem] tabular-nums dash-text-default opacity-50`}>{fiat.value}</span>
            <span className="shrink-0 text-[.625rem] font-bold dash-text-default">{fiat.symbol}</span>
          </span>
        )}
      </div>
      {slider && (
        <div className="flex min-w-36 flex-1 items-center gap-4" title={slider.title}>
          <div className="relative flex h-5 min-w-0 flex-1 items-center">
            <progress
              aria-hidden="true"
              value={slider.percent}
              max={100}
              className="pointer-events-none absolute h-0.5 w-full appearance-none border-0 [&::-webkit-progress-bar]:bg-dash-brand/20 dark:[&::-webkit-progress-bar]:bg-dash-mint/20 [&::-webkit-progress-value]:bg-dash-brand dark:[&::-webkit-progress-value]:bg-dash-mint"
            />
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={slider.percent}
              onChange={event => slider.onPercentChange(Number(event.target.value))}
              disabled={slider.disabled}
              aria-label={slider.label}
              aria-valuetext={slider.valueText}
              className="relative h-5 w-full appearance-none bg-transparent cursor-pointer focus-visible:ring-2 focus-visible:ring-dash-brand/40 dark:focus-visible:ring-dash-mint/40 disabled:cursor-default disabled:opacity-50 [&::-webkit-slider-runnable-track]:h-0.5 [&::-webkit-slider-thumb]:-mt-1.25 [&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-dash-brand [&::-webkit-slider-thumb]:bg-white dark:[&::-webkit-slider-thumb]:border-dash-mint dark:[&::-webkit-slider-thumb]:bg-dash-primary-dark-blue"
            />
          </div>
          <button type="button" onClick={slider.onMax} disabled={slider.maxDisabled} title={slider.maxTitle} className={ALLOCATION_MAX_CHIP_CLASS}>
            {ALLOCATION_MAX_LABEL}
          </button>
        </div>
      )}
    </div>
  )
}
