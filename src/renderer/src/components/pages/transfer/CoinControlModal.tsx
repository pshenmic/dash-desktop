import { useEffect, useState } from 'react'
import { useConnectionModeContext } from '@renderer/contexts/ConnectionModeContext'
import { Button, HighlightedIdentifier, Text } from '@renderer/components/dash-ui-kit-enxtended'
import { RefreshIcon } from '@renderer/components/dash-ui-kit-enxtended/icons'
import AddressQrModal from '@renderer/components/modal/AddressQrModal'
import { useFiat } from '@renderer/hooks/useFiat'
import Checkbox from '@renderer/components/ui/Checkbox'
import CheckRow from '@renderer/components/ui/CheckRow'
import CopyButton from '@renderer/components/ui/CopyButton'
import QrButton from '@renderer/components/ui/QrButton'
import FadingScrollArea from '@renderer/components/ui/FadingScrollArea'
import CreditsAmount from '@renderer/components/ui/CreditsAmount'
import PageHeader from '@renderer/components/ui/PageHeader'
import Spinner from '@renderer/components/ui/Spinner'
import CoinControlAmountInput from './CoinControlAmountInput'
import CoinControlAutomaticIllustration from './CoinControlAutomaticIllustration'
import type { PlatformAddressDto } from '@renderer/api/types'
import { ADDRESS_ROW_IDENTIFIER_CLASS } from '@renderer/constants/addressRow'
import { COIN_CONTROL_FIAT_CLASS, COIN_CONTROL_LABELS, FIXED_IDENTITY_SOURCE_COPY, FIXED_SOURCE_COPY } from '@renderer/constants/coinControl'
import { CORE_DUST_FILTER_DUFFS } from '@renderer/constants/core'
import { PAGE_HEADERS } from '@renderer/constants/pageHeaders'
import { PLATFORM_DUST_FILTER_CREDITS, PLATFORM_INPUT_LIMIT } from '@renderer/constants/platform'
import { SHIELDED_DUST_FILTER_CREDITS, SHIELDED_NOTE_LIMIT } from '@renderer/constants/shielded'
import { CHIP_ACTION, SURFACE_PANEL, SURFACE_SECTION } from '@renderer/constants/surfaces'
import { SourceKind } from '@renderer/enums/SourceKind'
import { TransferOperation } from '@renderer/enums/TransferOperation'
import { CoinControlMode } from '@renderer/enums/CoinControlMode'
import type {
  CoinControlInputDetailsProps,
  CoinControlEmptyProps,
  CoinControlModalProps,
  CoinControlSelection,
} from '@renderer/types/CoinControl'
import { formatApproxFiat } from '@renderer/utils/approxFiat'
import {
  automaticCoinControl,
  buildCoinControlInventory,
  coinControlInputLabel,
  coinControlSelectionTotals,
  coinControlSourceKind,
  expandAddressCoinControlSelection,
  isCoinControlSelectionValid,
  normalizeCoinControlSelection,
  outpointKey,
} from '@renderer/utils/coinControl'
import { coinControlSourceAddresses, dustFilterKeepKeys, hideUnselectedDust, steppedFeePayer } from '@renderer/utils/coinControlView'
import { creditsToDuffs, davToDash, duffsToCredits } from '@renderer/utils/balance'
import { formatTimestamp } from '@renderer/utils/date'

