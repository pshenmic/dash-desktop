import { Text } from '@renderer/components/dash-ui-kit-enxtended'
import { useAuth } from '@renderer/contexts/AuthContext'
import { useFiat } from '@renderer/hooks/useFiat'
import { DestinationKind } from '@renderer/enums/DestinationKind'
import { DESTINATION_PLACEHOLDERS, sendPageData } from '@renderer/constants/sendPages'
import { SEND_AMOUNT_PATTERN } from '@renderer/constants/sendRecipients'
import type { SendRecipientsEditorProps } from '@renderer/types/SendRecipients'
import { dashToDuffs, davToDash, duffsToCredits } from '@renderer/utils/balance'
import { recipientPercent, recipientRemainingDuffs, recipientSliderAmount, splitRecipientTotal } from '@renderer/utils/sendRecipients'
import CreditsAmount from '@renderer/components/ui/CreditsAmount'
import AmountSlider from './AmountSlider'
import RecipientInput from './RecipientInput'

export default function SendRecipientsEditor({
  recipients, errors, limit, destination, budgetDuffs, feeRecipientId, feeCredits, budgetIsEstimate, onChange,
}: SendRecipientsEditorProps): React.JSX.Element {
  const {status} = useAuth()
  const {format, rateReady} = useFiat()
  const update = (id: string, field: 'address' | 'amount', value: string): void => {
    onChange(recipients.map(recipient => recipient.id === id ? {...recipient, [field]: value} : recipient))
  }
  return (
    <div className="flex flex-col gap-4 min-w-0">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Text size={16} weight="extrabold" color="brand">Recipients ({recipients.length}/{limit})</Text>
        {recipients.length > 1 && <button type="button" onClick={() => onChange(splitRecipientTotal(recipients))} className="text-sm dash-text-primary cursor-pointer">Split entered total equally</button>}
      </div>
      {recipients.map((recipient, index) => {
        const amount = dashToDuffs(recipient.amount)
        const remaining = budgetDuffs == null ? null : recipientRemainingDuffs(recipients, recipient.id, budgetDuffs)
        return (
          <section key={recipient.id} className="dash-block rounded-2xl p-4 flex flex-col gap-3 min-w-0">
            <div className="flex justify-between items-center gap-3">
              <Text size={12} weight="extrabold" color="brand">Recipient {index + 1}</Text>
              {recipients.length > 1 && <button type="button" aria-label={`Remove recipient ${index + 1}`} onClick={() => onChange(recipients.filter(row => row.id !== recipient.id))} className="text-xs dash-text-primary cursor-pointer">Remove</button>}
            </div>
            {destination === DestinationKind.CoreAddress ? (
              <RecipientInput value={recipient.address} onChange={value => update(recipient.id, 'address', value)} data={sendPageData.recipient} />
            ) : (
              <label className="flex flex-col gap-1">
                <Text size={12} weight="medium" color="brand" opacity={50}>Address</Text>
                <input aria-label={`Recipient ${index + 1} address`} value={recipient.address} onChange={event => update(recipient.id, 'address', event.target.value)} placeholder={DESTINATION_PLACEHOLDERS[destination][status?.network ?? 'testnet']} className="w-full min-w-0 rounded-xl border border-dash-primary-dark-blue/15 dark:border-white/15 p-3 bg-transparent font-mono text-sm dash-text-default" />
              </label>
            )}
            {recipient.address.length > 0 && errors[index]?.address && <Text size={12} weight="medium" color="red">{errors[index].address}</Text>}
            <div className="flex items-end gap-3">
              <label className="flex-1 min-w-0 flex flex-col gap-1">
                <Text size={12} weight="medium" color="brand" opacity={50}>Amount · DASH</Text>
                <input aria-label={`Recipient ${index + 1} amount`} inputMode="decimal" value={recipient.amount} onChange={event => { if (SEND_AMOUNT_PATTERN.test(event.target.value)) update(recipient.id, 'amount', event.target.value) }} placeholder="0" className="w-full rounded-xl border border-dash-primary-dark-blue/15 dark:border-white/15 p-3 bg-transparent text-xl dash-text-default" />
              </label>
              <button type="button" disabled={remaining == null || budgetIsEstimate} onClick={() => { if (remaining != null) update(recipient.id, 'amount', davToDash(remaining)) }} className="mb-1 px-3 py-2 rounded-xl dash-block-accent-10 text-xs dash-text-primary cursor-pointer disabled:opacity-40 disabled:cursor-default">Use remaining</button>
            </div>
            {rateReady && amount > 0n && <Text size={12} weight="medium" color="brand" opacity={50}>≈ {format(amount)}</Text>}
            <AmountSlider percent={recipientPercent(amount, budgetDuffs)} onPercentChange={percent => { if (budgetDuffs != null) update(recipient.id, 'amount', recipientSliderAmount(recipients, recipient.id, budgetDuffs, percent)) }} disabled={budgetDuffs == null || budgetDuffs <= 0n} label={`Recipient ${index + 1} amount percentage`} />
            <Text size={12} weight="medium" color="brand" opacity={50}>Share of available funds{budgetIsEstimate ? ' · Fee not included yet' : remaining != null ? ` · Up to ${davToDash(remaining)} Dash for this recipient` : ''}</Text>
            {feeRecipientId === recipient.id && feeCredits != null && <Text size={12} weight="medium" color="brand">Estimated receives: <CreditsAmount credits={duffsToCredits(amount) - feeCredits} exact /> (fee deducted)</Text>}
            {recipient.amount.length > 0 && errors[index]?.amount && <Text size={12} weight="medium" color="red">{errors[index].amount}</Text>}
          </section>
        )
      })}
      <button type="button" disabled={recipients.length >= limit} onClick={() => onChange([...recipients, {id: crypto.randomUUID(), address: '', amount: ''}])} className="self-start px-4 py-3 rounded-xl dash-block-accent-10 text-sm dash-text-primary cursor-pointer disabled:opacity-40 disabled:cursor-default">+ Add recipient</button>
    </div>
  )
}
