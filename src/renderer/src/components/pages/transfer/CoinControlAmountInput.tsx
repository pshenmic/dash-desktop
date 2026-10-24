import { useEffect, useState } from 'react'
import AllocationAmountRow from '@renderer/components/ui/AllocationAmountRow'
import type { CoinControlAmountInputProps } from '@renderer/types/CoinControl'
import { creditsToDash, creditsToDuffs, dashToCredits, formatCredits } from '@renderer/utils/balance'
import { recipientPercent } from '@renderer/utils/sendRecipients'

export default function CoinControlAmountInput({id, credits, maxCredits, invalid, onChange}: CoinControlAmountInputProps): React.JSX.Element {
  const [value, setValue] = useState(() => creditsToDash(credits))
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
    <AllocationAmountRow
      id={id}
      value={value}
      onChange={handleChange}
      fiatDuffs={creditsToDuffs(credits)}
      amountTooltip={`${formatCredits(credits)} credits`}
      invalid={invalid}
      centered
      slider={{
        percent,
        onPercentChange: next => handleChange(creditsToDash(maxCredits * BigInt(next) / 100n)),
        disabled: maxCredits <= 0n,
        label: 'Dash from this input percentage',
        valueText: `${percent}% of available balance`,
        onMax: () => handleChange(creditsToDash(maxCredits)),
        maxDisabled: maxCredits <= 0n,
      }}
    />
  )
}
