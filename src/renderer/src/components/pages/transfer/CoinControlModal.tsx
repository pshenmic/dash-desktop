import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTheme } from 'dash-ui-kit/react'
import { Button, CreditsIcon, CrossIcon, ShieldSmallIcon, Text } from '@renderer/components/dash-ui-kit-enxtended'
import { DashLogo } from 'dash-ui-kit/react'
import Checkbox from '@renderer/components/ui/Checkbox'
import CreditsAmount from '@renderer/components/ui/CreditsAmount'
import type { PlatformAddressDto, SelectableUtxo, ShieldedNoteInfo, WalletAddressDto } from '@renderer/api/types'
import { CORE_DUST_FILTER_DUFFS } from '@renderer/constants/core'
import { PLATFORM_DUST_FILTER_CREDITS, PLATFORM_INPUT_LIMIT } from '@renderer/constants/platform'
import { SHIELDED_DUST_FILTER_CREDITS, SHIELDED_NOTE_LIMIT } from '@renderer/constants/shielded'
import { SourceKind } from '@renderer/enums/SourceKind'
import { TransferOperation } from '@renderer/enums/TransferOperation'
import { CoinControlMode } from '@renderer/enums/CoinControlMode'
import type { CoinControlSelection } from '@renderer/types/CoinControl'
import { automaticCoinControl, coinControlSourceKind, outpointKey } from '@renderer/utils/coinControl'
import { creditsToDuffs, davToDashCompact } from '@renderer/utils/balance'
import { shieldedBalancesByAddress } from '@renderer/utils/shieldedBalances'

const FIXED_SOURCE_COPY: Partial<Record<TransferOperation, {title: string; description: string}>> = {
  [TransferOperation.Shield]: {
    title: 'Selected Platform address',
    description: 'Shielding spends one source address as a single input. Change it in the From field.',
  },
  [TransferOperation.IdentityCreateFromShielded]: {
    title: 'Automatic shielded selection',
    description: 'Manual note selection is not available for identity creation from the shielded pool.',
  },
}

const INPUT_MODE_LABEL: Record<SourceKind, string> = {
  [SourceKind.Core]: 'UTXOs',
  [SourceKind.PlatformAddress]: 'Inputs',
  [SourceKind.Identity]: 'Inputs',
  [SourceKind.Shielded]: 'Notes',
}

interface CoinControlModalProps {
  isOpen: boolean
  operation: TransferOperation | null
  selection: CoinControlSelection
  coreAddresses: WalletAddressDto[]
  utxos: SelectableUtxo[]
  utxosLoading: boolean
  utxosError: string | null
  coreSyncIncomplete: boolean
  platformAddresses: PlatformAddressDto[]
  shieldedNotes: ShieldedNoteInfo[]
  identityLabel: string | null
  identityId: string | null
  platformAddress: PlatformAddressDto | undefined
  onRetryUtxos: () => void
  onClose: () => void
  onApply: (selection: CoinControlSelection) => void
}

