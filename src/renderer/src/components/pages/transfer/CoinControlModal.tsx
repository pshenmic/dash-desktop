import { useEffect, useState } from 'react'
import { useConnectionModeContext } from '@renderer/contexts/ConnectionModeContext'
import { Button, ArrowIcon, Text } from '@renderer/components/dash-ui-kit-enxtended'
import { QrCodeIcon } from '@renderer/components/dash-ui-kit-enxtended/icons'
import AddressQrModal from '@renderer/components/modal/AddressQrModal'
import { useFiat } from '@renderer/hooks/useFiat'
import Checkbox from '@renderer/components/ui/Checkbox'
import CopyButton from '@renderer/components/ui/CopyButton'
import CreditsAmount from '@renderer/components/ui/CreditsAmount'
import CoinControlAmountInput from './CoinControlAmountInput'
import type { PlatformAddressDto } from '@renderer/api/types'
import { FIXED_IDENTITY_SOURCE_COPY, FIXED_SOURCE_COPY } from '@renderer/constants/coinControl'
import { CORE_DUST_FILTER_DUFFS } from '@renderer/constants/core'
import { PLATFORM_DUST_FILTER_CREDITS, PLATFORM_INPUT_LIMIT } from '@renderer/constants/platform'
import { SHIELDED_DUST_FILTER_CREDITS, SHIELDED_NOTE_LIMIT } from '@renderer/constants/shielded'
import { SourceKind } from '@renderer/enums/SourceKind'
import { TransferOperation } from '@renderer/enums/TransferOperation'
import { CoinControlMode } from '@renderer/enums/CoinControlMode'
import type {
  CoinControlInputDetailsProps,
  CoinControlCheckRowProps,
  CoinControlEmptyProps,
  CoinControlModalProps,
  CoinControlSelection,
} from '@renderer/types/CoinControl'
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
  const [filterDust, setFilterDust] = useState(false)
  const [onlySelected, setOnlySelected] = useState(false)
  const [qrAddress, setQrAddress] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    setDraft(selection)
    setFilterDust(false)
    setOnlySelected(false)
    setQrAddress(null)
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
  const nonDustShieldedNotes = shieldedNotes.filter(note => note.amount >= SHIELDED_DUST_FILTER_CREDITS)
  const visibleShieldedNotes = (filterDust ? nonDustShieldedNotes : shieldedNotes)
    .filter(note => !onlySelected || (draft.kind === 'shieldedNotes' && draft.noteIndexes.includes(note.index)))
  const nonDustUtxos = utxos.filter(utxo => utxo.satoshis >= CORE_DUST_FILTER_DUFFS)
  const visibleUtxos = (filterDust ? nonDustUtxos : utxos)
    .filter(utxo => !onlySelected || (draft.kind === 'coreOutpoints' && draft.outpoints.includes(outpointKey(utxo))))

  const nonDustPlatformAddresses = platformAddresses.filter(address => address.balanceCredits >= PLATFORM_DUST_FILTER_CREDITS)
  const selectedPlatformInputs = draft.kind === 'platformInputs' ? draft.inputs : []
  const visiblePlatformAddresses = (filterDust ? nonDustPlatformAddresses : platformAddresses)
    .filter(address => !onlySelected || selectedPlatformInputs.some(input => input.address === address.platformAddress))
  const {count: selectedCount, duffs: selectedAmountDuffs, credits: selectedAmountCredits} = coinControlSelectionTotals(draft, funds)
  const isCoreSend = operation === TransferOperation.CoreSend
  const selectedItemLabel = coinControlInputLabel(sourceKind, selectedCount)
  const canApply = normalizeCoinControlSelection(draft, operation) === draft
    && isCoinControlSelectionValid(draft, buildCoinControlInventory(funds))

  const chooseMode = (nextMode: CoinControlMode): void => {
    setOnlySelected(false)
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
      className={`relative -mb-px border-b pb-2.5 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-dash-brand/40 dark:focus-visible:ring-dash-mint/40 transition-colors ${mode === value ? 'border-dash-brand dark:border-dash-mint' : 'border-transparent opacity-40 hover:opacity-70'}`}
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
  const showLoadingMessage = sourceLoading && !hasCoreInputs && (!waitingForCoreSync || showSyncWarning)

  const fixed = sourceKind == null
  const fixedCopy = FIXED_SOURCE_COPY[operation] ?? FIXED_IDENTITY_SOURCE_COPY
  let fixedValue = identityId ?? identityLabel ?? 'No identity selected'
  if (operation === TransferOperation.IdentityCreateFromShielded) {
    fixedValue = 'The wallet selects notes for this operation.'
  }

  const toggleCoreOutpoint = (key: string, checked: boolean): void => {
    let outpoints: string[] = []
    if (draft.kind === 'coreOutpoints') outpoints = draft.outpoints
    if (checked) {
      setDraft({kind: 'coreOutpoints', outpoints: [...outpoints, key]})
    } else {
      const nextOutpoints = outpoints.filter(value => value !== key)
      setDraft({kind: 'coreOutpoints', outpoints: nextOutpoints})
    }
  }

  const toggleDustFilter = (checked: boolean): void => {
    setFilterDust(checked)
    if (!checked) return

    switch (draft.kind) {
      case 'coreOutpoints': {
        const visibleOutpoints = new Set(nonDustUtxos.map(outpointKey))
        const outpoints = draft.outpoints.filter(outpoint => visibleOutpoints.has(outpoint))
        setDraft({
          kind: 'coreOutpoints',
          outpoints,
        })
        break
      }
      case 'platformInputs': {
        const visibleAddresses = new Set(nonDustPlatformAddresses.map(address => address.platformAddress))
        const inputs = draft.inputs.filter(input => visibleAddresses.has(input.address))
        let feeAddress = draft.feeAddress
        if (!inputs.some(input => input.address === feeAddress)) feeAddress = inputs[0]?.address ?? ''
        setDraft({kind: 'platformInputs', inputs, feeAddress})
        break
      }
      case 'shieldedNotes': {
        const visibleNoteIndexes = new Set(nonDustShieldedNotes.map(note => note.index))
        setDraft({
          kind: 'shieldedNotes',
          noteIndexes: draft.noteIndexes.filter(index => visibleNoteIndexes.has(index)),
        })
        break
      }
    }
  }

  const togglePlatformInput = (entry: PlatformAddressDto, checked: boolean): void => {
    if (checked && selectedPlatformInputs.length >= PLATFORM_INPUT_LIMIT) return
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
    let noteIndexes: number[] = []
    if (draft.kind === 'shieldedNotes') noteIndexes = draft.noteIndexes
    if (checked) {
      if (noteIndexes.length >= SHIELDED_NOTE_LIMIT) return
      setDraft({kind: 'shieldedNotes', noteIndexes: [...noteIndexes, index]})
    } else {
      const nextNoteIndexes = noteIndexes.filter(noteIndex => noteIndex !== index)
      setDraft({kind: 'shieldedNotes', noteIndexes: nextNoteIndexes})
    }
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
    <section className={'flex flex-col min-w-0 px-6 lg:px-12! pb-4'} aria-labelledby={'coin-control-title'} inert={qrAddress != null}>
      <div className={'flex items-center gap-4'}>
        <button type={'button'} onClick={onClose} className={'size-8 flex items-center justify-center shrink-0 rounded-lg dash-block dash-text-default hover:opacity-70 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-dash-brand dark:focus-visible:ring-dash-mint'} aria-label={'Back'}>
          <ArrowIcon size={16} color={'currentColor'} />
        </button>
        <h1 id={'coin-control-title'}><Text size={24} weight={'medium'} color={'brand'} className={'tracking-[-0.03em]'}>Coin Control</Text></h1>
      </div>
      <Text size={12} weight={'medium'} color={'brand'} opacity={50} className={'mt-2 block max-w-152.5 leading-[120%]'}>
        Flexible selector of <strong>which funds this transfer may spend.</strong> Leave the option on automatic if you don’t want to select specific addresses.
      </Text>

      <div className={'mt-7.5 flex flex-col min-w-0 h-[calc(100dvh-17.5rem)] min-h-96 rounded-3xl p-3.5 dash-card-base border border-dash-primary-dark-blue/12 dark:border-white/12'}>
          {!fixed && <div className={'flex gap-6 shrink-0 border-b border-dash-primary-dark-blue/12 dark:border-white/12'}>
            {modeButton(CoinControlMode.Automatic, 'Automatic')}
            {modeButton(CoinControlMode.Inputs, 'Manual')}
          </div>}

          {!fixed && mode === CoinControlMode.Inputs && (
            <div className={'mt-6 mb-4 flex flex-wrap items-center justify-between gap-3 shrink-0'}>
              <div className={'flex flex-wrap items-baseline gap-1 text-sm dash-text-default'}>
                <span className={'opacity-50'}>Selected:</span>
                <span>{selectedCount} {selectedItemLabel} - {isCoreSend
                  ? `${davToDash(selectedAmountDuffs)} Dash`
                  : <CreditsAmount credits={selectedAmountCredits} exact showFiat={false} />}</span>
              </div>
              <div className={'ml-auto flex flex-wrap items-center gap-6'}>
                <Checkbox checked={onlySelected} onChange={setOnlySelected} label={<Text size={14} weight={'medium'} color={'brand'} opacity={50}>Only selected</Text>} className={'flex-row-reverse!'} />
                <Checkbox checked={filterDust} onChange={toggleDustFilter} label={<Text size={14} weight={'medium'} color={'brand'} opacity={50}>Filter dust</Text>} className={'flex-row-reverse!'} />
              </div>
            </div>
          )}

        <div className={'flex-1 min-w-0 min-h-0 overflow-y-auto scrollbar-hide'}>
          {utxosLocalSnapshot && sourceKind === SourceKind.Core && (
            <Text size={12} weight={'medium'} color={'brand'} opacity={50} className={'mb-3 block'}>
              P2P sync is paused. UTXOs reflect the latest locally saved data. Resume sync before sending.
            </Text>
          )}
          {showLoadingMessage && <Text size={12} weight={'medium'} color={'brand'} opacity={50}>{waitingForCoreSync ? 'Wallet sync must finish before funds can be listed.' : 'Loading available funds…'}</Text>}
          {!sourceLoading && sourceError && (
            <button type={'button'} onClick={retrySource} className={'dash-text-primary text-sm cursor-pointer'}>Try again</button>
          )}
          {fixed ? (
            <div className={'dash-block rounded-[.9375rem] p-4'}>
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
                  <svg aria-hidden={'true'} viewBox={'0 0 640 200'} className={'absolute inset-x-0 top-4 w-full dash-text-default opacity-20'} fill={'none'}>
                    <path d={'M40 40L320 140 140 80M500 30L320 140 600 90M0 140H640'} stroke={'currentColor'} />
                    <g fill={'currentColor'} fontSize={'6'}>
                      <g transform={'rotate(9 10 25)'}><rect x={'10'} y={'25'} width={'130'} height={'20'} rx={'8'} fillOpacity={'.15'} /><text x={'18'} y={'38'}>{utxos[0]?.address ?? platformAddresses[0]?.platformAddress}</text></g>
                      <g transform={'rotate(-8 140 65)'}><rect x={'140'} y={'65'} width={'150'} height={'20'} rx={'8'} fillOpacity={'.15'} /><text x={'148'} y={'78'}>{utxos[1]?.address ?? platformAddresses[1]?.platformAddress}</text></g>
                      <g transform={'rotate(-5 405 20)'}><rect x={'405'} y={'20'} width={'155'} height={'20'} rx={'8'} fillOpacity={'.15'} /><text x={'413'} y={'33'}>{utxos[2]?.address ?? platformAddresses[2]?.platformAddress}</text></g>
                      <g transform={'rotate(10 485 82)'}><rect x={'485'} y={'82'} width={'140'} height={'20'} rx={'8'} fillOpacity={'.15'} /><text x={'493'} y={'95'}>{utxos[3]?.address ?? platformAddresses[3]?.platformAddress}</text></g>
                    </g>
                  </svg>
                  <div className={'relative flex size-25 items-center justify-center rounded-full border border-dash-brand/10 dark:border-dash-mint/10 mb-3'}>
                    <div className={'flex size-16 items-center justify-center rounded-full dash-block'}>
                      <svg aria-hidden={'true'} width={'28'} height={'28'} viewBox={'0 0 28 28'} fill={'none'} className={'dash-text-default'}>
                        <path d={'M4 15L8 5H20L24 15M4 15V22C4 23 5 24 6 24H22C23 24 24 23 24 22V15H18L16 18H12L10 15H4Z'} stroke={'currentColor'} strokeLinecap={'round'} strokeLinejoin={'round'} />
                      </svg>
                    </div>
                  </div>
                  <div><Text size={16} weight={'extrabold'} color={'brand'}>Let the wallet choose</Text></div>
                  <div className={'mt-1 leading-[140%] relative'}>
                    <Text size={12} weight={'medium'} color={'brand'} opacity={50}>
                      The wallet will select enough available inputs for the amount and fee.
                    </Text>
                  </div>
                  <Button type={'button'} onClick={() => chooseMode(CoinControlMode.Inputs)} variant={'solid'} colorScheme={'primary-light'} size={'sm'} className={'mt-4 rounded-[.9375rem]'}>Switch to Manual</Button>
                </div>
              )}

              {(sourceReady || hasCoreInputs) && mode === CoinControlMode.Inputs && sourceKind === SourceKind.Core && (
                <div className={'flex flex-col gap-2'} aria-busy={refreshingCoreInputs}>
                  {utxos.length === 0 && <Empty text={'No spendable UTXOs'} />}
                  {utxos.length > 0 && visibleUtxos.length === 0 && (
                    <Empty text={onlySelected ? 'No selected UTXOs match these filters.' : 'All UTXOs are below the dust threshold.'} />
                  )}
                  {visibleUtxos.map(utxo => {
                    const key = outpointKey(utxo)
                    const checked = draft.kind === 'coreOutpoints' && draft.outpoints.includes(key)
                    return (
                      <CheckRow key={key} label={`Select ${utxo.address}, output ${key}`} checked={checked} onChange={next => toggleCoreOutpoint(key, next)}>
                        <div className={'flex items-center gap-2.5'}>
                          <div className={'min-w-0 flex-1'}>
                            <div className={'min-w-0 flex-1 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1'}>
                              <span className={'min-w-0 flex items-center gap-2'}>
                                <Text reset size={12} weight={'medium'} color={'brand'} className={'min-w-0 break-all'}>{utxo.address}</Text>
                                <span title={'Copy address'} className={'pointer-events-auto shrink-0'}><CopyButton text={utxo.address} /></span>
                                <button type={'button'} onClick={() => setQrAddress(utxo.address)} aria-label={`Show QR code for ${utxo.address}`} className={'pointer-events-auto shrink-0 rounded dash-text-default opacity-50 hover:opacity-100 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-dash-brand dark:focus-visible:ring-dash-mint'}>
                                  <QrCodeIcon size={12} color={'currentColor'} />
                                </button>
                              </span>
                              <div className={'ml-auto flex flex-wrap items-center justify-end gap-2 pointer-events-auto'}>
                                <Text reset size={14} weight={'bold'} color={'brand'} className={'whitespace-nowrap text-right tabular-nums'}>
                                  {isCoreSend
                                    ? `${davToDash(utxo.satoshis)} Dash`
                                    : <CreditsAmount credits={duffsToCredits(utxo.satoshis)} exact showFiat={false} align={'end'} />}
                                </Text>
                                {rateReady && <span className={'rounded-lg px-2 py-1 dash-block-accent-10 text-[.625rem] dash-text-primary whitespace-nowrap'}>~ {formatFiat(utxo.satoshis)}</span>}
                              </div>
                            </div>
                            <div className={'mt-1.5 flex items-baseline justify-between gap-3'}>
                              <Text reset size={10} weight={'medium'} color={'brand'} opacity={50} className={'min-w-0 flex-1 font-mono break-all'}>{key}</Text>
                              <Text reset size={10} weight={'medium'} color={'brand'} opacity={50} className={'shrink-0 whitespace-nowrap text-right tabular-nums'}>
                                {formatTimestamp(utxo.timestamp)}
                              </Text>
                            </div>
                          </div>
                        </div>
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
                    <Empty text={onlySelected ? 'No selected Platform inputs match these filters.' : 'All Platform inputs are below the dust threshold.'} />
                  )}
                  {visiblePlatformAddresses.map(entry => {
                    const selected = selectedPlatformInputs.find(input => input.address === entry.platformAddress)
                    const full = selectedPlatformInputs.length >= PLATFORM_INPUT_LIMIT
                    const invalid = selected != null && (selected.credits <= 0n || selected.credits > entry.balanceCredits)
                    return (
                      <CheckRow key={entry.platformAddress} label={`Select ${entry.platformAddress}`} checked={selected != null} disabled={!selected && full} onChange={checked => togglePlatformInput(entry, checked)}>
                        <InputDetails label={'Platform input'} address={entry.platformAddress} amount={<CreditsAmount credits={entry.balanceCredits} exact showFiat={false} align={'end'} />} fiat={rateReady ? formatFiat(creditsToDuffs(entry.balanceCredits)) : undefined} />
                        {selected && operation !== TransferOperation.Shield && (
                          <div className={'mt-3 flex flex-wrap items-end gap-3'}>
                            <label
                              htmlFor={`coin-control-amount-${entry.platformAddress}`}
                              className={'sr-only'}
                            >
                              <Text size={10} weight={'medium'} color={invalid ? 'red' : 'brand'} opacity={invalid ? 100 : 50}>Dash from this input</Text>
                            </label>
                            <CoinControlAmountInput
                              id={`coin-control-amount-${entry.platformAddress}`}
                              credits={selected.credits}
                              maxCredits={entry.balanceCredits}
                              invalid={invalid}
                              onChange={credits => setPlatformInputCredits(entry.platformAddress, credits)}
                            />
                            {!feeFromOutput && <label className={'pointer-events-auto flex items-center gap-1.5 cursor-pointer select-none shrink-0 pb-1'}>
                              <input
                                type={'radio'}
                                checked={draft.kind === 'platformInputs' && draft.feeAddress === entry.platformAddress}
                                onChange={() => setDraft({kind: 'platformInputs', inputs: selectedPlatformInputs, feeAddress: entry.platformAddress})}
                                className={'accent-dash-brand dark:accent-dash-mint'}
                              />
                              <Text size={12} weight={'medium'} color={'brand'}>Pays fee</Text>
                            </label>}
                          </div>
                        )}
                      </CheckRow>
                    )
                  })}
                </div>
              )}

              {sourceReady && mode === CoinControlMode.Inputs && sourceKind === SourceKind.Shielded && (
                <div className={'flex flex-col gap-2'}>
                  <Text size={12} weight={'medium'} color={'brand'} opacity={50} className={'mb-1'}>Choose up to {SHIELDED_NOTE_LIMIT} notes.</Text>
                  {shieldedNotes.length === 0 && <Empty text={'No spendable shielded notes'} />}
                  {shieldedNotes.length > 0 && visibleShieldedNotes.length === 0 && (
                    <Empty text={onlySelected ? 'No selected notes match these filters.' : 'All shielded notes are below the dust threshold.'} />
                  )}
                  {visibleShieldedNotes.map(note => {
                    const picked = draft.kind === 'shieldedNotes' ? draft.noteIndexes : []
                    const checked = picked.includes(note.index)
                    const full = picked.length >= SHIELDED_NOTE_LIMIT
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
        </div>

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
            {fixed ? 'Done' : refreshingCoreInputs ? 'Updating…' : 'Apply'}
          </Button>
        </div>
      </div>
      {qrAddress != null && <AddressQrModal address={qrAddress} title={'Input address'} onClose={() => setQrAddress(null)} />}
    </section>
  )
}

function Empty({text}: CoinControlEmptyProps): React.JSX.Element {
  return <div className={'dash-block rounded-[.75rem] p-4'}><Text size={12} weight={'medium'} color={'brand'} opacity={50}>{text}</Text></div>
}

function InputDetails({label, amount, address, fiat}: CoinControlInputDetailsProps): React.JSX.Element {
  return (
    <span className={'min-w-0 flex-1 grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 text-left'}>
      <span className={'row-span-2 flex items-center gap-2 min-w-0'}>
        <Text reset size={12} weight={'medium'} color={'brand'} className={'min-w-0 break-all'}>{address}</Text>
        <span title={'Copy address'} className={'pointer-events-auto shrink-0'}><CopyButton text={address} /></span>
      </span>
      <span className={'pointer-events-auto flex flex-wrap items-center justify-end gap-2'}>
        <Text reset size={14} weight={'bold'} color={'brand'} className={'text-right tabular-nums'}>{amount}</Text>
        {fiat && <span className={'rounded-lg px-2 py-1 dash-block-accent-10 text-[.625rem] dash-text-primary whitespace-nowrap'}>~ {fiat}</span>}
      </span>
      <Text reset size={10} weight={'medium'} color={'brand'} opacity={50} className={'col-start-2 text-right'}>{label}</Text>
    </span>
  )
}

function CheckRow({label, checked, onChange, children, disabled = false}: CoinControlCheckRowProps): React.JSX.Element {
  return (
    <div className={`relative min-w-0 rounded-[.9375rem] p-3.5 transition-colors ${checked ? 'dash-block-accent-5' : 'dash-block hover:dash-block-accent-5'} ${disabled ? 'opacity-40' : ''}`}>
      <Checkbox className={`absolute inset-0 p-3 ${disabled ? 'cursor-not-allowed!' : ''}`} checked={checked} disabled={disabled} onChange={onChange} label={<span className={'sr-only'}>{label}</span>} />
      <div className={'relative pointer-events-none min-w-0 ml-7'}>{children}</div>
    </div>
  )
}
