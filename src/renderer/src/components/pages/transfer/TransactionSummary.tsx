import type { ReactNode } from 'react'
import { Button, Text } from '@renderer/components/dash-ui-kit-enxtended'
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

  let receiveDisplay: ReactNode = <CreditsAmount credits={receivedCredits} align="end" exact />
  if (subtractFee && !fee.ready) receiveDisplay = '—'
  else if (isCoreOperation) receiveDisplay = `${davToDash(amountDuffs)} Dash`

  let feeDisplay = <Text size={12} weight="medium" color="brand" opacity={50}>—</Text>
  if (fee.loading) {
    feeDisplay = <Spinner size={14} className="text-dash-brand dark:text-dash-mint" />
  } else if (fee.ready) {
    const feeAmount = isCoreOperation
      ? `${davToDash(fee.totalDuffs)} Dash`
      : <CreditsAmount credits={fee.credits ?? 0n} align="end" />
    feeDisplay = <Text size={12} weight="medium" color="brand">{feeAmount}</Text>
  }

  let debitDisplay: ReactNode = '—'
  if (fee.ready) {
    debitDisplay = isCoreOperation
      ? `${davToDash(amountDuffs + fee.totalDuffs)} Dash`
      : <CreditsAmount credits={totalDebitCredits} align="end" exact />
  }
  let availableDisplay: string | null = null
  if (fee.ready && maxAmountDuffs != null) {
    const remaining = maxAmountDuffs > amountDuffs ? maxAmountDuffs - amountDuffs : 0n
    availableDisplay = `${davToDash(remaining)} Dash`
  }

  return (
    <aside className="xl:sticky xl:top-0 dash-block rounded-2xl p-5 flex flex-col gap-4 min-w-0" aria-label="Transaction summary">
      <Text size={16} weight="extrabold" color="brand">Transaction summary</Text>
      {children}
      <div className="flex justify-between gap-3 items-start">
        <Text size={12} weight="medium" color="brand" opacity={50}>{receiveLabel}</Text>
        <Text size={14} weight="medium" color="brand" className="text-right">{receiveDisplay}</Text>
      </div>
      <div className="flex justify-between gap-3 items-center">
        <Text size={12} weight="medium" color="brand" opacity={50}>Network fee</Text>
        {feeDisplay}
      </div>
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
      <div className="border-t border-dash-primary-dark-blue/10 dark:border-white/10 pt-3 flex justify-between gap-3 items-start">
        <Text size={12} weight="medium" color="brand" opacity={50}>Total debit</Text>
        <Text size={16} weight="extrabold" color="brand" className="text-right">{debitDisplay}</Text>
      </div>
      {availableDisplay != null && (
        <div className="flex justify-between gap-3">
          <Text size={12} weight="medium" color="brand" opacity={50}>Available to allocate</Text>
          <Text size={12} weight="medium" color="brand">{availableDisplay}</Text>
        </div>
      )}
      {amountError && <Text size={12} weight="medium" color="red">{amountError}</Text>}
      {subtractFee && !feeRecipientSelected && <Text size={12} weight="medium" color="red">Choose the recipient paying the fee.</Text>}
      {fee.error && (
        <button type="button" onClick={onRetryFee} className="text-sm dash-text-primary cursor-pointer">Retry fee estimate</button>
      )}
      <Button type="button" onClick={onReview} disabled={!canSubmit} size="md" className="w-full rounded-xl">Review transaction</Button>
    </aside>
  )
}
