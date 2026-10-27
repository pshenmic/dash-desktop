import { PlusIcon, Text } from '@renderer/components/dash-ui-kit-extended'
import { useAuth } from '@renderer/contexts/AuthContext'
import { DestinationKind } from '@renderer/enums/DestinationKind'
import { DESTINATION_PLACEHOLDERS, sendPageData } from '@renderer/constants/sendPages'
import { SEND_AMOUNT_PATTERN } from '@renderer/constants/sendRecipients'
import { ADDRESS_INPUT, ADDRESS_INPUT_TEXT_SIZES, FIELD_SUBTLE } from '@renderer/constants/addressField'
import { CHIP_ACTION, SURFACE_PANEL } from '@renderer/constants/surfaces'
import type { SendRecipientsEditorProps } from '@renderer/types/SendRecipients'
import { creditsToDuffs, dashToDuffs, davToDash, duffsToCredits } from '@renderer/utils/balance'
import { isValidDestinationAddress } from '@renderer/utils/destinationAddress'
import { capSendAmount, recipientPercent, recipientRemainingDuffs, recipientSliderAmount, recipientTotalDuffs } from '@renderer/utils/sendRecipients'
import AllocationAmountRow from '@renderer/components/ui/AllocationAmountRow'
import CreditsAmount from '@renderer/components/ui/CreditsAmount'
import DenominationChips from '@renderer/components/ui/DenominationChips'
import RecipientInput from './RecipientInput'
import FadingScrollArea from '@renderer/components/ui/FadingScrollArea'

