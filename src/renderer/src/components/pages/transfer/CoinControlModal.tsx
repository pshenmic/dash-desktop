import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTheme } from 'dash-ui-kit/react'
import { Button, CreditsIcon, CrossIcon, ShieldSmallIcon, Text } from '@renderer/components/dash-ui-kit-enxtended'
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
import { davToDash, duffsToCredits } from '@renderer/utils/balance'

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
  utxosError,
  coreSyncIncomplete,
  platformAddresses,
  platformAddressesLoading,
  platformAddressesError,
  onRetryPlatformAddresses,
  shieldedNotes,
  identityLabel,
  identityId,
  platformAddress,
  onRetryUtxos,
  onClose,
  onApply,
}: CoinControlModalProps): React.JSX.Element | null {
  const {theme} = useTheme()
  const [draftSelection, setDraft] = useState<CoinControlSelection>(selection)
  const [filterDust, setFilterDust] = useState(false)
  const [onlySelected, setOnlySelected] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setDraft(selection)
    setFilterDust(false)
    setOnlySelected(false)
  }, [isOpen, selection])

  useEffect(() => {
    if (!isOpen) return
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      onClose()
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [isOpen, onClose])

  if (!isOpen || operation == null) return null

  const sourceKind = coinControlSourceKind(operation)
  const funds = {coreAddresses, utxos, platformAddresses, shieldedNotes}
  const draft = expandAddressCoinControlSelection(draftSelection, funds)
  const nonDustShieldedNotes = shieldedNotes.filter(note => note.amount >= SHIELDED_DUST_FILTER_CREDITS)
  const visibleShieldedNotes = filterDust ? nonDustShieldedNotes : shieldedNotes
  const nonDustUtxos = utxos.filter(utxo => utxo.satoshis >= CORE_DUST_FILTER_DUFFS)
  const visibleUtxos = filterDust ? nonDustUtxos : utxos
  const selectedOutpoints = draft.kind === 'coreOutpoints' ? new Set(draft.outpoints) : new Set<string>()
  const selectedUtxos = visibleUtxos.filter(utxo => selectedOutpoints.has(outpointKey(utxo)))
  const displayedUtxos = onlySelected && selectedUtxos.length > 0 ? selectedUtxos : visibleUtxos

  const nonDustPlatformAddresses = platformAddresses.filter(address => address.balanceCredits >= PLATFORM_DUST_FILTER_CREDITS)
  const visiblePlatformAddresses = filterDust ? nonDustPlatformAddresses : platformAddresses
  const selectedPlatformInputs = draft.kind === 'platformInputs' ? draft.inputs : []
  const selectedPlatformAddresses = new Set(selectedPlatformInputs.map(input => input.address))
  const displayedPlatformAddresses = onlySelected && selectedPlatformInputs.length > 0
    ? visiblePlatformAddresses.filter(address => selectedPlatformAddresses.has(address.platformAddress))
    : visiblePlatformAddresses

  const selectedNoteIndexes = draft.kind === 'shieldedNotes' ? new Set(draft.noteIndexes) : new Set<number>()
  const selectedShieldedNotes = visibleShieldedNotes.filter(note => selectedNoteIndexes.has(note.index))
  const displayedShieldedNotes = onlySelected && selectedShieldedNotes.length > 0
    ? selectedShieldedNotes
    : visibleShieldedNotes
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
      className={`flex-1 rounded-[.75rem] px-3 py-2 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-dash-brand/40 dark:focus-visible:ring-dash-mint/40 transition-colors ${mode === value ? 'dash-bg-inverse' : 'dash-block hover:dash-block-accent-10'}`}
    >
      <Text size={12} weight={'extrabold'} color={mode === value ? 'blue-mint' : 'brand'}>{label}</Text>
    </button>
  )

  let sourceLoading = false
  let sourceError: string | null = null
  let retrySource = onRetryUtxos
  if (sourceKind === SourceKind.Core) {
    sourceLoading = utxosLoading || coreSyncIncomplete
    sourceError = utxosError
    if (mode !== CoinControlMode.Inputs) {
      sourceLoading = coreAddressesLoading
      sourceError = coreAddressesError
      retrySource = onRetryCoreAddresses
    }
  } else if (sourceKind === SourceKind.PlatformAddress || operation === TransferOperation.Shield) {
    sourceLoading = platformAddressesLoading
    sourceError = platformAddressesError
    retrySource = onRetryPlatformAddresses
  }
  const sourceReady = !sourceLoading && sourceError == null

  const fixed = sourceKind == null
  const fixedCopy = FIXED_SOURCE_COPY[operation] ?? FIXED_IDENTITY_SOURCE_COPY
  let fixedValue = identityId ?? identityLabel ?? 'No identity selected'
  if (operation === TransferOperation.Shield) {
    fixedValue = platformAddress?.platformAddress ?? 'No funded Platform address'
  } else if (operation === TransferOperation.IdentityCreateFromShielded) {
    fixedValue = 'The wallet selects notes for this operation.'
  }

  const toggleCoreOutpoint = (key: string, checked: boolean): void => {
    let outpoints: string[] = []
    if (draft.kind === 'coreOutpoints') outpoints = draft.outpoints
    if (checked) {
      if (outpoints.length === 0) setOnlySelected(false)
      setDraft({kind: 'coreOutpoints', outpoints: [...outpoints, key]})
    } else {
      const nextOutpoints = outpoints.filter(value => value !== key)
      if (nextOutpoints.length === 0) setOnlySelected(false)
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
        if (outpoints.length === 0) setOnlySelected(false)
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
        if (inputs.length === 0) setOnlySelected(false)
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
      if (selectedPlatformInputs.length === 0) setOnlySelected(false)
      const inputs = [...selectedPlatformInputs, {address: entry.platformAddress, credits: entry.balanceCredits}]
      const feeAddress = draft.kind === 'platformInputs' && draft.feeAddress
        ? draft.feeAddress
        : entry.platformAddress
      setDraft({kind: 'platformInputs', inputs, feeAddress})
      return
    }

    const inputs = selectedPlatformInputs.filter(input => input.address !== entry.platformAddress)
    if (inputs.length === 0) setOnlySelected(false)
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
      if (noteIndexes.length === 0) setOnlySelected(false)
      setDraft({kind: 'shieldedNotes', noteIndexes: [...noteIndexes, index]})
    } else {
      const nextNoteIndexes = noteIndexes.filter(noteIndex => noteIndex !== index)
      if (nextNoteIndexes.length === 0) setOnlySelected(false)
      setDraft({kind: 'shieldedNotes', noteIndexes: nextNoteIndexes})
    }
  }

  const apply = (): void => {
    if (fixed) {
      onClose()
      return
    }
    if (!canApply || !sourceReady) return
    onApply(draft)
    onClose()
  }

  return createPortal(
    <div className={'fixed inset-0 z-99 bg-black/64 flex items-center justify-center overlay-fade-in'} role={'dialog'} aria-modal={'true'} aria-labelledby={'coin-control-title'}>
      <div className={'w-full min-w-0 max-w-170 max-h-[calc(100vh-3rem)] overflow-clip rounded-3xl bg-white dark:bg-white/12 p-6 dark:backdrop-blur-[2rem] modal-fade-in flex flex-col'}>
        <div className={'flex items-center justify-between gap-4'}>
          <div>
            <div id={'coin-control-title'}><Text size={24} weight={'extrabold'} color={'brand'}>Coin control</Text></div>
            <Text size={12} weight={'medium'} color={'brand'} opacity={50} className={'mt-1 block'}>
              Choose which funds this transfer may spend.
            </Text>
          </div>
          <button type={'button'} onClick={onClose} className={'dash-text-default hover:opacity-60 cursor-pointer'} aria-label={'Close'}>
            <CrossIcon size={16} color={'currentColor'} className={'dash-text-default'} />
          </button>
        </div>

        <div className={'mt-5 min-w-0 min-h-0 max-h-[calc(100vh-15rem)] overflow-y-auto scrollbar-hide'}>
          {sourceLoading && <Text size={12} weight={'medium'} color={'brand'} opacity={50}>{coreSyncIncomplete && sourceKind === SourceKind.Core ? 'Wallet sync must finish before funds can be listed.' : 'Loading available funds…'}</Text>}
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
              <div className={'flex gap-2'}>
                {modeButton(CoinControlMode.Automatic, 'Automatic')}
                {modeButton(CoinControlMode.Inputs, 'Manual')}
              </div>

              {sourceKind != null && mode !== CoinControlMode.Automatic && (
                <div className={'mt-4 flex flex-wrap min-h-7 items-center justify-between gap-3'}>
                  {mode === CoinControlMode.Inputs && (
                    <div className={'flex flex-wrap items-center gap-3'}>
                      <Text size={12} weight={'medium'} color={'brand'} opacity={50}>
                        Selected: {selectedCount} {selectedItemLabel} · {isCoreSend
                          ? `${davToDash(selectedAmountDuffs)} Dash`
                          : <CreditsAmount credits={selectedAmountCredits} exact showFiat={false} />}
                      </Text>
                      {selectedCount > 0 && (
                        <Checkbox
                          checked={onlySelected}
                          onChange={setOnlySelected}
                          label={<Text size={12} weight={'medium'} color={'brand'}>Only selected</Text>}
                        />
                      )}
                    </div>
                  )}
                  <Checkbox
                    checked={filterDust}
                    onChange={toggleDustFilter}
                    label={<Text size={12} weight={'medium'} color={'brand'}>Filter dust</Text>}
                    className={'ml-auto'}
                  />
                </div>
              )}

              {mode === CoinControlMode.Automatic && (
                <div className={'mt-4 dash-block rounded-[.9375rem] p-4'}>
                  <div><Text size={14} weight={'extrabold'} color={'brand'}>Let the wallet choose</Text></div>
                  <div className={'mt-1 leading-[140%]'}>
                    <Text size={12} weight={'medium'} color={'brand'} opacity={50}>
                      The wallet will select enough available inputs for the amount and fee.
                    </Text>
                  </div>
                </div>
              )}

              {sourceReady && mode === CoinControlMode.Inputs && sourceKind === SourceKind.Core && (
                <div className={'mt-4 flex flex-col gap-2'}>
                  {utxos.length === 0 && <Empty text={'No spendable UTXOs'} />}
                  {utxos.length > 0 && visibleUtxos.length === 0 && (
                    <Empty text={'All UTXOs are below the dust threshold.'} />
                  )}
                  {displayedUtxos.map(utxo => {
                    const key = outpointKey(utxo)
                    const checked = draft.kind === 'coreOutpoints' && draft.outpoints.includes(key)
                    return (
                      <div key={key} className={`rounded-[.75rem] p-3 ${checked ? 'dash-block-accent-5' : 'dash-block'}`}>
                        <CheckRow bare checked={checked} onChange={next => toggleCoreOutpoint(key, next)}>
                          <span className={'min-w-0 flex-1 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1'}>
                            <Text reset size={14} weight={'medium'} color={'brand'} className={'min-w-0 break-all'}>{utxo.address}</Text>
                            <Text reset size={14} weight={'extrabold'} color={'brand'} className={'ml-auto whitespace-nowrap text-right tabular-nums'}>
                              {isCoreSend
                                ? `${davToDash(utxo.satoshis)} Dash`
                                : <CreditsAmount credits={duffsToCredits(utxo.satoshis)} exact showFiat={false} align={'end'} />}
                            </Text>
                          </span>
                        </CheckRow>
                        <div className={'mt-1.5 ml-7 flex items-center gap-2'}>
                          <Text reset size={12} weight={'medium'} color={'brand'} opacity={50} className={'min-w-0 font-mono break-all'}>{key}</Text>
                          <span title={'Copy transaction ID'} className={'ml-auto shrink-0'}>
                            <CopyButton text={utxo.txid} />
                          </span>
                        </div>
                        {utxo.height === 0 && <Text reset size={12} weight={'medium'} color={'brand'} opacity={50} className={'mt-1 ml-7 block'}>Pending</Text>}
                      </div>
                    )
                  })}
                </div>
              )}

              {sourceReady && mode === CoinControlMode.Inputs && sourceKind === SourceKind.PlatformAddress && (
                <div className={'mt-4 flex flex-col gap-2'}>
                  <Text size={12} weight={'medium'} color={'brand'} opacity={50} className={'mb-1'}>Up to {PLATFORM_INPUT_LIMIT} inputs. Set the maximum Dash available from each.</Text>
                  {feeFromOutput && <Text size={12} weight="medium" color="brand" opacity={50}>The network fee will be deducted from the recipient selected on Send.</Text>}
                  {platformAddresses.length === 0 && <Empty text={'No funded Platform addresses'} />}
                  {platformAddresses.length > 0 && visiblePlatformAddresses.length === 0 && (
                    <Empty text={'All Platform inputs are below the dust threshold.'} />
                  )}
                  {displayedPlatformAddresses.map(entry => {
                    const selected = selectedPlatformInputs.find(input => input.address === entry.platformAddress)
                    const full = selectedPlatformInputs.length >= PLATFORM_INPUT_LIMIT
                    const invalid = selected != null && (selected.credits <= 0n || selected.credits > entry.balanceCredits)
                    return (
                      <div key={entry.platformAddress} className={`rounded-[.75rem] p-3 ${selected ? 'dash-block-accent-5' : 'dash-block'} ${!selected && full ? 'opacity-40' : ''}`}>
                        <CheckRow bare checked={selected != null} onChange={checked => togglePlatformInput(entry, checked)}>
                          <CreditsIcon size={18} className={'shrink-0'} />
                          <InputDetails label={'Platform input'} amount={<CreditsAmount credits={entry.balanceCredits} exact showFiat={false} align={'end'} />}>
                            <Text reset size={12} weight={'medium'} color={'brand'} className={'block font-mono break-all'}>{entry.platformAddress}</Text>
                          </InputDetails>
                        </CheckRow>
                        {selected && (
                          <div className={'mt-3 ml-7 grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1'}>
                            <label
                              htmlFor={`coin-control-amount-${entry.platformAddress}`}
                              className={'col-start-1 row-start-1'}
                            >
                              <Text size={10} weight={'medium'} color={invalid ? 'red' : 'brand'} opacity={invalid ? 100 : 50}>Dash from this input</Text>
                            </label>
                            <CoinControlAmountInput
                              id={`coin-control-amount-${entry.platformAddress}`}
                              credits={selected.credits}
                              invalid={invalid}
                              onChange={credits => setPlatformInputCredits(entry.platformAddress, credits)}
                            />
                            {!feeFromOutput && <label className={'col-start-2 row-start-2 self-center flex items-center gap-1.5 cursor-pointer select-none shrink-0'}>
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
                      </div>
                    )
                  })}
                </div>
              )}

              {sourceReady && mode === CoinControlMode.Inputs && sourceKind === SourceKind.Shielded && (
                <div className={'mt-4 flex flex-col gap-2'}>
                  <Text size={12} weight={'medium'} color={'brand'} opacity={50} className={'mb-1'}>Choose up to {SHIELDED_NOTE_LIMIT} notes.</Text>
                  {shieldedNotes.length === 0 && <Empty text={'No spendable shielded notes'} />}
                  {shieldedNotes.length > 0 && visibleShieldedNotes.length === 0 && (
                    <Empty text={'All shielded notes are below the dust threshold.'} />
                  )}
                  {displayedShieldedNotes.map(note => {
                    const picked = draft.kind === 'shieldedNotes' ? draft.noteIndexes : []
                    const checked = picked.includes(note.index)
                    const full = picked.length >= SHIELDED_NOTE_LIMIT
                    return (
                      <CheckRow key={note.index} checked={checked} disabled={!checked && full} onChange={next => toggleShieldedNote(note.index, next)}>
                        <ShieldSmallIcon size={16} className={'shrink-0 text-dash-brand dark:text-dash-mint'} />
                        <InputDetails label={`Note #${note.index}`} amount={<CreditsAmount credits={note.amount} exact showFiat={false} align={'end'} />}>
                          <Text reset size={12} weight={'medium'} color={'brand'} className={'block font-mono text-[.6875rem]! break-all'}>{note.address}</Text>
                        </InputDetails>
                      </CheckRow>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>

        <div className={'mt-5 flex gap-2'}>
          {!fixed && (
            <Button type={'button'} onClick={() => setDraft(automaticCoinControl())} variant={'solid'} colorScheme={theme === 'light' ? 'lightBlue-mint' : 'gray'} size={'sm'} className={'rounded-[.9375rem]'}>
              Reset
            </Button>
          )}
          <Button type={'button'} onClick={onClose} variant={'solid'} colorScheme={theme === 'light' ? 'lightBlue-mint' : 'gray'} size={'sm'} className={'flex-1 rounded-[.9375rem]'}>
            Cancel
          </Button>
          <Button
            type={'button'}
            onClick={apply}
            disabled={!fixed && (!canApply || !sourceReady)}
            variant={'solid'}
            colorScheme={'lightBlue-mint'}
            size={'sm'}
            className={'flex-1 rounded-[.9375rem]'}
          >
            {fixed ? 'Done' : 'Apply'}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function Empty({text}: CoinControlEmptyProps): React.JSX.Element {
  return <div className={'dash-block rounded-[.75rem] p-4'}><Text size={12} weight={'medium'} color={'brand'} opacity={50}>{text}</Text></div>
}

function InputDetails({label, amount, children}: CoinControlInputDetailsProps): React.JSX.Element {
  return (
    <span className={'min-w-0 flex-1 flex flex-col gap-1.5 text-left'}>
      <span className={'flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1'}>
        <Text reset size={12} weight={'medium'} color={'brand'} opacity={50}>{label}</Text>
        <Text reset size={14} weight={'extrabold'} color={'brand'} className={'ml-auto text-right tabular-nums'}>{amount}</Text>
      </span>
      <span className={'flex flex-col gap-1'}>{children}</span>
    </span>
  )
}

function CheckRow({checked, onChange, children, disabled = false, bare = false}: CoinControlCheckRowProps): React.JSX.Element {
  let rowClass = ''
  if (!bare) rowClass = `rounded-[.75rem] p-3 ${checked ? 'dash-block-accent-5' : 'dash-block'}`
  return (
    <div className={`min-w-0 ${rowClass} ${disabled ? 'opacity-40' : ''}`}>
      <Checkbox className={'min-w-0 w-full'} checked={checked} onChange={next => !disabled && onChange(next)} label={<span className={'min-w-0 flex-1 flex items-center gap-2.5'}>{children}</span>} />
    </div>
  )
}
