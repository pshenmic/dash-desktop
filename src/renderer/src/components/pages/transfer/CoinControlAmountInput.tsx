import { useEffect, useState } from 'react'
import { DashLogo } from 'dash-ui-kit/react'
import { Tooltip } from '@renderer/components/dash-ui-kit-enxtended/tooltip'
import { useFiat } from '@renderer/hooks/useFiat'
import type { CoinControlAmountInputProps } from '@renderer/types/CoinControl'
import { creditsToDash, creditsToDuffs, dashToCredits, formatCredits } from '@renderer/utils/balance'
import { recipientPercent } from '@renderer/utils/sendRecipients'

export default function CoinControlAmountInput({id, credits, maxCredits, invalid, onChange}: CoinControlAmountInputProps): React.JSX.Element {
  const [value, setValue] = useState(() => creditsToDash(credits))
  const {format: formatFiat, rateReady} = useFiat()
  const percent = recipientPercent(credits, maxCredits, true)

  useEffect(() => {
    setValue(current => dashToCredits(current) === credits ? current : creditsToDash(credits))
  }, [credits])

  const handleChange = (nextValue: string): void => {
    const nextCredits = dashToCredits(nextValue)
    if (nextCredits === null) return
    setValue(nextValue)
    onChange(nextCredits)
  }

  return (
    <div className={'pointer-events-auto col-start-1 row-start-2 flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2'}>
      <div className={`flex min-w-32 flex-1 items-center gap-3 rounded-b-lg border-b px-2 py-1 ${invalid ? 'border-dash-red' : 'border-dash-primary-dark-blue/15 dark:border-white/15 focus-within:border-dash-brand dark:focus-within:border-dash-mint'}`}>
        <Tooltip label={`${formatCredits(credits)} credits`}>
          <input
            id={id}
            type={'text'}
            inputMode={'decimal'}
            value={value}
            onChange={event => handleChange(event.target.value)}
            aria-invalid={invalid}
            className={'min-w-0 w-full bg-transparent dash-text-default outline-none text-sm font-bold tabular-nums'}
          />
        </Tooltip>
        <DashLogo size={10} color={'currentColor'} containerClassName={'shrink-0 dash-text-default'} />
      </div>
      {rateReady && <span className={'rounded-b-lg border-b border-dash-primary-dark-blue/10 dark:border-white/10 px-2 py-1 text-[.625rem] tabular-nums dash-text-default opacity-50'}>{formatFiat(creditsToDuffs(credits))}</span>}
      <div className={'flex min-w-36 flex-1 items-center gap-4'}>
        <div className={'relative flex h-5 min-w-0 flex-1 items-center'}>
          <progress
            aria-hidden={'true'}
            value={percent}
            max={100}
            className={'pointer-events-none absolute h-0.5 w-full appearance-none border-0 [&::-webkit-progress-bar]:bg-dash-brand/20 dark:[&::-webkit-progress-bar]:bg-dash-mint/20 [&::-webkit-progress-value]:bg-dash-brand dark:[&::-webkit-progress-value]:bg-dash-mint'}
          />
          <input
            type={'range'}
            min={0}
            max={100}
            step={1}
            value={percent}
            disabled={maxCredits <= 0n}
            onChange={event => handleChange(creditsToDash(maxCredits * BigInt(event.target.value) / 100n))}
            aria-label={'Dash from this input percentage'}
            aria-valuetext={`${percent}% of available balance`}
            className={'relative h-5 w-full appearance-none bg-transparent cursor-pointer focus-visible:ring-2 focus-visible:ring-dash-brand/40 dark:focus-visible:ring-dash-mint/40 disabled:cursor-default disabled:opacity-40 [&::-webkit-slider-runnable-track]:h-0.5 [&::-webkit-slider-thumb]:-mt-1.25 [&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-dash-brand [&::-webkit-slider-thumb]:bg-white dark:[&::-webkit-slider-thumb]:border-dash-mint dark:[&::-webkit-slider-thumb]:bg-dash-primary-dark-blue'}
          />
        </div>
        <button
          type={'button'}
          onClick={() => handleChange(creditsToDash(maxCredits))}
          disabled={maxCredits <= 0n}
          className={'shrink-0 rounded-md dash-block-accent-10 px-2 py-1 text-[.625rem] font-medium dash-text-primary cursor-pointer hover:dash-block-accent-15 focus-visible:ring-2 focus-visible:ring-dash-brand/40 dark:focus-visible:ring-dash-mint/40 disabled:cursor-default disabled:opacity-40'}
        >
          Max
        </button>
      </div>
    </div>
  )
}