export default function SendRecipientsEditor({
  recipients, errors, limit, destination, budgetDuffs, feeRecipientId, feeCredits, budgetIsEstimate, amountDenominations, headerAction, beforeRecipients, footer, onChange,
}: SendRecipientsEditorProps): React.JSX.Element {
  const {status} = useAuth()
  const network = status?.network ?? null
  const recipientData = {...sendPageData.recipient, placeholder: DESTINATION_PLACEHOLDERS[destination][network ?? 'testnet']}
  const update = (id: string, field: 'address' | 'amount', value: string): void => {
    onChange(recipients.map(recipient => recipient.id === id ? {...recipient, [field]: value} : recipient))
  }
  const addRecipient = (): void => {
    onChange([...recipients, {id: crypto.randomUUID(), address: '', amount: ''}])
  }

  return (
    <div className={`flex h-[calc(100dvh-16.125rem)] min-h-80 min-w-0 flex-col ${SURFACE_PANEL}`}>
      <div className="mb-6 flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div className="text-sm dash-text-default">
          <span className="opacity-50">Total: </span>
          {recipients.length} {recipients.length === 1 ? 'Recipient' : 'Recipients'} - {davToDash(recipientTotalDuffs(recipients))} Dash
        </div>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-6">
          {headerAction}
          {limit > 1 && (
            <button
              type="button"
              disabled={recipients.length >= limit}
              onClick={addRecipient}
              title={`${recipients.length} of ${limit} recipients`}
              className={`flex shrink-0 items-center gap-1.5 ${CHIP_ACTION} focus-visible:ring-2 focus-visible:ring-dash-brand/40 dark:focus-visible:ring-dash-mint/40 disabled:cursor-default disabled:opacity-50`}
            >
              <PlusIcon size={12} color="currentColor" />
              Add Recipient
            </button>
          )}
        </div>
      </div>
      {beforeRecipients && <div className="mb-2.5 shrink-0">{beforeRecipients}</div>}
      <FadingScrollArea className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto scrollbar-hide">
        {recipients.map((recipient, index) => {
          const amount = dashToDuffs(recipient.amount)
          const remaining = budgetDuffs == null ? null : recipientRemainingDuffs(recipients, recipient.id, budgetDuffs)
          const percent = recipientPercent(amount, budgetDuffs, true)
          const isFeeRecipient = feeRecipientId === recipient.id && feeCredits != null
          const receivedCredits = duffsToCredits(amount) - (feeCredits ?? 0n)
          const creatingIdentity = destination === DestinationKind.NewIdentity
          const addressError = !creatingIdentity && recipient.address.length > 0 && errors[index]?.address
          const amountError = recipient.amount.length > 0 && errors[index]?.amount
          let recipientLabel = `Recipient ${index + 1}`
          let inputLabel = `Recipient ${index + 1} address`
          if (destination === DestinationKind.Identity) {
            recipientLabel += ' identity ID'
            inputLabel = recipientLabel
          } else if (creatingIdentity) {
            inputLabel = `Recipient ${index + 1} new identity`
          }
          let allocationHint = 'Share of available funds'
          if (budgetIsEstimate) allocationHint += ' · Fee not included yet'
          else if (remaining != null) allocationHint += ` · Up to ${davToDash(remaining)} Dash for this recipient`

          const changeAmount = (value: string): void => {
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

          const recipientField = creatingIdentity
            ? (
              <div className={`flex items-center ${FIELD_SUBTLE}`}>
                <input aria-label={inputLabel} value="New identity" readOnly className={`${ADDRESS_INPUT} ${ADDRESS_INPUT_TEXT_SIZES[12]} opacity-50`} />
              </div>
            )
            : <RecipientInput compact appearance="subtle" ariaLabel={inputLabel} value={recipient.address} onChange={value => update(recipient.id, 'address', value)} validate={address => isValidDestinationAddress(destination, address, network)} invalid={!!addressError} valueAvatar={destination === DestinationKind.Identity} data={recipientData} />

          return (
            <section key={recipient.id} className="flex min-w-0 shrink-0 flex-col gap-3 rounded-[.875rem] dash-block px-3.5 py-3">
              <div className="flex items-center justify-between gap-3">
                <Text size={12} weight="medium" color="brand" opacity={50}>{recipientLabel}</Text>
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
              <div className="grid min-w-0 grid-cols-1 items-center gap-x-12 gap-y-3 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]!">
                <div className="min-w-0">
                  {recipientField}
                  {addressError && (
                    <Text size={12} weight="medium" color="red" className="mt-1 block px-1">{addressError}</Text>
                  )}
                </div>
                <div className="flex min-w-0 flex-col gap-1.5">
                  {amountDenominations != null && (
                    <DenominationChips
                      denominations={amountDenominations}
                      selected={duffsToCredits(amount)}
                      onSelect={denomination => update(recipient.id, 'amount', davToDash(creditsToDuffs(denomination)))}
                    />
                  )}
                  <AllocationAmountRow
                    value={recipient.amount}
                    onChange={changeAmount}
                    fiatDuffs={amount}
                    ariaLabel={`Recipient ${index + 1} amount`}
                    invalid={!!amountError}
                    disabled={budgetDuffs == null}
                    slider={amountDenominations == null ? {
                      percent,
                      onPercentChange: changePercent,
                      disabled: budgetDuffs == null || budgetDuffs <= 0n,
                      label: `Recipient ${index + 1} amount percentage`,
                      valueText: `${percent}% · ${allocationHint}`,
                      title: allocationHint,
                      onMax: useRemaining,
                      maxDisabled: remaining == null || budgetIsEstimate,
                      maxTitle: 'Use remaining',
                    } : undefined}
                  />
                  {budgetIsEstimate && <Text size={10} weight="medium" color="brand" opacity={50}>{allocationHint}</Text>}
                  {isFeeRecipient && (
                    <Text size={10} weight="medium" color="brand">
                      Estimated receives: <CreditsAmount credits={receivedCredits} exact /> (fee deducted)
                    </Text>
                  )}
                  {amountError && (
                    <Text size={12} weight="medium" color="red" className="px-1">{amountError}</Text>
                  )}
                </div>
              </div>
            </section>
          )
        })}
      </FadingScrollArea>
      {footer && <div className="mt-6 shrink-0">{footer}</div>}
    </div>
  )
}