export default function CoinControlModal({
  isOpen,
  feeFromOutput = false,
  operation,
  selection,
  coreAddresses,
  coreAddressesLoading,
  coreAddressesError,
  onRetryCoreAddresses,
  utxos,
  utxosLoading,
  utxosLocalSnapshot,
  utxosError,
  coreSyncIncomplete,
  platformAddresses,
  platformAddressesLoading,
  platformAddressesError,
  onRetryPlatformAddresses,
  shieldedNotes,
  identityLabel,
  identityId,
  onRetryUtxos,
  onClose,
  onApply,
}: CoinControlModalProps): React.JSX.Element | null {
  const {showSyncWarning} = useConnectionModeContext()
  const {format: formatFiat, rateReady} = useFiat()
  const [draftSelection, setDraft] = useState<CoinControlSelection>(selection)
  const [filterDust, setFilterDust] = useState(true)
  const [qrAddress, setQrAddress] = useState<string | null>(null)
  const [touchedKeys, setTouchedKeys] = useState<string[]>([])

  useEffect(() => {
    if (!isOpen) return
    setDraft(selection)
    setFilterDust(true)
    setQrAddress(null)
    setTouchedKeys([])
  }, [isOpen, selection])

  useEffect(() => {
    if (!isOpen) return
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      if (qrAddress != null) setQrAddress(null)
      else onClose()
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [isOpen, onClose, qrAddress])

  if (!isOpen || operation == null) return null

  const sourceKind = coinControlSourceKind(operation)
  const funds = {coreAddresses, utxos, platformAddresses, shieldedNotes}
  const draft = expandAddressCoinControlSelection(draftSelection, funds, operation)
  const selectedOutpoints = draft.kind === 'coreOutpoints' ? draft.outpoints : []
  const selectedPlatformInputs = draft.kind === 'platformInputs' ? draft.inputs : []
  const selectedNoteIndexes = draft.kind === 'shieldedNotes' ? draft.noteIndexes : []
  const dustKeepKeys = dustFilterKeepKeys([draft, expandAddressCoinControlSelection(selection, funds, operation)], touchedKeys)
  const visibleUtxos = hideUnselectedDust(
    utxos,
    filterDust,
    utxo => utxo.satoshis < CORE_DUST_FILTER_DUFFS,
    utxo => dustKeepKeys.has(outpointKey(utxo)),
  )
  const visiblePlatformAddresses = hideUnselectedDust(
    platformAddresses,
    filterDust,
    address => address.balanceCredits < PLATFORM_DUST_FILTER_CREDITS,
    address => dustKeepKeys.has(address.platformAddress),
  )
  const visibleShieldedNotes = hideUnselectedDust(
    shieldedNotes,
    filterDust,
    note => note.amount < SHIELDED_DUST_FILTER_CREDITS,
    note => dustKeepKeys.has(String(note.index)),
  )
  const {count: selectedCount, duffs: selectedAmountDuffs, credits: selectedAmountCredits} = coinControlSelectionTotals(draft, funds)
  const isCoreSend = operation === TransferOperation.CoreSend
  const selectedItemLabel = coinControlInputLabel(sourceKind, selectedCount)
  const canApply = normalizeCoinControlSelection(draft, operation) === draft
    && isCoinControlSelectionValid(draft, buildCoinControlInventory(funds))
  const choosesFeePayer = !feeFromOutput && operation !== TransferOperation.Shield
  const feePayerGroup = choosesFeePayer && selectedPlatformInputs.length > 0
  const currentFeeAddress = draft.kind === 'platformInputs' ? draft.feeAddress : ''
  const feePayerAddresses = visiblePlatformAddresses
    .filter(entry => selectedPlatformInputs.some(input => input.address === entry.platformAddress))
    .map(entry => entry.platformAddress)
  const feePayerTabStop = feePayerAddresses.includes(currentFeeAddress) ? currentFeeAddress : feePayerAddresses[0]

  const chooseMode = (nextMode: CoinControlMode): void => {
    if (nextMode === CoinControlMode.Automatic) {
      setDraft(automaticCoinControl())
      return
    }

    switch (sourceKind) {
      case SourceKind.Core:
        setDraft({kind: 'coreOutpoints', outpoints: []})
        break
      case SourceKind.PlatformAddress:
        setDraft({kind: 'platformInputs', inputs: [], feeAddress: ''})
        break
      case SourceKind.Shielded:
        setDraft({kind: 'shieldedNotes', noteIndexes: []})
        break
    }
  }

  const mode = draft.kind === 'automatic' ? CoinControlMode.Automatic : CoinControlMode.Inputs

  const modeButton = (value: CoinControlMode, label: string): React.JSX.Element => (
    <button
      type={'button'}
      onClick={() => chooseMode(value)}
      aria-pressed={mode === value}
      className={`relative -mb-px border-b pb-2.5 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-dash-brand/40 dark:focus-visible:ring-dash-mint/40 transition-opacity ${mode === value ? 'border-dash-brand dark:border-dash-mint' : 'border-transparent opacity-35 hover:opacity-60'}`}
    >
      <Text size={24} weight={'medium'} color={'brand'} className={'tracking-[-0.03em]'}>{label}</Text>
    </button>
  )

  let sourceLoading = false
  let sourceError: string | null = null
  let retrySource = onRetryUtxos
  if (sourceKind === SourceKind.Core) {
    sourceLoading = utxosLoading || (coreSyncIncomplete && !utxosLocalSnapshot)
    sourceError = utxosError
    if (mode !== CoinControlMode.Inputs) {
      sourceLoading = coreAddressesLoading
      sourceError = coreAddressesError
      retrySource = onRetryCoreAddresses
    }
  } else if (sourceKind === SourceKind.PlatformAddress) {
    sourceLoading = platformAddressesLoading
    sourceError = platformAddressesError
    retrySource = onRetryPlatformAddresses
  }
  const sourceReady = !sourceLoading && sourceError == null
  const hasCoreInputs = sourceKind === SourceKind.Core && mode === CoinControlMode.Inputs && utxos.length > 0
  const refreshingCoreInputs = hasCoreInputs && sourceLoading
  const waitingForCoreSync = coreSyncIncomplete && !utxosLocalSnapshot && sourceKind === SourceKind.Core
  const showSourceSpinner = sourceLoading && (!waitingForCoreSync || showSyncWarning)

  const fixed = sourceKind == null
  const fixedCopy = FIXED_SOURCE_COPY[operation] ?? FIXED_IDENTITY_SOURCE_COPY
  let fixedValue = identityId ?? identityLabel ?? 'No identity selected'
  if (operation === TransferOperation.IdentityCreateFromShielded) {
    fixedValue = 'The wallet selects notes for this operation.'
  }

  const keepVisible = (key: string): void => {
    if (!touchedKeys.includes(key)) setTouchedKeys([...touchedKeys, key])
  }

  const toggleCoreOutpoint = (key: string, checked: boolean): void => {
    keepVisible(key)
    if (checked) {
      setDraft({kind: 'coreOutpoints', outpoints: [...selectedOutpoints, key]})
    } else {
      const nextOutpoints = selectedOutpoints.filter(value => value !== key)
      setDraft({kind: 'coreOutpoints', outpoints: nextOutpoints})
    }
  }

  const togglePlatformInput = (entry: PlatformAddressDto, checked: boolean): void => {
    if (checked && selectedPlatformInputs.length >= PLATFORM_INPUT_LIMIT) return
    keepVisible(entry.platformAddress)
    if (checked) {
      const inputs = [...selectedPlatformInputs, {address: entry.platformAddress, credits: entry.balanceCredits}]
      const feeAddress = draft.kind === 'platformInputs' && draft.feeAddress
        ? draft.feeAddress
        : entry.platformAddress
      setDraft({kind: 'platformInputs', inputs, feeAddress})
      return
    }

    const inputs = selectedPlatformInputs.filter(input => input.address !== entry.platformAddress)
    let feeAddress = inputs[0]?.address ?? ''
    if (draft.kind === 'platformInputs' && draft.feeAddress !== entry.platformAddress) {
      feeAddress = draft.feeAddress
    }
    setDraft({kind: 'platformInputs', inputs, feeAddress})
  }

  const setPlatformInputCredits = (address: string, credits: bigint): void => {
    let feeAddress = address
    if (draft.kind === 'platformInputs') feeAddress = draft.feeAddress
    setDraft({
      kind: 'platformInputs',
      inputs: selectedPlatformInputs.map(input => input.address === address ? {...input, credits} : input),
      feeAddress,
    })
  }

  const toggleShieldedNote = (index: number, checked: boolean): void => {
    if (checked && selectedNoteIndexes.length >= SHIELDED_NOTE_LIMIT) return
    keepVisible(String(index))
    if (checked) {
      setDraft({kind: 'shieldedNotes', noteIndexes: [...selectedNoteIndexes, index]})
    } else {
      const nextNoteIndexes = selectedNoteIndexes.filter(noteIndex => noteIndex !== index)
      setDraft({kind: 'shieldedNotes', noteIndexes: nextNoteIndexes})
    }
  }

  const stepFeePayer = (event: React.KeyboardEvent<HTMLButtonElement>, address: string): void => {
    const next = steppedFeePayer(feePayerAddresses, address, event.key)
    if (next == null) return
    event.preventDefault()
    setDraft({kind: 'platformInputs', inputs: selectedPlatformInputs, feeAddress: next})
    document.getElementById(`coin-control-fee-${next}`)?.focus()
  }

  const apply = (): void => {
    if (fixed) {
      onClose()
      return
    }
    if (!canApply || !sourceReady) return
    onApply(operation === TransferOperation.Shield && draftSelection.kind === 'platformInputs' ? draftSelection : draft)
    onClose()
  }

  return (
    <section className={'flex flex-col min-w-0 px-12 pb-4'} aria-labelledby={'coin-control-title'} inert={qrAddress != null}>
      <PageHeader
        id={'coin-control-title'}
        title={PAGE_HEADERS.coinControl.title}
        subtitle={PAGE_HEADERS.coinControl.subtitle}
        onBack={onClose}
        backLabel={PAGE_HEADERS.coinControl.back}
      />

      <div className={`flex flex-col min-w-0 h-[calc(100dvh-17rem)] min-h-96 ${SURFACE_PANEL}`}>
          {!fixed && <div className={'flex gap-6 shrink-0 border-b border-dash-primary-dark-blue/12 dark:border-white/12'}>
            {modeButton(CoinControlMode.Automatic, 'Automatic')}
            {modeButton(CoinControlMode.Inputs, 'Manual')}
            {showSourceSpinner && <span role="status" aria-label="Loading available funds" className="ml-auto flex items-center self-center pb-2.5"><Spinner size={16} className="dash-text-primary" /></span>}
            {!sourceLoading && sourceError && <button type="button" onClick={retrySource} aria-label="Retry loading funds" title="Retry loading funds" className="ml-auto mb-2.5 self-center flex size-5 items-center justify-center rounded-[.3125rem] dash-block-5 dash-text-primary hover:opacity-80 cursor-pointer focus-visible:ring-2 focus-visible:ring-dash-brand/40 dark:focus-visible:ring-dash-mint/40"><RefreshIcon size={12} color="currentColor" /></button>}
          </div>}

          {!fixed && mode === CoinControlMode.Inputs && (
            <div className={'mt-6 mb-4 flex flex-wrap items-center justify-between gap-3 shrink-0'}>
              <div className={'flex flex-wrap items-baseline gap-1 text-sm dash-text-default'}>
                <span className={'opacity-50'}>Selected:</span>
                <span>{selectedCount} <span className={'capitalize'}>{selectedItemLabel}</span> - {isCoreSend
                  ? `${davToDash(selectedAmountDuffs)} Dash`
                  : <CreditsAmount credits={selectedAmountCredits} exact showFiat={false} />}</span>
              </div>
              <Checkbox appearance="subtle" checked={filterDust} onChange={setFilterDust} label={<Text size={14} weight={'medium'} color={'brand'} opacity={50}>{COIN_CONTROL_LABELS.filterDust}</Text>} className={'ml-auto flex-row-reverse!'} />
            </div>
          )}

        <FadingScrollArea enabled={mode === CoinControlMode.Inputs} className={'flex-1 min-w-0 min-h-0 overflow-y-auto scrollbar-hide'}>
          {utxosLocalSnapshot && sourceKind === SourceKind.Core && (
            <Text size={12} weight={'medium'} color={'brand'} opacity={50} className={'mb-3 block'}>
              P2P sync is paused. UTXOs reflect the latest locally saved data. Resume sync before sending.
            </Text>
          )}
          {waitingForCoreSync && !hasCoreInputs && showSyncWarning && mode === CoinControlMode.Inputs && <Text size={12} weight="medium" color="brand" opacity={50}>Wallet sync must finish before funds can be listed.</Text>}
          {fixed ? (
            <div className={SURFACE_SECTION}>
              <Text size={12} weight={'medium'} color={'brand'} opacity={50}>{fixedCopy.title}</Text>
              {sourceReady && fixedValue === identityId && identityLabel && identityLabel !== identityId && (
                <Text size={12} weight={'medium'} color={'brand'} className={'mt-2 block break-all'}>{identityLabel}</Text>
              )}
              {sourceReady && <Text size={14} weight={'medium'} color={'brand'} className={'mt-2 block font-mono break-all'}>{fixedValue}</Text>}
              <Text size={12} weight={'medium'} color={'brand'} opacity={50} className={'mt-3 block leading-[140%]'}>
                {fixedCopy.description}
              </Text>
            </div>
          ) : (
            <>
              {mode === CoinControlMode.Automatic && (
                <div className={'relative flex h-full min-h-64 flex-col items-center justify-center overflow-hidden py-8 text-center'}>
                  <CoinControlAutomaticIllustration addresses={coinControlSourceAddresses(sourceKind, funds)}>
                    <div><Text size={16} weight={'extrabold'} color={'brand'}>{COIN_CONTROL_LABELS.automaticTitle}</Text></div>
                    <div className={'mt-1 leading-[140%]'}>
                      <Text size={12} weight={'medium'} color={'brand'} opacity={50}>{COIN_CONTROL_LABELS.automaticDescription}</Text>
                    </div>
                  </CoinControlAutomaticIllustration>
                  <Button type={'button'} onClick={() => chooseMode(CoinControlMode.Inputs)} variant={'solid'} colorScheme={'primary-light'} size={'compact'} className={'h-9.5! px-8! text-xs! normal-case!'}>{COIN_CONTROL_LABELS.switchToManual}</Button>
                </div>
              )}

              {(sourceReady || hasCoreInputs) && mode === CoinControlMode.Inputs && sourceKind === SourceKind.Core && (
                <div className={'flex flex-col gap-2'} aria-busy={refreshingCoreInputs}>
                  {utxos.length === 0 && <Empty text={'No spendable UTXOs'} />}
                  {utxos.length > 0 && visibleUtxos.length === 0 && (
                    <Empty text={'All UTXOs are below the dust threshold.'} />
                  )}
                  {visibleUtxos.map(utxo => {
                    const key = outpointKey(utxo)
                    return (
                      <CheckRow key={key} label={`Select ${utxo.address}, output ${key}`} title={key} checked={selectedOutpoints.includes(key)} onChange={next => toggleCoreOutpoint(key, next)}>
                        <InputDetails
                          label={formatTimestamp(utxo.timestamp)}
                          address={utxo.address}
                          actions={<QrButton iconSize={12} onClick={() => setQrAddress(utxo.address)} ariaLabel={`Show QR code for ${utxo.address}`} className={'pointer-events-auto shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-dash-brand dark:focus-visible:ring-dash-mint'} />}
                          amount={isCoreSend
                            ? <>{davToDash(utxo.satoshis)}<span className="font-normal"> Dash</span></>
                            : <CreditsAmount credits={duffsToCredits(utxo.satoshis)} exact showFiat={false} align={'end'} />}
                          fiat={rateReady ? formatFiat(utxo.satoshis) : undefined}
                        />
                      </CheckRow>
                    )
                  })}
                </div>
              )}

              {sourceReady && mode === CoinControlMode.Inputs && sourceKind === SourceKind.PlatformAddress && (
                <div className={'flex flex-col gap-2'}>
                  <Text size={12} weight={'medium'} color={'brand'} opacity={50} className={'mb-1'}>
                    {operation === TransferOperation.Shield
                      ? `Choose up to ${PLATFORM_INPUT_LIMIT} Platform addresses. The wallet selects the amounts and fee-paying address.`
                      : `Up to ${PLATFORM_INPUT_LIMIT} inputs. Set the maximum Dash available from each.`}
                  </Text>
                  {feeFromOutput && <Text size={12} weight="medium" color="brand" opacity={50}>The network fee will be deducted from the recipient selected on Send.</Text>}
                  {platformAddresses.length === 0 && <Empty text={'No funded Platform addresses'} />}
                  {platformAddresses.length > 0 && visiblePlatformAddresses.length === 0 && (
                    <Empty text={'All Platform inputs are below the dust threshold.'} />
                  )}
                  {visiblePlatformAddresses.length > 0 && (
                    <div className={'flex flex-col gap-2'} role={feePayerGroup ? 'radiogroup' : undefined} aria-label={feePayerGroup ? COIN_CONTROL_LABELS.feePayerGroup : undefined}>
                      {visiblePlatformAddresses.map(entry => {
                        const selected = selectedPlatformInputs.find(input => input.address === entry.platformAddress)
                        const full = selectedPlatformInputs.length >= PLATFORM_INPUT_LIMIT
                        const invalid = selected != null && (selected.credits <= 0n || selected.credits > entry.balanceCredits)
                        const paysFee = draft.kind === 'platformInputs' && draft.feeAddress === entry.platformAddress
                        const editor = selected && operation !== TransferOperation.Shield && (
                          <div className={'flex flex-wrap items-center gap-3'}>
                            <label
                              htmlFor={`coin-control-amount-${entry.platformAddress}`}
                              className={'sr-only'}
                            >
                              <Text size={10} weight={'medium'} color={invalid ? 'red' : 'brand'} opacity={invalid ? 100 : 50}>Dash from this input</Text>
                            </label>
                            <div className={'min-w-0 flex-1'}>
                              <CoinControlAmountInput
                                id={`coin-control-amount-${entry.platformAddress}`}
                                credits={selected.credits}
                                maxCredits={entry.balanceCredits}
                                invalid={invalid}
                                onChange={credits => setPlatformInputCredits(entry.platformAddress, credits)}
                              />
                            </div>
                            {choosesFeePayer && (
                              <button
                                id={`coin-control-fee-${entry.platformAddress}`}
                                type={'button'}
                                role={'radio'}
                                aria-checked={paysFee}
                                aria-label={`${COIN_CONTROL_LABELS.paysFee}: ${entry.platformAddress}`}
                                tabIndex={entry.platformAddress === feePayerTabStop ? 0 : -1}
                                onKeyDown={event => stepFeePayer(event, entry.platformAddress)}
                                onClick={() => setDraft({kind: 'platformInputs', inputs: selectedPlatformInputs, feeAddress: entry.platformAddress})}
                                className={`${CHIP_ACTION} shrink-0 font-medium outline-none focus-visible:ring-2 focus-visible:ring-dash-brand/40 dark:focus-visible:ring-dash-mint/40 ${paysFee ? 'dash-block-accent-25!' : ''}`}
                              >
                                {COIN_CONTROL_LABELS.paysFee}
                              </button>
                            )}
                          </div>
                        )
                        return (
                          <CheckRow key={entry.platformAddress} label={`Select ${entry.platformAddress}`} checked={selected != null} disabled={!selected && full} onChange={checked => togglePlatformInput(entry, checked)} below={editor}>
                            <InputDetails address={entry.platformAddress} amount={<CreditsAmount credits={entry.balanceCredits} exact showFiat={false} align={'end'} />} fiat={rateReady ? formatFiat(creditsToDuffs(entry.balanceCredits)) : undefined} />
                          </CheckRow>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {sourceReady && mode === CoinControlMode.Inputs && sourceKind === SourceKind.Shielded && (
                <div className={'flex flex-col gap-2'}>
                  <Text size={12} weight={'medium'} color={'brand'} opacity={50} className={'mb-1'}>Choose up to {SHIELDED_NOTE_LIMIT} notes.</Text>
                  {shieldedNotes.length === 0 && <Empty text={'No spendable shielded notes'} />}
                  {shieldedNotes.length > 0 && visibleShieldedNotes.length === 0 && (
                    <Empty text={'All shielded notes are below the dust threshold.'} />
                  )}
                  {visibleShieldedNotes.map(note => {
                    const checked = selectedNoteIndexes.includes(note.index)
                    const full = selectedNoteIndexes.length >= SHIELDED_NOTE_LIMIT
                    return (
                      <CheckRow key={note.index} label={`Select note ${note.index}, ${note.address}`} checked={checked} disabled={!checked && full} onChange={next => toggleShieldedNote(note.index, next)}>
                        <InputDetails label={`Note #${note.index}`} address={note.address} amount={<CreditsAmount credits={note.amount} exact showFiat={false} align={'end'} />} fiat={rateReady ? formatFiat(creditsToDuffs(note.amount)) : undefined} />
                      </CheckRow>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </FadingScrollArea>

        <div className={'mt-6 flex gap-3 shrink-0'}>
          {!fixed && (
            <Button type={'button'} onClick={() => chooseMode(CoinControlMode.Automatic)} variant={'solid'} colorScheme={'lightBlue-mint'} size={'md'} className={'flex-1 h-[3.625rem]! rounded-[.9375rem]'}>
              Reset
            </Button>
          )}
          <Button
            type={'button'}
            onClick={apply}
            disabled={!fixed && (!canApply || !sourceReady)}
            variant={'solid'}
            colorScheme={'primary'}
            size={'md'}
            className={'flex-1 h-[3.625rem]! rounded-[.9375rem]'}
          >
            {fixed ? 'Done' : 'Apply'}
          </Button>
        </div>
      </div>
      {qrAddress != null && <AddressQrModal address={qrAddress} title={'Input address'} onClose={() => setQrAddress(null)} />}
    </section>
  )
}

function Empty({text}: CoinControlEmptyProps): React.JSX.Element {
  return <div className={SURFACE_SECTION}><Text size={12} weight={'medium'} color={'brand'} opacity={50}>{text}</Text></div>
}

function InputDetails({label, amount, address, fiat, actions}: CoinControlInputDetailsProps): React.JSX.Element {
  return (
    <div className={'min-w-0 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 text-left'}>
      <div className={`flex min-w-0 items-center gap-[.3125rem] ${label ? 'row-span-2' : ''}`}>
        <HighlightedIdentifier className={ADDRESS_ROW_IDENTIFIER_CLASS}>{address}</HighlightedIdentifier>
        <span title={'Copy address'} className={'pointer-events-auto shrink-0'}><CopyButton text={address} /></span>
        {actions}
      </div>
      <div className={'pointer-events-auto flex flex-wrap items-center justify-end gap-2'}>
        <Text reset size={14} weight={'bold'} color={'brand'} className={'whitespace-nowrap text-right tabular-nums'}>{amount}</Text>
        {fiat && <span className={COIN_CONTROL_FIAT_CLASS}>{formatApproxFiat(fiat)}</span>}
      </div>
      {label && <Text reset size={10} weight={'medium'} color={'brand'} opacity={50} className={'col-start-2 whitespace-nowrap text-right tabular-nums leading-[120%]'}>{label}</Text>}
    </div>
  )
}