export default function CoinControlModal({
  isOpen,
  operation,
  selection,
  coreAddresses,
  utxos,
  utxosLoading,
  utxosError,
  coreSyncIncomplete,
  platformAddresses,
  shieldedNotes,
  identityLabel,
  identityId,
  platformAddress,
  onRetryUtxos,
  onClose,
  onApply,
}: CoinControlModalProps): React.JSX.Element | null {
  const {theme} = useTheme()
  const [draft, setDraft] = useState<CoinControlSelection>(selection)
  const [filterDust, setFilterDust] = useState(false)
  const [onlySelected, setOnlySelected] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setDraft(selection)
    setOnlySelected(false)
  }, [isOpen, selection])

  if (!isOpen || operation == null) return null

  const sourceKind = coinControlSourceKind(operation)
  const shieldedBalances = shieldedBalancesByAddress(shieldedNotes)
  const shieldedAddresses = [...shieldedBalances.keys()]
  const nonDustShieldedAddresses = [...shieldedBalances.entries()]
    .filter(([, credits]) => credits >= SHIELDED_DUST_FILTER_CREDITS)
    .map(([address]) => address)
  const visibleShieldedAddresses = filterDust ? nonDustShieldedAddresses : shieldedAddresses
  const nonDustShieldedNotes = shieldedNotes.filter(note => note.amount >= SHIELDED_DUST_FILTER_CREDITS)
  const visibleShieldedNotes = filterDust ? nonDustShieldedNotes : shieldedNotes
  const nonDustCoreAddresses = coreAddresses.filter(address => address.balance >= CORE_DUST_FILTER_DUFFS)
  const visibleCoreAddresses = filterDust ? nonDustCoreAddresses : coreAddresses
  const nonDustUtxos = utxos.filter(utxo => utxo.satoshis >= CORE_DUST_FILTER_DUFFS)
  const visibleUtxos = filterDust ? nonDustUtxos : utxos
  const selectedOutpoints = draft.kind === 'coreOutpoints' ? new Set(draft.outpoints) : new Set<string>()
  const selectedUtxos = visibleUtxos.filter(utxo => selectedOutpoints.has(outpointKey(utxo)))
  const selectedDuffs = selectedUtxos.reduce((sum, utxo) => sum + utxo.satoshis, 0n)
  const displayedUtxos = onlySelected && selectedUtxos.length > 0 ? selectedUtxos : visibleUtxos

  const nonDustPlatformAddresses = platformAddresses.filter(address => address.balanceCredits >= PLATFORM_DUST_FILTER_CREDITS)
  const visiblePlatformAddresses = filterDust ? nonDustPlatformAddresses : platformAddresses
  const selectedPlatformInputs = draft.kind === 'platformInputs' ? draft.inputs : []
  const selectedPlatformAddresses = new Set(selectedPlatformInputs.map(input => input.address))
  const displayedPlatformAddresses = onlySelected && selectedPlatformInputs.length > 0
    ? visiblePlatformAddresses.filter(address => selectedPlatformAddresses.has(address.platformAddress))
    : visiblePlatformAddresses
  const selectedPlatformCredits = selectedPlatformInputs.reduce((sum, input) => sum + input.credits, 0n)

  const selectedNoteIndexes = draft.kind === 'shieldedNotes' ? new Set(draft.noteIndexes) : new Set<number>()
  const selectedShieldedNotes = visibleShieldedNotes.filter(note => selectedNoteIndexes.has(note.index))
  const displayedShieldedNotes = onlySelected && selectedShieldedNotes.length > 0
    ? selectedShieldedNotes
    : visibleShieldedNotes
  const selectedShieldedCredits = selectedShieldedNotes.reduce((sum, note) => sum + note.amount, 0n)

  let selectedCount = 0
  let selectedAmountDuffs = 0n
  let selectedItemSingular = 'input'
  let selectedItemPlural = 'inputs'
  switch (sourceKind) {
    case SourceKind.Core:
      selectedCount = selectedUtxos.length
      selectedAmountDuffs = selectedDuffs
      selectedItemSingular = 'UTXO'
      selectedItemPlural = 'UTXOs'
      break
    case SourceKind.PlatformAddress:
      selectedCount = selectedPlatformInputs.length
      selectedAmountDuffs = creditsToDuffs(selectedPlatformCredits)
      break
    case SourceKind.Shielded:
      selectedCount = selectedShieldedNotes.length
      selectedAmountDuffs = creditsToDuffs(selectedShieldedCredits)
      selectedItemSingular = 'note'
      selectedItemPlural = 'notes'
      break
  }
  const selectedItemLabel = selectedCount === 1 ? selectedItemSingular : selectedItemPlural

  const platformInputsValid = draft.kind !== 'platformInputs' || (
    draft.inputs.length > 0
    && draft.inputs.length <= PLATFORM_INPUT_LIMIT
    && draft.inputs.some(input => input.address === draft.feeAddress)
    && draft.inputs.every(input => {
      const address = platformAddresses.find(entry => entry.platformAddress === input.address)
      return address != null && input.credits > 0n && input.credits <= address.balanceCredits
    })
  )
  let canApply = false
  switch (draft.kind) {
    case 'automatic':
      canApply = true
      break
    case 'coreAddress':
      canApply = coreAddresses.some(entry => entry.address === draft.address)
      break
    case 'coreOutpoints':
      canApply = draft.outpoints.length > 0
        && draft.outpoints.every(outpoint => utxos.some(utxo => outpointKey(utxo) === outpoint))
      break
    case 'platformAddress':
      canApply = platformAddresses.some(entry => entry.platformAddress === draft.address)
      break
    case 'platformInputs':
      canApply = platformInputsValid
      break
    case 'shieldedAddress':
      canApply = shieldedAddresses.includes(draft.address)
      break
    case 'shieldedNotes':
      canApply = draft.noteIndexes.length > 0
        && draft.noteIndexes.length <= SHIELDED_NOTE_LIMIT
        && draft.noteIndexes.every(index => shieldedNotes.some(note => note.index === index))
      break
  }

  const chooseMode = (nextMode: CoinControlMode): void => {
    setOnlySelected(false)
    if (nextMode === CoinControlMode.Automatic) {
      setDraft(automaticCoinControl())
      return
    }

    switch (sourceKind) {
      case SourceKind.Core:
        if (nextMode === CoinControlMode.Address) {
          setDraft({kind: 'coreAddress', address: visibleCoreAddresses[0]?.address ?? ''})
        } else {
          setDraft({kind: 'coreOutpoints', outpoints: []})
        }
        break
      case SourceKind.PlatformAddress:
        if (nextMode === CoinControlMode.Address) {
          setDraft({kind: 'platformAddress', address: visiblePlatformAddresses[0]?.platformAddress ?? ''})
        } else {
          setDraft({kind: 'platformInputs', inputs: [], feeAddress: ''})
        }
        break
      case SourceKind.Shielded:
        if (nextMode === CoinControlMode.Address) {
          setDraft({kind: 'shieldedAddress', address: visibleShieldedAddresses[0] ?? ''})
        } else {
          setDraft({kind: 'shieldedNotes', noteIndexes: []})
        }
        break
    }
  }

  let mode = CoinControlMode.Inputs
  switch (draft.kind) {
    case 'automatic':
      mode = CoinControlMode.Automatic
      break
    case 'coreAddress':
    case 'platformAddress':
    case 'shieldedAddress':
      mode = CoinControlMode.Address
      break
  }

  const modeButton = (value: CoinControlMode, label: string): React.JSX.Element => (
    <button
      type={'button'}
      onClick={() => chooseMode(value)}
      className={`flex-1 rounded-[.75rem] px-3 py-2 cursor-pointer transition-colors ${mode === value ? 'dash-bg-inverse' : 'dash-block hover:dash-block-accent-10'}`}
    >
      <Text size={12} weight={'extrabold'} color={mode === value ? 'blue-mint' : 'brand'}>{label}</Text>
    </button>
  )

  const fixed = sourceKind == null
  const inputModeLabel = sourceKind == null ? 'Inputs' : INPUT_MODE_LABEL[sourceKind]
  const fixedCopy = FIXED_SOURCE_COPY[operation] ?? {
    title: 'Selected identity',
    description: 'Identity operations spend the selected identity balance. Change it in the From field.',
  }
  let fixedValue = identityLabel ?? identityId ?? 'No identity selected'
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
      case 'coreAddress':
        if (!nonDustCoreAddresses.some(address => address.address === draft.address)) {
          setDraft({kind: 'coreAddress', address: nonDustCoreAddresses[0]?.address ?? ''})
        }
        break
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
      case 'platformAddress':
        if (!nonDustPlatformAddresses.some(address => address.platformAddress === draft.address)) {
          setDraft({kind: 'platformAddress', address: nonDustPlatformAddresses[0]?.platformAddress ?? ''})
        }
        break
      case 'platformInputs': {
        const visibleAddresses = new Set(nonDustPlatformAddresses.map(address => address.platformAddress))
        const inputs = draft.inputs.filter(input => visibleAddresses.has(input.address))
        let feeAddress = draft.feeAddress
        if (!inputs.some(input => input.address === feeAddress)) feeAddress = inputs[0]?.address ?? ''
        if (inputs.length === 0) setOnlySelected(false)
        setDraft({kind: 'platformInputs', inputs, feeAddress})
        break
      }
      case 'shieldedAddress':
        if (!nonDustShieldedAddresses.includes(draft.address)) {
          setDraft({kind: 'shieldedAddress', address: nonDustShieldedAddresses[0] ?? ''})
        }
        break
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

  const setPlatformInputCredits = (address: string, value: string): void => {
    const credits = BigInt(value.replace(/\D/g, '') || '0')
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
    onApply(draft)
    onClose()
  }

  return createPortal(
    <div className={'fixed inset-0 z-99 bg-black/64 flex items-center justify-center overlay-fade-in'} role={'dialog'} aria-modal={'true'} aria-labelledby={'coin-control-title'}>
      <div className={'w-full max-w-170 max-h-[calc(100vh-3rem)] overflow-clip rounded-3xl bg-white dark:bg-white/12 p-6 dark:backdrop-blur-[2rem] modal-fade-in flex flex-col'}>
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

        <div className={'mt-5 min-h-0 max-h-[calc(100vh-15rem)] overflow-y-auto scrollbar-hide'}>
          {fixed ? (
            <div className={'dash-block rounded-[.9375rem] p-4'}>
              <Text size={12} weight={'medium'} color={'brand'} opacity={50}>{fixedCopy.title}</Text>
              <Text size={14} weight={'medium'} color={'brand'} className={'mt-2 block font-mono break-all'}>{fixedValue}</Text>
              <Text size={12} weight={'medium'} color={'brand'} opacity={50} className={'mt-3 block leading-[140%]'}>
                {fixedCopy.description}
              </Text>
            </div>
          ) : (
            <>
              <div className={'flex gap-2'}>
                {modeButton(CoinControlMode.Automatic, 'Automatic')}
                {modeButton(CoinControlMode.Address, 'One address')}
                {modeButton(CoinControlMode.Inputs, inputModeLabel)}
              </div>

              {sourceKind != null && mode !== CoinControlMode.Automatic && (
                <div className={'mt-4 flex min-h-7 items-center justify-between gap-3'}>
                  {mode === CoinControlMode.Inputs && (
                    <div className={'flex items-center gap-3'}>
                      <Text size={12} weight={'medium'} color={'brand'} opacity={50}>
                        Selected: {selectedCount} {selectedItemLabel} · {davToDashCompact(selectedAmountDuffs)} Dash
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

              {mode === CoinControlMode.Address && sourceKind === SourceKind.Core && (
                <div className={'mt-4 flex flex-col gap-1'}>
                  {coreAddresses.length === 0 && <Empty text={'No funded Core addresses'} />}
                  {coreAddresses.length > 0 && visibleCoreAddresses.length === 0 && (
                    <Empty text={'All Core addresses are below the dust threshold.'} />
                  )}
                  {visibleCoreAddresses.map(entry => (
                    <ChoiceRow key={entry.address} checked={draft.kind === 'coreAddress' && draft.address === entry.address} onChange={() => setDraft({kind: 'coreAddress', address: entry.address})}>
                      <DashLogo size={18} className={'shrink-0'} />
                      <AddressValue address={entry.address} detail={`${davToDashCompact(entry.balance)} Dash`} />
                    </ChoiceRow>
                  ))}
                </div>
              )}

              {mode === CoinControlMode.Address && sourceKind === SourceKind.PlatformAddress && (
                <div className={'mt-4 flex flex-col gap-1'}>
                  {platformAddresses.length === 0 && <Empty text={'No funded Platform addresses'} />}
                  {platformAddresses.length > 0 && visiblePlatformAddresses.length === 0 && (
                    <Empty text={'All Platform addresses are below the dust threshold.'} />
                  )}
                  {visiblePlatformAddresses.map(entry => (
                    <ChoiceRow key={entry.platformAddress} checked={draft.kind === 'platformAddress' && draft.address === entry.platformAddress} onChange={() => setDraft({kind: 'platformAddress', address: entry.platformAddress})}>
                      <CreditsIcon size={18} className={'shrink-0'} />
                      <AddressValue address={entry.platformAddress} detail={<CreditsAmount credits={entry.balanceCredits} />} />
                    </ChoiceRow>
                  ))}
                </div>
              )}

              {mode === CoinControlMode.Address && sourceKind === SourceKind.Shielded && (
                <div className={'mt-4 flex flex-col gap-1'}>
                  {shieldedAddresses.length === 0 && <Empty text={'No spendable shielded addresses'} />}
                  {shieldedAddresses.length > 0 && visibleShieldedAddresses.length === 0 && (
                    <Empty text={'All shielded addresses are below the dust threshold.'} />
                  )}
                  {visibleShieldedAddresses.map(address => {
                    const total = shieldedBalances.get(address) ?? 0n
                    return (
                      <ChoiceRow key={address} checked={draft.kind === 'shieldedAddress' && draft.address === address} onChange={() => setDraft({kind: 'shieldedAddress', address})}>
                        <ShieldSmallIcon size={16} className={'shrink-0 text-dash-brand dark:text-dash-mint'} />
                        <AddressValue address={address} detail={<CreditsAmount credits={total} />} />
                      </ChoiceRow>
                    )
                  })}
                </div>
              )}

              {mode === CoinControlMode.Inputs && sourceKind === SourceKind.Core && (
                <div className={'mt-4 flex flex-col gap-1'}>
                  {coreSyncIncomplete && <Empty text={'Wallet sync must finish before UTXOs can be listed.'} />}
                  {!coreSyncIncomplete && utxosLoading && <Empty text={'Loading spendable UTXOs…'} />}
                  {!coreSyncIncomplete && !utxosLoading && utxosError != null && (
                    <div role={'alert'} className={'dash-block rounded-[.75rem] p-4'}>
                      <Text size={12} weight={'medium'} color={'red'} className={'break-all'}>{utxosError}</Text>
                      <button
                        type={'button'}
                        onClick={onRetryUtxos}
                        className={'mt-3 cursor-pointer hover:opacity-70 transition-opacity'}
                      >
                        <Text size={12} weight={'extrabold'} color={'blue-mint'}>Try again</Text>
                      </button>
                    </div>
                  )}
                  {!coreSyncIncomplete && !utxosLoading && utxosError == null && utxos.length === 0 && <Empty text={'No spendable UTXOs'} />}
                  {!coreSyncIncomplete && !utxosLoading && utxosError == null && utxos.length > 0 && visibleUtxos.length === 0 && (
                    <Empty text={'All UTXOs are below the dust threshold.'} />
                  )}
                  {!coreSyncIncomplete && !utxosLoading && utxosError == null && displayedUtxos.map(utxo => {
                    const key = outpointKey(utxo)
                    const checked = draft.kind === 'coreOutpoints' && draft.outpoints.includes(key)
                    return (
                      <CheckRow key={key} checked={checked} onChange={next => toggleCoreOutpoint(key, next)}>
                        <DashLogo size={18} className={'shrink-0'} />
                        <AddressValue address={`${utxo.txid.slice(0, 16)}…:${utxo.vout}`} detail={`${davToDashCompact(utxo.satoshis)} Dash · ${utxo.address.slice(0, 12)}…${utxo.height === 0 ? ' · pending' : ''}`} />
                      </CheckRow>
                    )
                  })}
                </div>
              )}

              {mode === CoinControlMode.Inputs && sourceKind === SourceKind.PlatformAddress && (
                <div className={'mt-4 flex flex-col gap-1'}>
                  <Text size={12} weight={'medium'} color={'brand'} opacity={50} className={'mb-1'}>Up to {PLATFORM_INPUT_LIMIT} inputs. Set the maximum credits available from each.</Text>
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
                          <AddressValue address={entry.platformAddress} detail={<CreditsAmount credits={entry.balanceCredits} />} />
                        </CheckRow>
                        {selected && (
                          <div className={'mt-3 ml-7 grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1'}>
                            <label
                              htmlFor={`coin-control-credits-${entry.platformAddress}`}
                              className={'col-start-1 row-start-1'}
                            >
                              <Text size={10} weight={'medium'} color={invalid ? 'red' : 'brand'} opacity={invalid ? 100 : 50}>Credits from this input</Text>
                            </label>
                            <input
                              id={`coin-control-credits-${entry.platformAddress}`}
                              type={'text'}
                              inputMode={'numeric'}
                              value={selected.credits === 0n ? '' : selected.credits.toString()}
                              onChange={event => setPlatformInputCredits(entry.platformAddress, event.target.value)}
                              className={`col-start-1 row-start-2 w-full rounded-[.625rem] px-3 py-2 dash-input-block dash-text-default outline-none text-[.75rem] font-mono ${invalid ? 'ring-1 ring-dash-red' : ''}`}
                            />
                            <label className={'col-start-2 row-start-2 self-center flex items-center gap-1.5 cursor-pointer select-none shrink-0'}>
                              <input
                                type={'radio'}
                                checked={draft.kind === 'platformInputs' && draft.feeAddress === entry.platformAddress}
                                onChange={() => setDraft({kind: 'platformInputs', inputs: selectedPlatformInputs, feeAddress: entry.platformAddress})}
                                className={'accent-dash-brand dark:accent-dash-mint'}
                              />
                              <Text size={12} weight={'medium'} color={'brand'}>Pays fee</Text>
                            </label>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {mode === CoinControlMode.Inputs && sourceKind === SourceKind.Shielded && (
                <div className={'mt-4 flex flex-col gap-1'}>
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
                        <AddressValue address={`note #${note.index}`} detail={<><CreditsAmount credits={note.amount} /> · {note.address.slice(0, 14)}…</>} />
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
            disabled={!fixed && !canApply}
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

function Empty({text}: {text: string}): React.JSX.Element {
  return <div className={'dash-block rounded-[.75rem] p-4'}><Text size={12} weight={'medium'} color={'brand'} opacity={50}>{text}</Text></div>
}

function AddressValue({address, detail}: {address: string; detail: React.ReactNode}): React.JSX.Element {
  return (
    <span className={'min-w-0 flex flex-col items-start'}>
      <Text reset size={12} weight={'medium'} color={'brand'} className={'font-mono break-all text-left'}>{address}</Text>
      <Text size={12} weight={'medium'} color={'brand'} opacity={50} className={'text-left'}>{detail}</Text>
    </span>
  )
}

function ChoiceRow({checked, onChange, children}: {checked: boolean; onChange: () => void; children: React.ReactNode}): React.JSX.Element {
  return (
    <label className={`flex items-center gap-2.5 rounded-[.75rem] p-3 cursor-pointer ${checked ? 'dash-block-accent-5' : 'dash-block'}`}>
      <input type={'radio'} checked={checked} onChange={onChange} className={'accent-dash-brand dark:accent-dash-mint'} />
      {children}
    </label>
  )
}

function CheckRow({checked, onChange, children, disabled = false, bare = false}: {checked: boolean; onChange: (checked: boolean) => void; children: React.ReactNode; disabled?: boolean; bare?: boolean}): React.JSX.Element {
  let rowClass = ''
  if (!bare) rowClass = `rounded-[.75rem] p-3 ${checked ? 'dash-block-accent-5' : 'dash-block'}`
  return (
    <div className={`${rowClass} ${disabled ? 'opacity-40' : ''}`}>
      <Checkbox checked={checked} onChange={next => !disabled && onChange(next)} label={<span className={'flex items-center gap-2.5 min-w-0'}>{children}</span>} />
    </div>
  )
}
