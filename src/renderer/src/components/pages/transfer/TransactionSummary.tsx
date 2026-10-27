import { useId, useState, type ReactNode } from 'react'
import { Button, ChevronIcon, Text } from '@renderer/components/dash-ui-kit-extended'
import Checkbox from '@renderer/components/ui/Checkbox'
import CreditsAmount from '@renderer/components/ui/CreditsAmount'
import DropdownField from '@renderer/components/ui/DropdownField'
import RetryButton from '@renderer/components/ui/RetryButton'
import Spinner from '@renderer/components/ui/Spinner'
import { CHIP_ACTION } from '@renderer/constants/surfaces'
import { TX_SUMMARY_CARD_LABELS } from '@renderer/constants/txSummary'
import { TransferOperation } from '@renderer/enums/TransferOperation'
import type { TransactionSummaryProps } from '@renderer/types/TransactionSummary'
import { davToDash, duffsToCredits } from '@renderer/utils/balance'

export default function TransactionSummary({
  children, operation, isCoreOperation, amountDuffs, maxAmountDuffs, fee, route,
  hasManualPlatformInputs, amountError, canSubmit, onRouteChange, onCoinControl, onRetryFee, onReview,
}: TransactionSummaryProps): React.JSX.Element {
  const [optionsOpen, setOptionsOpen] = useState(false)
  const feeOptionsId = useId()
  const supportsOutputFee = operation === TransferOperation.AddressFundsTransfer
  const feeOptionsOpen = supportsOutputFee && optionsOpen
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
      label: `Recipient ${index + 1}`,
      description: recipient.address.trim() || 'No address',
    })),
  ]
  const receiveLabel = subtractFee ? TX_SUMMARY_CARD_LABELS.recipientsReceiveEstimated : TX_SUMMARY_CARD_LABELS.recipientsReceive
  const setSubtractFee = (checked: boolean): void => {
    let feeRecipientId = route.feeRecipientId
    if (checked) feeRecipientId ??= route.recipients[0]?.id ?? null
    onRouteChange({subtractFee: checked, feeRecipientId})
  }

  let receiveDisplay: ReactNode = <CreditsAmount credits={receivedCredits} compact showFiat={false} exact />
  if (subtractFee && !fee.ready) receiveDisplay = '—'
  else if (isCoreOperation) receiveDisplay = <>{davToDash(amountDuffs)}<span className="font-normal"> Dash</span></>

  let feeDisplay = <Text size={12} weight="medium" color="brand" opacity={50}>—</Text>
  if (fee.loading) {
    feeDisplay = <Spinner size={14} className="text-dash-brand dark:text-dash-mint" />
  } else if (fee.ready) {
    const feeAmount = isCoreOperation
      ? <>{davToDash(fee.totalDuffs)}<span className="font-normal"> Dash</span></>
      : <CreditsAmount credits={fee.credits ?? 0n} compact showFiat={false} exact />
    feeDisplay = <Text size={12} weight="extrabold" color="brand">{feeAmount}</Text>
  }

  let debitDisplay: ReactNode = '—'
  if (fee.ready) {
    debitDisplay = isCoreOperation
      ? <>{davToDash(amountDuffs + fee.totalDuffs)}<span className="font-normal"> Dash</span></>
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
        <section className={`min-w-0 rounded-[.875rem] dash-block px-4 py-3 ${feeOptionsOpen ? 'self-start' : ''}`} aria-label="Source balance">{children}</section>
        <aside className="min-w-0 rounded-[.875rem] dash-block px-4 py-3 flex flex-wrap items-center justify-between gap-3" aria-label="Transaction summary">
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <Text size={14} weight="medium" color="brand">{TX_SUMMARY_CARD_LABELS.title}</Text>
              {supportsOutputFee && <button
                type="button"
                aria-expanded={feeOptionsOpen}
                aria-controls={feeOptionsOpen ? feeOptionsId : undefined}
                onClick={() => setOptionsOpen(value => !value)}
                className={`flex shrink-0 items-center gap-1.5 rounded-[.625rem] px-2 py-1 cursor-pointer text-[.625rem] font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-brand/40 dark:focus-visible:ring-dash-mint/40 ${feeOptionsOpen ? 'dash-block-accent-10 dash-text-primary' : 'dash-block-5 dash-text-default hover:bg-dash-brand/5 dark:hover:bg-dash-mint/5'}`}
              >
                Fee options
                <ChevronIcon size={12} color="currentColor" className={`shrink-0 opacity-50 transition-transform duration-200 ${feeOptionsOpen ? 'rotate-180' : ''}`} />
              </button>}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <div className="flex min-w-0 flex-col gap-1">
                <Text size={12} weight="medium" color="brand" opacity={50}>{receiveLabel}</Text>
                <Text size={12} weight="extrabold" color="brand">{receiveDisplay}</Text>
              </div>
              <div className="flex min-w-0 flex-col gap-1">
                <Text size={12} weight="medium" color="brand" opacity={50}>{TX_SUMMARY_CARD_LABELS.networkFee}</Text>
                {feeDisplay}
              </div>
            </div>
          </div>
          <span className="flex min-w-0 flex-col gap-1 rounded-[.625rem] dash-block-accent-5 px-4 py-2 text-xs dash-text-primary">
            <span>{TX_SUMMARY_CARD_LABELS.sendTotal}</span><span className="text-sm font-bold">{debitDisplay}</span>
          </span>
          {feeOptionsOpen && <div id={feeOptionsId} className="flex w-full min-w-0 basis-full flex-col gap-3 border-t border-dash-primary-dark-blue/12 dark:border-white/12 pt-4">
            {supportsOutputFee && (
              <div className="flex flex-col gap-3">
                <Checkbox
                  appearance="subtle"
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
                    <div className="flex flex-wrap items-center gap-2">
                      <Text size={12} weight="medium" color="brand" opacity={50}>Select inputs to deduct the fee from an output.</Text>
                      <button type="button" onClick={onCoinControl} className={`${CHIP_ACTION} font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-brand/40 dark:focus-visible:ring-dash-mint/40`}>
                        Open Coin Control
                      </button>
                    </div>
                  )}
                  <Text size={12} weight="medium" color="brand" opacity={50}>The selected recipient receives less by the actual network fee.</Text>
                </>}
              </div>
            )}
            {availableDisplay != null && (
              <div className="flex justify-between gap-3">
                <Text size={12} weight="medium" color="brand" opacity={50}>Available to allocate</Text>
                <Text size={12} weight="medium" color="brand" className="text-right">{availableDisplay}</Text>
              </div>
            )}
          </div>}
        </aside>
      </div>
      {amountError && <Text size={12} weight="medium" color="red" className="px-1">{amountError}</Text>}
      {subtractFee && !feeRecipientSelected && <Text size={12} weight="medium" color="red" className="px-1">Choose the recipient paying the fee.</Text>}
      {fee.error && <RetryButton onRetry={onRetryFee} label={TX_SUMMARY_CARD_LABELS.retryFee} />}
      <Button type="button" onClick={onReview} disabled={!canSubmit} colorScheme="lightBlue-mint" size="md" className="w-full h-[3.625rem]! rounded-[.9375rem] text-base">{TX_SUMMARY_CARD_LABELS.review}</Button>
    </div>
  )
}
