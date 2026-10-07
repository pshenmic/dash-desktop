import { useState, type ReactNode } from 'react'
import { Text } from '@renderer/components/dash-ui-kit-enxtended'
import Checkbox from '@renderer/components/ui/Checkbox'
import CreditsAmount from '@renderer/components/ui/CreditsAmount'
import DropdownField from '@renderer/components/ui/DropdownField'
import Spinner from '@renderer/components/ui/Spinner'
import { TransferOperation } from '@renderer/enums/TransferOperation'
import type { TransactionSummaryProps } from '@renderer/types/TransactionSummary'
import { davToDash, duffsToCredits } from '@renderer/utils/balance'

export default function TransactionSummary({
  children, operation, isCoreOperation, amountDuffs, maxAmountDuffs, fee, route,
  hasManualPlatformInputs, amountError, canSubmit, onRouteChange, onCoinControl, onRetryFee, onReview,
}: TransactionSummaryProps): React.JSX.Element {
  const [optionsOpen, setOptionsOpen] = useState(false)
  const supportsOutputFee = operation === TransferOperation.AddressFundsTransfer
  const subtractFee = supportsOutputFee && route.subtractFee
  const amountCredits = duffsToCredits(amountDuffs)
  const receivedCredits = amountCredits - (subtractFee ? fee.credits ?? 0n : 0n)
  const totalDebitCredits = amountCredits + (subtractFee ? 0n : fee.credits ?? 0n)
  const feeRecipientSelected = route.recipients.some(recipient => recipient.id === route.feeRecipientId)
  const feeRecipientValue = feeRecipientSelected ? route.feeRecipientId ?? '' : ''
  const feeRecipientOptions = [
    {value: '', label: 'Select recipient'},
    ...route.recipients.map((recipient, index) => ({
      value: recipient.id,
      label: `Recipient ${index + 1} · ${recipient.address.slice(0, 16) || 'No address'}`,
    })),
  ]
  const receiveLabel = subtractFee ? 'Estimated recipients receive' : 'Recipients receive'
  const setSubtractFee = (checked: boolean): void => {
    let feeRecipientId = route.feeRecipientId
    if (checked) feeRecipientId ??= route.recipients[0]?.id ?? null
    onRouteChange({subtractFee: checked, feeRecipientId})
  }

  let receiveDisplay: ReactNode = <CreditsAmount credits={receivedCredits} compact showFiat={false} exact />
  if (subtractFee && !fee.ready) receiveDisplay = '—'
  else if (isCoreOperation) receiveDisplay = `${davToDash(amountDuffs)} Dash`

  let feeDisplay = <Text size={12} weight="medium" color="brand" opacity={50}>—</Text>
  if (fee.loading) {
    feeDisplay = <Spinner size={14} className="text-dash-brand dark:text-dash-mint" />
  } else if (fee.ready) {
    const feeAmount = isCoreOperation
      ? `${davToDash(fee.totalDuffs)} Dash`
      : <CreditsAmount credits={fee.credits ?? 0n} compact showFiat={false} />
    feeDisplay = <Text size={12} weight="extrabold" color="brand">{feeAmount}</Text>
  }

  let debitDisplay: ReactNode = '—'
  if (fee.ready) {
    debitDisplay = isCoreOperation
      ? `${davToDash(amountDuffs + fee.totalDuffs)} Dash`
      : <CreditsAmount credits={totalDebitCredits} compact showFiat={false} exact />
  }
  let availableDisplay: string | null = null
  if (fee.ready && maxAmountDuffs != null) {
    const remaining = maxAmountDuffs > amountDuffs ? maxAmountDuffs - amountDuffs : 0n
    availableDisplay = `${davToDash(remaining)} Dash`
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.75fr)]!">
        <section className="min-w-0 rounded-2xl dash-block px-4 py-3" aria-label="Source balance">{children}</section>
        <aside className="min-w-0 rounded-2xl dash-block px-4 py-3 flex flex-wrap items-center justify-between gap-3" aria-label="Transaction summary">
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <Text size={14} weight="medium" color="brand">Transaction Summary</Text>
              <button type="button" aria-expanded={optionsOpen} onClick={() => setOptionsOpen(value => !value)} className="cursor-pointer text-[.625rem] dash-text-primary whitespace-nowrap">Fee options</button>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <div className="flex min-w-0 flex-col gap-1">
                <Text size={10} weight="medium" color="brand" opacity={50}>{receiveLabel}</Text>
                <Text size={12} weight="extrabold" color="brand">{receiveDisplay}</Text>
              </div>
              <div className="flex min-w-0 flex-col gap-1">
                <Text size={10} weight="medium" color="brand" opacity={50}>Network Fee</Text>
                {feeDisplay}
              </div>
            </div>
          </div>
          <span className="flex min-w-0 flex-col gap-1 rounded-2xl dash-block-accent-10 px-4 py-2 text-xs dash-text-primary">
            <span>Send Total:</span><span className="font-bold">{debitDisplay}</span>
          </span>
        </aside>
      </div>
      {optionsOpen && <div className="flex flex-col gap-3 rounded-2xl dash-block p-4">
        {supportsOutputFee && (
          <div className="flex flex-col gap-3">
            <Checkbox
              checked={subtractFee}
              onChange={setSubtractFee}
              label={<Text size={12} weight="medium" color="brand">Subtract fee from outputs</Text>}
            />
            {subtractFee && <>
              <div className="flex flex-col gap-1">
                <Text size={12} weight="medium" color="brand" opacity={50}>Take fee from</Text>
                <DropdownField
                  ariaLabel="Recipient paying the fee"
                  value={feeRecipientValue}
                  onChange={value => onRouteChange({feeRecipientId: value || null})}
                  options={feeRecipientOptions}
                  triggerClassName="dash-block rounded-[.875rem] px-4 py-3.5"
                />
              </div>
              {!hasManualPlatformInputs && (
                <button type="button" onClick={onCoinControl} className="text-left text-sm dash-text-primary cursor-pointer">
                  Select inputs in Coin Control to deduct the fee from an output.
                </button>
              )}
              <Text size={12} weight="medium" color="brand" opacity={50}>The selected recipient receives less by the actual network fee.</Text>
            </>}
          </div>
        )}
        {availableDisplay != null && (
          <div className="flex justify-between gap-3">
            <Text size={12} weight="medium" color="brand" opacity={50}>Available to allocate</Text>
            <Text size={12} weight="medium" color="brand">{availableDisplay}</Text>
          </div>
        )}
      </div>}
      {amountError && <Text size={12} weight="medium" color="red">{amountError}</Text>}
      {subtractFee && !feeRecipientSelected && <Text size={12} weight="medium" color="red">Choose the recipient paying the fee.</Text>}
      {fee.error && (
        <button type="button" onClick={onRetryFee} className="text-sm dash-text-primary cursor-pointer">Retry fee estimate</button>
      )}
      <button type="button" onClick={onReview} disabled={!canSubmit} className="min-h-14.5 w-full rounded-2xl dash-block-accent-15 text-base dash-text-primary cursor-pointer hover:dash-block-accent-25 disabled:opacity-40 disabled:cursor-default">Review Transaction</button>
    </div>
  )
}
