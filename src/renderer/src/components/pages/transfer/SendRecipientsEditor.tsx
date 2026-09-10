import { Text } from '@renderer/components/dash-ui-kit-enxtended'
import { useAuth } from '@renderer/contexts/AuthContext'
import { useFiat } from '@renderer/hooks/useFiat'
import { DestinationKind } from '@renderer/enums/DestinationKind'
import { DESTINATION_PLACEHOLDERS, sendPageData } from '@renderer/constants/sendPages'
import { SEND_AMOUNT_PATTERN } from '@renderer/constants/sendRecipients'
import type { SendRecipientsEditorProps } from '@renderer/types/SendRecipients'
import { dashToDuffs, davToDash, duffsToCredits } from '@renderer/utils/balance'
import { capSendAmount, recipientPercent, recipientRemainingDuffs, recipientSliderAmount, splitRecipientTotal } from '@renderer/utils/sendRecipients'
import CreditsAmount from '@renderer/components/ui/CreditsAmount'
import AmountField from './AmountField'
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
  const addRecipient = (): void => {
    onChange([...recipients, {id: crypto.randomUUID(), address: '', amount: ''}])
  }

  return (
    <div className="flex flex-col gap-4 min-w-0">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Text size={16} weight="extrabold" color="brand">Recipients ({recipients.length}/{limit})</Text>
        {recipients.length > 1 && (
          <button type="button" onClick={() => onChange(splitRecipientTotal(recipients))} className="text-sm dash-text-primary cursor-pointer">
            Split entered total equally
          </button>
        )}
      </div>
      {recipients.map((recipient, index) => {
        const amount = dashToDuffs(recipient.amount)
        const remaining = budgetDuffs == null ? null : recipientRemainingDuffs(recipients, recipient.id, budgetDuffs)
        const percent = recipientPercent(amount, budgetDuffs)
        const fiatAmount = rateReady && amount > 0n ? format(amount) : null
        const isFeeRecipient = feeRecipientId === recipient.id && feeCredits != null
        const receivedCredits = duffsToCredits(amount) - (feeCredits ?? 0n)
        const addressError = recipient.address.length > 0 && errors[index]?.address
        let allocationHint = 'Share of available funds'
        if (budgetIsEstimate) allocationHint += ' · Fee not included yet'
        else if (remaining != null) allocationHint += ` · Up to ${davToDash(remaining)} Dash for this recipient`

        const changeAmount = (event: React.ChangeEvent<HTMLInputElement>): void => {
          const value = event.target.value
          if (SEND_AMOUNT_PATTERN.test(value)) {
            update(recipient.id, 'amount', remaining == null || budgetIsEstimate ? value : capSendAmount(value, remaining))
          }
        }
        const useRemaining = (): void => {
          if (remaining != null) update(recipient.id, 'amount', davToDash(remaining))
        }
        const changePercent = (percent: number): void => {
          if (budgetDuffs == null) return
          update(recipient.id, 'amount', recipientSliderAmount(recipients, recipient.id, budgetDuffs, percent))
        }

        return (
          <section key={recipient.id} className="dash-block rounded-2xl p-4 flex flex-col gap-3 min-w-0">
            <div className="flex justify-between items-center gap-3">
              <Text size={12} weight="extrabold" color="brand">Recipient {index + 1}</Text>
              {recipients.length > 1 && (
                <button
                  type="button"
                  aria-label={`Remove recipient ${index + 1}`}
                  onClick={() => onChange(recipients.filter(row => row.id !== recipient.id))}
                  className="text-xs dash-text-primary cursor-pointer"
                >
                  Remove
                </button>
              )}
            </div>
            {destination === DestinationKind.CoreAddress ? (
              <RecipientInput value={recipient.address} onChange={value => update(recipient.id, 'address', value)} data={sendPageData.recipient} />
            ) : (
              <label className="flex flex-col gap-2">
                <Text size={12} weight="medium" color="brand" opacity={50}>Address</Text>
                <span className={`dash-input-block rounded-[.875rem] px-4 py-3.5 ${addressError ? 'outline outline-1 outline-dash-red' : ''}`}>
                  <input
                    aria-label={`Recipient ${index + 1} address`}
                    value={recipient.address}
                    onChange={event => update(recipient.id, 'address', event.target.value)}
                    placeholder={DESTINATION_PLACEHOLDERS[destination][status?.network ?? 'testnet']}
                    className="w-full min-w-0 bg-transparent outline-none text-[.875rem] font-mono dash-text-default placeholder:opacity-30"
                  />
                </span>
              </label>
            )}
            {addressError && (
              <Text size={12} weight="medium" color="red">{addressError}</Text>
            )}
            <AmountField
              ariaLabel={`Recipient ${index + 1} amount`}
              value={recipient.amount}
              disabled={budgetDuffs == null}
              onChange={changeAmount}
              onMax={useRemaining}
              maxLabel="Use remaining"
              maxDisabled={remaining == null || budgetIsEstimate}
              unit={<Text size={12} weight="medium" color="brand">DASH</Text>}
            />
            {fiatAmount != null && <Text size={12} weight="medium" color="brand" opacity={50}>≈ {fiatAmount}</Text>}
            <AmountSlider
              percent={percent}
              onPercentChange={changePercent}
              disabled={budgetDuffs == null || budgetDuffs <= 0n}
              label={`Recipient ${index + 1} amount percentage`}
            />
            <Text size={12} weight="medium" color="brand" opacity={50}>{allocationHint}</Text>
            {isFeeRecipient && (
              <Text size={12} weight="medium" color="brand">
                Estimated receives: <CreditsAmount credits={receivedCredits} exact /> (fee deducted)
              </Text>
            )}
            {recipient.amount.length > 0 && errors[index]?.amount && (
              <Text size={12} weight="medium" color="red">{errors[index].amount}</Text>
            )}
          </section>
        )
      })}
      <button
        type="button"
        disabled={recipients.length >= limit}
        onClick={addRecipient}
        className="self-start px-4 py-3 rounded-xl dash-block-accent-10 text-sm dash-text-primary cursor-pointer disabled:opacity-40 disabled:cursor-default"
      >
        + Add recipient
      </button>
    </div>
  )
}
