import { DashLogo } from 'dash-ui-kit/react'
import { PlusIcon, Text } from '@renderer/components/dash-ui-kit-enxtended'
import { useAuth } from '@renderer/contexts/AuthContext'
import { useFiat } from '@renderer/hooks/useFiat'
import { DestinationKind } from '@renderer/enums/DestinationKind'
import { DESTINATION_PLACEHOLDERS, sendPageData } from '@renderer/constants/sendPages'
import { SEND_AMOUNT_PATTERN } from '@renderer/constants/sendRecipients'
import type { SendRecipientsEditorProps } from '@renderer/types/SendRecipients'
import { dashToDuffs, davToDash, duffsToCredits } from '@renderer/utils/balance'
import { capSendAmount, recipientPercent, recipientRemainingDuffs, recipientSliderAmount, recipientTotalDuffs, splitRecipientTotal } from '@renderer/utils/sendRecipients'
import CreditsAmount from '@renderer/components/ui/CreditsAmount'
import RecipientInput from './RecipientInput'

export default function SendRecipientsEditor({
  recipients, errors, limit, destination, budgetDuffs, feeRecipientId, feeCredits, budgetIsEstimate, headerAction, beforeRecipients, footer, onChange,
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
    <div className="flex h-[calc(100dvh-16.5rem)] min-h-80 min-w-0 flex-col rounded-3xl border border-dash-primary-dark-blue/12 dash-card-base p-3.5 dark:border-white/12">
      <div className="mb-6 flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div className="text-sm dash-text-default">
          <span className="opacity-50">Total: </span>
          {recipients.length} {recipients.length === 1 ? 'Recipient' : 'Recipients'} - {davToDash(recipientTotalDuffs(recipients))} Dash
        </div>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-4">
          {recipients.length > 1 && (
            <button type="button" onClick={() => onChange(splitRecipientTotal(recipients))} className="cursor-pointer text-[.625rem] dash-text-primary hover:opacity-70 focus-visible:ring-2 focus-visible:ring-dash-brand/40 dark:focus-visible:ring-dash-mint/40">
              Split equally
            </button>
          )}
          {headerAction}
          <button
            type="button"
            disabled={recipients.length >= limit}
            onClick={addRecipient}
            title={`${recipients.length} of ${limit} recipients`}
            className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg dash-block-accent-10 px-2 py-1 text-xs dash-text-primary hover:dash-block-accent-15 focus-visible:ring-2 focus-visible:ring-dash-brand/40 dark:focus-visible:ring-dash-mint/40 disabled:cursor-default disabled:opacity-40"
          >
            <PlusIcon size={12} color="currentColor" />
            Add Recipient
          </button>
        </div>
      </div>
      {beforeRecipients && <div className="mb-2 shrink-0">{beforeRecipients}</div>}
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto scrollbar-hide">
        {recipients.map((recipient, index) => {
          const amount = dashToDuffs(recipient.amount)
          const remaining = budgetDuffs == null ? null : recipientRemainingDuffs(recipients, recipient.id, budgetDuffs)
          const percent = recipientPercent(amount, budgetDuffs, true)
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
            <section key={recipient.id} className="flex min-w-0 shrink-0 flex-col gap-3 rounded-2xl dash-block px-3.5 py-3">
              <div className="flex items-center justify-between gap-3">
                <Text size={12} weight="medium" color="brand" opacity={50}>Recipient {index + 1}</Text>
                {recipients.length > 1 && (
                  <button
                    type="button"
                    aria-label={`Remove recipient ${index + 1}`}
                    onClick={() => onChange(recipients.filter(row => row.id !== recipient.id))}
                    className="cursor-pointer text-xs dash-text-primary hover:opacity-70 focus-visible:ring-2 focus-visible:ring-dash-brand/40 dark:focus-visible:ring-dash-mint/40"
                  >
                    Remove
                  </button>
                )}
              </div>
              <div className="grid min-w-0 grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]!">
                <div className="min-w-0">
                  {destination === DestinationKind.CoreAddress ? (
                    <RecipientInput compact ariaLabel={`Recipient ${index + 1} address`} value={recipient.address} onChange={value => update(recipient.id, 'address', value)} data={sendPageData.recipient} />
                  ) : (
                    <label className="flex min-w-0 flex-col gap-2">
                      <span className={`rounded-[.875rem] dash-block-5 px-3 py-3 ${addressError ? 'outline outline-1 outline-dash-red' : ''}`}>
                        <input
                          aria-label={`Recipient ${index + 1} address`}
                          value={recipient.address}
                          onChange={event => update(recipient.id, 'address', event.target.value)}
                          placeholder={DESTINATION_PLACEHOLDERS[destination][status?.network ?? 'testnet']}
                          aria-invalid={!!addressError}
                          className="w-full min-w-0 bg-transparent outline-none text-xs dash-text-default placeholder:opacity-30"
                        />
                      </span>
                    </label>
                  )}
                  {addressError && (
                    <Text size={10} weight="medium" color="red" className="mt-1 block">{addressError}</Text>
                  )}
                </div>
                <div className="flex min-w-0 flex-col gap-1.5">
                  <div className="flex min-w-0 items-center gap-3">
                    <label className={`flex min-w-0 flex-1 items-center gap-2 rounded-b-lg border-b px-2 py-1 ${recipient.amount.length > 0 && errors[index]?.amount ? 'border-dash-red' : 'border-dash-primary-dark-blue/15 dark:border-white/15 focus-within:border-dash-brand dark:focus-within:border-dash-mint'}`}>
                      <input
                        type="text"
                        inputMode="decimal"
                        aria-label={`Recipient ${index + 1} amount`}
                        aria-invalid={recipient.amount.length > 0 && !!errors[index]?.amount}
                        value={recipient.amount}
                        onChange={changeAmount}
                        disabled={budgetDuffs == null}
                        placeholder="0"
                        className="w-full min-w-0 bg-transparent text-sm font-bold tabular-nums dash-text-default outline-none placeholder:opacity-30 disabled:cursor-default"
                      />
                      <DashLogo size={10} color="currentColor" containerClassName="shrink-0 dash-text-default" />
                    </label>
                    {fiatAmount != null && <span className="shrink-0 rounded-b-lg border-b border-dash-primary-dark-blue/10 px-2 py-1 text-[.625rem] tabular-nums dash-text-default opacity-50 dark:border-white/10">{fiatAmount}</span>}
                  </div>
                  <div className="flex items-center gap-4" title={allocationHint}>
                    <div className="relative flex h-5 min-w-0 flex-1 items-center">
                      <progress
                        aria-hidden="true"
                        value={percent}
                        max={100}
                        className="pointer-events-none absolute h-0.5 w-full appearance-none border-0 [&::-webkit-progress-bar]:bg-dash-brand/20 dark:[&::-webkit-progress-bar]:bg-dash-mint/20 [&::-webkit-progress-value]:bg-dash-brand dark:[&::-webkit-progress-value]:bg-dash-mint"
                      />
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={1}
                        value={percent}
                        onChange={event => changePercent(Number(event.target.value))}
                        disabled={budgetDuffs == null || budgetDuffs <= 0n}
                        aria-label={`Recipient ${index + 1} amount percentage`}
                        aria-valuetext={`${percent}% · ${allocationHint}`}
                        className="relative h-5 w-full appearance-none bg-transparent cursor-pointer focus-visible:ring-2 focus-visible:ring-dash-brand/40 dark:focus-visible:ring-dash-mint/40 disabled:cursor-default disabled:opacity-40 [&::-webkit-slider-runnable-track]:h-0.5 [&::-webkit-slider-thumb]:-mt-1.25 [&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-dash-brand [&::-webkit-slider-thumb]:bg-white dark:[&::-webkit-slider-thumb]:border-dash-mint dark:[&::-webkit-slider-thumb]:bg-dash-primary-dark-blue"
                      />
                    </div>
                    <button type="button" onClick={useRemaining} disabled={remaining == null || budgetIsEstimate} title="Use remaining" className="shrink-0 rounded-md dash-block-accent-10 px-2 py-1 text-[.625rem] font-medium dash-text-primary cursor-pointer hover:dash-block-accent-15 focus-visible:ring-2 focus-visible:ring-dash-brand/40 dark:focus-visible:ring-dash-mint/40 disabled:cursor-default disabled:opacity-40">Max</button>
                  </div>
                  {budgetIsEstimate && <Text size={10} weight="medium" color="brand" opacity={40}>{allocationHint}</Text>}
                  {isFeeRecipient && (
                    <Text size={10} weight="medium" color="brand">
                      Estimated receives: <CreditsAmount credits={receivedCredits} exact /> (fee deducted)
                    </Text>
                  )}
                  {recipient.amount.length > 0 && errors[index]?.amount && (
                    <Text size={10} weight="medium" color="red">{errors[index].amount}</Text>
                  )}
                </div>
              </div>
            </section>
          )
        })}
      </div>
      {footer && <div className="mt-6 shrink-0">{footer}</div>}
    </div>
  )
}
