import { useEffect, useState } from 'react'
import { Tooltip } from '@renderer/components/dash-ui-kit-enxtended/tooltip'
import type { CoinControlAmountInputProps } from '@renderer/types/CoinControl'
import { creditsToDash, dashToCredits, formatCredits } from '@renderer/utils/balance'

export default function CoinControlAmountInput({id, credits, invalid, onChange}: CoinControlAmountInputProps): React.JSX.Element {
  const [value, setValue] = useState(() => creditsToDash(credits))

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
    <Tooltip label={`${formatCredits(credits)} credits`}>
      <input
        id={id}
        type={'text'}
        inputMode={'decimal'}
        value={value}
        onChange={event => handleChange(event.target.value)}
        aria-invalid={invalid}
        className={`pointer-events-auto col-start-1 row-start-2 min-w-0 w-full rounded-[.625rem] px-3 py-2 dash-input-block dash-text-default outline-none text-[.75rem] font-mono ${invalid ? 'ring-1 ring-dash-red' : ''}`}
      />
    </Tooltip>
  )
}
