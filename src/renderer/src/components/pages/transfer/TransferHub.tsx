import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { DashLogo } from "dash-ui-kit/react";
import { Text, ShieldSmallIcon, SettingsIcon } from "@renderer/components/dash-ui-kit-enxtended";
import P2pSyncAlert from "@renderer/components/ui/P2pSyncAlert";
import ShieldedNotesAlert from "@renderer/components/ui/ShieldedNotesAlert";
import CreditsAmount from "@renderer/components/ui/CreditsAmount";
import Checkbox from "@renderer/components/ui/Checkbox";
import PlatformRecipientsTest from "./PlatformRecipientsTest";
import CoreRecipientsTest from "./CoreRecipientsTest";
import ShieldedRecipientsTest from "./ShieldedRecipientsTest";
import { PLATFORM_RECIPIENT_LIMIT } from "@renderer/constants/platform";
import { CORE_RECIPIENT_LIMIT } from "@renderer/constants/core";
import { SHIELDED_RECIPIENT_LIMIT } from "@renderer/constants/shielded";
import ProverPill from "@renderer/components/pages/shielded/ProverPill";
import Spinner from "@renderer/components/ui/Spinner";
import { useAuth } from "@renderer/contexts/AuthContext";
import { useConnectionModeContext } from "@renderer/contexts/ConnectionModeContext";
import { useFiat } from "@renderer/hooks/useFiat";
import { useWalletBalance, refreshBalance } from "@renderer/hooks/useWalletBalance";
import { refreshTransactions } from "@renderer/hooks/useWalletTransactions";
import { usePlatformAddresses, refreshPlatformAddresses } from "@renderer/hooks/usePlatformAddresses";
import { useAdresses } from "@renderer/hooks/useAdresses";
import { useIdentities, prefetchIdentities } from "@renderer/hooks/useIdentities";
import { useShieldedStatus, useShieldedSyncState } from "@renderer/hooks/useShielded";
import { useOperationFee } from "@renderer/hooks/useOperationFee";
import { creditsToDuffs, davToDash, davToDashCompact, dashToDuffs, duffsToCredits } from "@renderer/utils/balance";
import { isValidDashAddress } from "@renderer/utils/address";
import { isValidPlatformAddress } from "@renderer/utils/platformAddress";
import { isLikelyShieldedAddress } from "@renderer/utils/shieldedAddress";
import { shieldedBalancesByAddress } from "@renderer/utils/shieldedBalances";
import { amountErrorFor } from "@renderer/utils/amountValidation";
import { isUnfinishedAssetLockFunding } from "@renderer/utils/identityRegistration";
import { clearSendDraft, getOrCreateSendDraft, saveSendDraft } from "@renderer/utils/sendDraft";
import {
  automaticCoinControl,
  normalizeCoinControlSelection,
  outpointKey,
  toCoreSpendSource,
  toPlatformSpendSource,
  toShieldedSpendSource,
} from "@renderer/utils/coinControl";
import {
  DESTINATION_KINDS,
  resolveOperation,
  unsupportedReason,
  operationInfo,
  isLikelyIdentityId,
  isPoolIdentityDenomination,
  POOL_IDENTITY_DENOMINATIONS,
} from "@renderer/utils/transferMatrix";
import { SourceKind } from "@renderer/enums/SourceKind";
import { DestinationKind } from "@renderer/enums/DestinationKind";
import { TransferOperation } from "@renderer/enums/TransferOperation";
import { ShieldedSyncPhase } from "@renderer/enums/ShieldedSyncPhase";
import { ShieldedSpendPhase } from "@renderer/enums/ShieldedSpendPhase";
import { AssetLockFundingPhase } from "@renderer/enums/AssetLockFundingPhase";
import { AssetLockFundingKind } from "@renderer/enums/AssetLockFundingKind";
import { API } from "@renderer/api";
import { AssetLockFundingState, PlatformAddressDto, SelectableUtxo, ShieldedNoteInfo, ShieldedSpendState, WalletAddressDto } from "@renderer/api/types";
import type { SendDraft } from "@renderer/types/SendDraft";
import type { CoinControlSelection } from "@renderer/types/CoinControl";
import { sendPageData, WITHDRAWAL_SUCCESS_NOTE } from "@renderer/constants";
import AmountField from "./AmountField";
import AmountSlider from "./AmountSlider";
import TransferWizard from "./TransferWizard";
import RecipientInput from "./RecipientInput";
import { SourcePicker, DestinationPicker } from "./EndpointPicker";
import CoinControlModal from "./CoinControlModal";
import TransferConfirmModal from "@renderer/components/modal/TransferConfirmModal";
import AssetLockFundingModal from "@renderer/components/modal/AssetLockFundingModal";
import SendConfirmModal from "@renderer/components/modal/SendConfirmModal";
import ShieldConfirmModal from "@renderer/components/modal/ShieldConfirmModal";
import ShieldedSpendModal from "@renderer/components/modal/ShieldedSpendModal";
import ShieldedUnlockModal from "@renderer/components/modal/ShieldedUnlockModal";
import DismissAssetLockFundingModal from "@renderer/components/modal/DismissAssetLockFundingModal";

export default function TransferHub(): React.JSX.Element {
  const { status } = useAuth()
  return <WalletTransferHub key={status?.selectedWalletId ?? 'no-wallet'} />
}

function WalletTransferHub(): React.JSX.Element {
  const { status } = useAuth()
  const walletId = status?.selectedWalletId ?? null
  const network = status?.network ?? null

  const [searchParams] = useSearchParams()
  const [draft, setDraftState] = useState<SendDraft>(() =>
    getOrCreateSendDraft(walletId, searchParams.get('from'), searchParams.get('to')))
  const draftRef = useRef(draft)
  const { fromKind, toKind, fromAddress, fromIdentity, toValue, amount, acked } = draft
  const updateDraft = (update: (current: SendDraft) => SendDraft): void => {
    const next = update(draftRef.current)
    draftRef.current = next
    setDraftState(next)
    if (walletId != null) saveSendDraft(walletId, next)
  }
  const setFromKind = (fromKind: SourceKind): void => updateDraft(current => ({ ...current, fromKind }))
  const setToKind = (toKind: DestinationKind): void => updateDraft(current => ({ ...current, toKind }))
  const setFromAddress = (fromAddress: string): void => updateDraft(current => ({ ...current, fromAddress }))
  const setFromIdentity = (fromIdentity: string): void => updateDraft(current => ({ ...current, fromIdentity }))
  const setToValue = (toValue: string): void => updateDraft(current => ({ ...current, toValue }))
  const setAmount = (amount: string): void => updateDraft(current => ({ ...current, amount }))
  const setAcked = (acked: boolean): void => updateDraft(current => ({ ...current, acked }))
  const [testRecipients, setTestRecipients] = useState<string[]>([])
  const [testCoreRecipients, setTestCoreRecipients] = useState<string[]>([])
  const [testShieldedRecipients, setTestShieldedRecipients] = useState<string[]>([])
  const [utxos, setUtxos] = useState<SelectableUtxo[]>([])
  const [coinControl, setCoinControl] = useState<CoinControlSelection>(automaticCoinControl)
  const [coinControlOpen, setCoinControlOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [notesUnlockOpen, setNotesUnlockOpen] = useState(false)
  const [wizardKey, setWizardKey] = useState(0)
  const [fundingRefresh, setFundingRefresh] = useState(0)
  const [resumableFunding, setResumableFunding] = useState<AssetLockFundingState | null>(null)
  const [resumeOpen, setResumeOpen] = useState(false)
  const [dismissConfirmOpen, setDismissConfirmOpen] = useState(false)
  const [dismissBusy, setDismissBusy] = useState(false)
  const [dismissError, setDismissError] = useState<string | null>(null)

  useEffect(() => {
    if (!walletId) return
    let dead = false
    API.getAssetLockFundingState(walletId)
      .then(state => {
        if (dead) return
        setResumableFunding(isUnfinishedAssetLockFunding(state.phase) ? state : null)
      })
      .catch(() => {})
    return () => { dead = true }
  }, [walletId, wizardKey, fundingRefresh])

  useEffect(() => {
    if (!walletId) return
    let dead = false
    API.getUtxos(walletId)
      .then(loaded => { if (!dead) setUtxos(loaded) })
      .catch(() => {})
    return () => { dead = true }
  }, [walletId, wizardKey])

  const dismissFunding = async (): Promise<void> => {
    if (!walletId || dismissBusy) return
    setDismissBusy(true)
    setDismissError(null)
    try {
      await API.dismissAssetLockFunding(walletId)
      setResumableFunding(null)
      setResumeOpen(false)
      setDismissConfirmOpen(false)
    } catch (error) {
      setDismissError(error instanceof Error ? error.message : 'Could not dismiss the pending funding.')
    } finally {
      setDismissBusy(false)
    }
  }

  const { syncIncomplete } = useConnectionModeContext()
  const { format: formatFiat, rateReady } = useFiat()
  const { balance } = useWalletBalance(walletId ?? undefined)
  const { receiving, change } = useAdresses(walletId ?? undefined)
  const { platformAddresses } = usePlatformAddresses(walletId ?? undefined)
  const { identities } = useIdentities(walletId ?? undefined)
  const shieldedSync = useShieldedSyncState(walletId)
  const prover = useShieldedStatus()

  const operation = resolveOperation(fromKind, toKind)
  const reason = unsupportedReason(fromKind, toKind)
  const info = operation ? operationInfo(operation) : null
  const shieldedInvolved = fromKind === SourceKind.Shielded || toKind === DestinationKind.Shielded
  const destinationKinds = useMemo(
    () => DESTINATION_KINDS.filter(d => d.kind !== DestinationKind.NewIdentity && resolveOperation(fromKind, d.kind) != null),
    [fromKind],
  )

  useEffect(() => {
    if (!destinationKinds.some(d => d.kind === toKind)) {
      setToKind(destinationKinds[0].kind)
      setToValue('')
      setAcked(false)
    }
  }, [destinationKinds, toKind])

  const fundedAddresses = useMemo(
    () => platformAddresses.filter(a => BigInt(a.balanceCredits) > 0n),
    [platformAddresses],
  )

  const defaultSource = useMemo(
    () => fundedAddresses.reduce<PlatformAddressDto | undefined>(
      (best, a) => (best == null || BigInt(a.balanceCredits) > BigInt(best.balanceCredits) ? a : best),
      undefined,
    ),
    [fundedAddresses],
  )

  const selectedSource = fundedAddresses.find(a => a.platformAddress === fromAddress) ?? defaultSource
  const selectedIdentity = identities.find(i => i.identifier === fromIdentity) ?? identities[0]

  const coreAddresses = useMemo(
    () => [...receiving, ...change]
      .filter(a => a.balance > 0n)
      .sort((a, b) => (a.balance < b.balance ? 1 : a.balance > b.balance ? -1 : 0)),
    [receiving, change],
  )
  const spendableNotes = useMemo(
    () => (shieldedSync.phase === ShieldedSyncPhase.Done ? shieldedSync.notes.filter(n => !n.spent) : [])
      .slice()
      .sort((a, b) => (BigInt(a.amount) < BigInt(b.amount) ? 1 : BigInt(a.amount) > BigInt(b.amount) ? -1 : 0)),
    [shieldedSync.phase, shieldedSync.notes],
  )
  const notesSyncing = shieldedSync.phase === ShieldedSyncPhase.Syncing || shieldedSync.phase === ShieldedSyncPhase.Recovering
  const shieldedAddressBalances = useMemo(() => shieldedBalancesByAddress(spendableNotes), [spendableNotes])
  const coinControlInventory = useMemo(() => ({
    coreAddresses: coreAddresses.map(address => address.address),
    coreOutpoints: utxos.map(outpointKey),
    platformBalances: Object.fromEntries(fundedAddresses.map(address => [address.platformAddress, address.balanceCredits])),
    shieldedAddresses: [...shieldedAddressBalances.keys()],
    shieldedNoteIndexes: spendableNotes.map(note => note.index),
  }), [coreAddresses, utxos, fundedAddresses, shieldedAddressBalances, spendableNotes])
  const appliedCoinControl = useMemo(
    () => normalizeCoinControlSelection(coinControl, operation, coinControlInventory),
    [coinControl, operation, coinControlInventory],
  )

  useEffect(() => {
    setCoinControl(automaticCoinControl())
  }, [operation])

  useEffect(() => {
    if (appliedCoinControl !== coinControl) setCoinControl(appliedCoinControl)
  }, [appliedCoinControl, coinControl])

  const coreSpendSource = useMemo(() => toCoreSpendSource(appliedCoinControl, utxos), [appliedCoinControl, utxos])
  const platformSource = useMemo(() => toPlatformSpendSource(appliedCoinControl), [appliedCoinControl])
  const shieldedSpendSource = useMemo(
    () => toShieldedSpendSource(appliedCoinControl, spendableNotes),
    [appliedCoinControl, spendableNotes],
  )
  let pickedUtxos: SelectableUtxo[] = []
  if (appliedCoinControl.kind === 'coreOutpoints') {
    pickedUtxos = utxos.filter(utxo => appliedCoinControl.outpoints.includes(outpointKey(utxo)))
  }
  let coreSpecificAddress: WalletAddressDto | undefined
  if (appliedCoinControl.kind === 'coreAddress') {
    coreSpecificAddress = coreAddresses.find(address => address.address === appliedCoinControl.address)
  }
  let selectedShieldedNotes: ShieldedNoteInfo[] | null = null
  if (appliedCoinControl.kind === 'shieldedNotes') {
    selectedShieldedNotes = spendableNotes.filter(note => appliedCoinControl.noteIndexes.includes(note.index))
  } else if (appliedCoinControl.kind === 'shieldedAddress') {
    selectedShieldedNotes = spendableNotes.filter(note => note.address === appliedCoinControl.address)
  }
  let fundingAddresses = fundedAddresses.map(address => address.platformAddress)
  if (appliedCoinControl.kind === 'platformInputs') {
    fundingAddresses = appliedCoinControl.inputs.map(input => input.address)
  } else if (appliedCoinControl.kind === 'platformAddress') {
    fundingAddresses = [appliedCoinControl.address]
  }

  let balanceDuffs = balance.dash.amount
  if (pickedUtxos.length > 0) {
    balanceDuffs = pickedUtxos.reduce((sum, utxo) => sum + utxo.satoshis, 0n)
  } else if (coreSpecificAddress) {
    balanceDuffs = coreSpecificAddress.balance
  }
  const shieldedBalance = shieldedSync.phase === ShieldedSyncPhase.Done && shieldedSync.balance !== null ? BigInt(shieldedSync.balance) : null

  let availableCredits: bigint | null = null
  if (fromKind === SourceKind.PlatformAddress) {
    if (operation === TransferOperation.Shield) {
      availableCredits = selectedSource?.balanceCredits ?? 0n
    } else if (appliedCoinControl.kind === 'platformInputs') {
      availableCredits = appliedCoinControl.inputs.reduce((sum, input) => sum + input.credits, 0n)
    } else if (appliedCoinControl.kind === 'platformAddress') {
      availableCredits = fundedAddresses.find(address => address.platformAddress === appliedCoinControl.address)?.balanceCredits ?? 0n
    } else {
      availableCredits = fundedAddresses.reduce((sum, address) => sum + address.balanceCredits, 0n)
    }
  } else if (fromKind === SourceKind.Identity) {
    availableCredits = selectedIdentity ? BigInt(String(selectedIdentity.balance.amount)) : 0n
  } else if (fromKind === SourceKind.Shielded) {
    availableCredits = selectedShieldedNotes == null
      ? shieldedBalance
      : selectedShieldedNotes.reduce((sum, note) => sum + note.amount, 0n)
  }

  const isCoreOperation = fromKind === SourceKind.Core
  const amountDuffs = useMemo(() => dashToDuffs(amount), [amount])
  const minCredits = info?.minCredits ?? 0n
  const trimmedTo = toValue.trim()

  const amountCredits = isCoreOperation ? 0n : duffsToCredits(amountDuffs)

  // TEST ONLY. The extra addresses join the one typed above, and the amount from
  // the amount step is split between them, so nothing else in the flow changes.
  const manyRecipients = operation === TransferOperation.AddressFundsTransfer && testRecipients.length > 0
  const recipientList = useMemo(
    () => {
      const addresses = [trimmedTo, ...testRecipients.map(entry => entry.trim())].filter(entry => entry.length > 0)
      const share = addresses.length === 0 ? 0n : amountCredits / BigInt(addresses.length)
      return addresses.map((address, index) => ({
        address,
        amountCredits: index === 0 ? amountCredits - share * BigInt(addresses.length - 1) : share,
      }))
    },
    [trimmedTo, testRecipients, amountCredits],
  )

  // TEST ONLY. The same split on L1, where each extra address is another output
  // paid by the same transaction.
  const manyCoreRecipients = operation === TransferOperation.CoreSend && testCoreRecipients.length > 0
  const coreRecipientList = useMemo(
    () => {
      const addresses = [trimmedTo, ...testCoreRecipients.map(entry => entry.trim())].filter(entry => entry.length > 0)
      const share = addresses.length === 0 ? 0n : amountDuffs / BigInt(addresses.length)
      return addresses.map((address, index) => ({
        address,
        amountDuffs: index === 0 ? amountDuffs - share * BigInt(addresses.length - 1) : share,
      }))
    },
    [trimmedTo, testCoreRecipients, amountDuffs],
  )

  // TEST ONLY. One bundle pays them all, so the split is the same as elsewhere.
  const manyShieldedRecipients = operation === TransferOperation.ShieldedTransfer && testShieldedRecipients.length > 0
  const shieldedRecipientList = useMemo(
    () => {
      const addresses = [trimmedTo, ...testShieldedRecipients.map(entry => entry.trim())].filter(entry => entry.length > 0)
      const share = addresses.length === 0 ? 0n : amountCredits / BigInt(addresses.length)
      return addresses.map((address, index) => ({
        address,
        amountCredits: index === 0 ? amountCredits - share * BigInt(addresses.length - 1) : share,
      }))
    },
    [trimmedTo, testShieldedRecipients, amountCredits],
  )

  const destinationValid = manyShieldedRecipients
    ? shieldedRecipientList.length === testShieldedRecipients.length + 1
      && shieldedRecipientList.every(entry => isLikelyShieldedAddress(entry.address))
    : manyRecipients
    ? recipientList.length === testRecipients.length + 1
      && recipientList.every(entry => isValidPlatformAddress(entry.address, network ?? undefined))
    : manyCoreRecipients
    ? coreRecipientList.length === testCoreRecipients.length + 1
      && coreRecipientList.every(entry => isValidDashAddress(entry.address, network ?? undefined))
    : toKind === DestinationKind.CoreAddress ? isValidDashAddress(trimmedTo, network ?? undefined)
    : toKind === DestinationKind.PlatformAddress ? isValidPlatformAddress(trimmedTo, network ?? undefined)
    : toKind === DestinationKind.Identity ? isLikelyIdentityId(trimmedTo)
    : toKind === DestinationKind.NewIdentity ? true
    : isLikelyShieldedAddress(trimmedTo)

  const { feeCredits, feeDuffs, maxDuffs, maxPerTx, noteLimit, loading: feeLoading, err: feeErr } = useOperationFee(walletId, operation, {
    destinationValid,
    recipient: manyRecipients ? recipientList.map(entry => entry.address)
      : manyCoreRecipients ? coreRecipientList.map(entry => entry.address)
      : manyShieldedRecipients ? shieldedRecipientList.map(entry => entry.address)
      : trimmedTo,
    amountCredits,
    amountDuffs: isCoreOperation ? amountDuffs : null,
    coreSource: coreSpendSource ?? null,
    platformSource,
    identityId: selectedIdentity?.identifier ?? null,
    shieldedSource: shieldedSpendSource ?? null,
  })

  // An L1 send pays its fee on top of the amount; an L1 -> L2 transfer locks the
  // L2 fee on top of that, so the amount typed is the amount that arrives.
  const totalFeeDuffs = feeDuffs === null ? 0n : feeDuffs + creditsToDuffs(feeCredits ?? 0n)

  // What the L1 selection can fund, less whatever the operation locks on L2.
  const coreMaxDuffs = useMemo((): bigint | null => {
    if (maxDuffs === null) return null
    const spendable = maxDuffs - creditsToDuffs(feeCredits ?? 0n)
    return spendable > 0n ? spendable : 0n
  }, [maxDuffs, feeCredits])

  const sliderMaxAmount = useMemo((): bigint | null => {
    if (isCoreOperation) return coreMaxDuffs
    if (maxPerTx !== null) return creditsToDuffs(maxPerTx > 0n ? maxPerTx : 0n)
    if (availableCredits === null || feeCredits === null) return null
    const spendable = availableCredits - feeCredits
    return creditsToDuffs(spendable > 0n ? spendable : 0n)
  }, [isCoreOperation, coreMaxDuffs, maxPerTx, availableCredits, feeCredits])

  const sliderPercent = useMemo(() => {
    if (sliderMaxAmount === null || sliderMaxAmount === 0n) return 0
    if (amountDuffs <= 0n) return 0
    if (amountDuffs >= sliderMaxAmount) return 100
    return Math.max(0, Math.min(100, Math.round(Number(amountDuffs) * 100 / Number(sliderMaxAmount))))
  }, [sliderMaxAmount, amountDuffs])

  const handleSliderPercent = (percent: number): void => {
    if (sliderMaxAmount === null) return
    const value = (sliderMaxAmount * BigInt(percent)) / 100n
    setAmount(davToDash(value))
  }

  const sourceReady =
    fromKind === SourceKind.Core ? true
    : fromKind === SourceKind.PlatformAddress ? selectedSource != null
    : fromKind === SourceKind.Identity ? selectedIdentity != null
    : true

  const selfSend =
    (operation === TransferOperation.AddressFundsTransfer && destinationValid
      && (manyRecipients ? recipientList : [{address: trimmedTo}]).some(entry => fundingAddresses.includes(entry.address)))
    || (operation === TransferOperation.IdentityToIdentity && destinationValid && selectedIdentity != null && trimmedTo === selectedIdentity.identifier)

  const destinationError = toKind === DestinationKind.NewIdentity || trimmedTo.length === 0
    ? null
    : !destinationValid
      ? (toKind === DestinationKind.CoreAddress ? `Enter a valid Dash ${network ?? ''} address.`
        : toKind === DestinationKind.PlatformAddress ? `Enter a valid Platform ${network ?? ''} address.`
        : toKind === DestinationKind.Identity ? 'Enter a valid identity identifier.'
        : 'Enter a valid shielded address.')
      : selfSend
        ? (operation === TransferOperation.IdentityToIdentity ? 'Recipient must be different from the source identity.' : 'Recipient must be different from the source address.')
        : null

  const needsAck = operation === TransferOperation.ShieldedWithdrawal
  const destinationReady = destinationValid && !selfSend && (!needsAck || acked)
  const coreSourceGated = fromKind === SourceKind.Core && syncIncomplete
  const routeReady = operation != null && sourceReady && destinationReady && !coreSourceGated

  const amountReady = isCoreOperation
    ? amountDuffs > 0n && coreMaxDuffs !== null && amountDuffs <= coreMaxDuffs
    : amountCredits >= minCredits && amountCredits > 0n
      && feeCredits !== null
      && availableCredits !== null && amountCredits + feeCredits <= availableCredits
      && (maxPerTx === null || amountCredits <= maxPerTx)
      && (operation !== TransferOperation.IdentityCreateFromShielded || isPoolIdentityDenomination(amountCredits))

  const canSubmit = routeReady && amountReady

  const amountFiat = rateReady && amountDuffs > 0n ? formatFiat(amountDuffs) : undefined

  const handleAmount = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const val = e.target.value.replace(/[^0-9.]/g, '')
    const parts = val.split('.')
    if (parts.length > 2) return
    if (parts[1] && parts[1].length > 8) return
    setAmount(val)
  }

  const handleMax = (): void => {
    if (isCoreOperation) {
      if (coreMaxDuffs !== null) setAmount(davToDash(coreMaxDuffs))
      return
    }
    if (maxPerTx !== null) {
      setAmount(davToDash(creditsToDuffs(maxPerTx > 0n ? maxPerTx : 0n)))
      return
    }
    if (availableCredits === null || feeCredits === null) return
    const spendable = availableCredits - feeCredits
    setAmount(davToDash(creditsToDuffs(spendable > 0n ? spendable : 0n)))
  }

  const destinationPlaceholder =
    toKind === DestinationKind.CoreAddress ? (network === 'mainnet' ? 'X… (Dash address)' : 'y… (Dash address)')
    : toKind === DestinationKind.PlatformAddress ? (network === 'mainnet' ? 'dash1…' : 'tdash1…')
    : toKind === DestinationKind.Identity ? 'Identity identifier'
    : 'shielded address'

  const amountError = amountErrorFor({
    isCoreOperation,
    amount,
    coreMaxDuffs,
    operation,
    amountDuffs,
    amountCredits,
    minCredits,
    availableCredits,
    feeCredits,
    maxPerTx,
    noteLimit,
  })
  const fieldError = amountError ?? feeErr
  let coinControlSummary = 'Automatic'
  switch (appliedCoinControl.kind) {
    case 'coreAddress':
      coinControlSummary = 'One Core address'
      break
    case 'coreOutpoints':
      coinControlSummary = appliedCoinControl.outpoints.length === 1 ? '1 coin' : `${appliedCoinControl.outpoints.length} coins`
      break
    case 'platformAddress':
      coinControlSummary = 'One Platform address'
      break
    case 'platformInputs':
      coinControlSummary = appliedCoinControl.inputs.length === 1 ? '1 input' : `${appliedCoinControl.inputs.length} inputs`
      break
    case 'shieldedAddress':
      coinControlSummary = 'One shielded address'
      break
    case 'shieldedNotes':
      coinControlSummary = appliedCoinControl.noteIndexes.length === 1 ? '1 note' : `${appliedCoinControl.noteIndexes.length} notes`
      break
    case 'automatic':
      if (operation === TransferOperation.Shield) {
        coinControlSummary = 'Fixed address'
      } else if (fromKind === SourceKind.Identity) {
        coinControlSummary = 'Fixed identity'
      }
      break
  }

  const resetForm = (): void => {
    setCoinControl(automaticCoinControl())
    setTestRecipients([])
    setTestCoreRecipients([])
    setTestShieldedRecipients([])
    const resetDraft = { ...draftRef.current, toValue: '', amount: '', acked: false }
    draftRef.current = resetDraft
    setDraftState(resetDraft)
    if (walletId) clearSendDraft(walletId)
    setWizardKey(k => k + 1)
    if (walletId) {
      refreshPlatformAddresses(walletId)
      prefetchIdentities(walletId)
    }
  }

  const routeStep = (
    <>
      <SourcePicker
        kind={fromKind}
        onKindChange={k => { setFromKind(k); setAcked(false); setCoinControl(automaticCoinControl()) }}
        platformAddresses={fundedAddresses}
        selectedPlatformAddress={selectedSource}
        onPlatformAddressChange={setFromAddress}
        showPlatformAddress={operation === TransferOperation.Shield}
        identities={identities}
        selectedIdentity={selectedIdentity}
        onIdentityChange={setFromIdentity}
      />

      {operation != null && (
        <button
          type={"button"}
          onClick={() => setCoinControlOpen(true)}
          className={"w-full flex items-center justify-between gap-3 px-4 py-3 rounded-[.875rem] dash-block hover:dash-block-accent-10 transition-colors cursor-pointer"}
        >
          <span className={"flex items-center gap-2"}>
            <SettingsIcon size={14} className={"dash-text-default"} />
            <Text size={12} weight={"extrabold"} color={"brand"}>Coin control</Text>
          </span>
          <Text size={12} weight={"medium"} color={"blue-mint"}>{coinControlSummary}</Text>
        </button>
      )}

      {operation === TransferOperation.CoreSend && (
        <CoreRecipientsTest addresses={testCoreRecipients} onChange={setTestCoreRecipients} maxRecipients={CORE_RECIPIENT_LIMIT - 1} />
      )}
      {operation === TransferOperation.AddressFundsTransfer && (
        <PlatformRecipientsTest addresses={testRecipients} onChange={setTestRecipients} maxRecipients={PLATFORM_RECIPIENT_LIMIT - 1} />
      )}
      {operation === TransferOperation.ShieldedTransfer && (
        <ShieldedRecipientsTest addresses={testShieldedRecipients} onChange={setTestShieldedRecipients} maxRecipients={SHIELDED_RECIPIENT_LIMIT - 1} />
      )}
      {fromKind === SourceKind.Shielded && (
        <ShieldedNotesAlert walletId={walletId} onSync={() => setNotesUnlockOpen(true)} syncing={notesSyncing} />
      )}

      {toKind === DestinationKind.CoreAddress && operation === TransferOperation.CoreSend ? (
        <div className={"flex flex-col gap-2"}>
          <DestinationPicker
            kind={toKind}
            kinds={destinationKinds}
            onKindChange={k => { setToKind(k); setToValue(''); setAcked(false) }}
            value={trimmedTo}
            onValueChange={setToValue}
            placeholder={destinationPlaceholder}
            error={destinationError}
            showValueInput={false}
          />
          <RecipientInput value={toValue} onChange={setToValue} data={sendPageData.recipient} />
          {destinationError && <Text size={12} weight={"medium"} color={"red"} className={"px-1"}>{destinationError}</Text>}
        </div>
      ) : (
        <DestinationPicker
          kind={toKind}
          kinds={destinationKinds}
          onKindChange={k => { setToKind(k); setToValue(''); setAcked(false) }}
          value={toValue}
          onValueChange={setToValue}
          placeholder={destinationPlaceholder}
          error={destinationError}
          showValueInput={operation != null}
        />
      )}

      {coreSourceGated && <P2pSyncAlert />}

      {reason && (
        <div className={"flex flex-col gap-[.375rem] p-[.875rem] rounded-[.9375rem] dash-block-3"}>
          <Text size={12} weight={"medium"} color={"brand"} opacity={60} className={"leading-[130%]"}>{reason}</Text>
        </div>
      )}

      {operation === TransferOperation.Unshield && (
        <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"px-1 leading-[130%]"}>
          Unshield moves credits from the pool to a transparent Platform address — the amount and destination become public.
        </Text>
      )}

      {operation === TransferOperation.AssetLockFunding && (
        <div className={"flex flex-col gap-[.375rem] p-[.875rem] rounded-[.9375rem] dash-block-3"}>
          <Text size={14} weight={"extrabold"} color={"brand"}>Two-step funding</Text>
          <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"leading-[130%]"}>
            Locking Dash for Platform credits broadcasts an L1 transaction, waits for a ChainLock (a few minutes) and then credits the address. The process resumes automatically if interrupted.
          </Text>
        </div>
      )}

      {operation === TransferOperation.AssetLockShield && (
        <div className={"flex flex-col gap-[.375rem] p-[.875rem] rounded-[.9375rem] dash-block-3"}>
          <Text size={14} weight={"extrabold"} color={"brand"}>Two-step shielding</Text>
          <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"leading-[130%]"}>
            Locking Dash broadcasts an L1 transaction, waits for a ChainLock (a few minutes) and then shields the credits straight into the recipient's shielded balance. The L1 lock amount stays publicly visible; the process resumes automatically if interrupted.
          </Text>
        </div>
      )}

      {operation === TransferOperation.IdentityRegister && (
        <div className={"flex flex-col gap-[.375rem] p-[.875rem] rounded-[.9375rem] dash-block-3"}>
          <Text size={14} weight={"extrabold"} color={"brand"}>New Platform identity</Text>
          <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"leading-[130%]"}>
            Locks Dash on L1 and registers a new identity funded with the locked amount as credits. The registration waits for the network to lock the transaction — usually seconds; the process resumes automatically if interrupted.
          </Text>
        </div>
      )}

      {operation === TransferOperation.IdentityTopUpL1 && (
        <div className={"flex flex-col gap-[.375rem] p-[.875rem] rounded-[.9375rem] dash-block-3"}>
          <Text size={14} weight={"extrabold"} color={"brand"}>Top up from L1</Text>
          <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"leading-[130%]"}>
            Locks Dash on L1 and credits the identity with the locked amount. You can top up any identity by its identifier — not just your own. The process resumes automatically if interrupted.
          </Text>
        </div>
      )}

      {(operation === TransferOperation.AddressWithdrawal || operation === TransferOperation.IdentityWithdrawal) && (
        <div className={"flex flex-col gap-[.375rem] p-[.875rem] rounded-[.9375rem] dash-block-3"}>
          <Text size={14} weight={"extrabold"} color={"brand"}>Cross-chain withdrawal</Text>
          <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"leading-[130%]"}>
            The Dash payout arrives asynchronously after the withdrawal is processed.
          </Text>
        </div>
      )}

      {operation === TransferOperation.IdentityCreateFromShielded && (
        <div className={"flex flex-col gap-[.375rem] p-[.875rem] rounded-[.9375rem] dash-block-3"}>
          <Text size={14} weight={"extrabold"} color={"brand"}>New identity from the pool</Text>
          <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"leading-[130%]"}>
            Creates a new Platform identity funded privately from your shielded balance. The protocol only allows fixed funding denominations, and the Platform fee is deducted from the chosen amount — the identity starts with slightly less. If creation fails on-chain, the credits are refunded to your Platform address.
          </Text>
        </div>
      )}

      {operation === TransferOperation.ShieldedWithdrawal && (
        <div className={"flex flex-col gap-[.375rem] p-[.875rem] rounded-[.9375rem] dash-block-3"}>
          <Text size={14} weight={"extrabold"} color={"brand"}>Output becomes public</Text>
          <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"leading-[130%]"}>
            The receiving Core address and the amount will be publicly visible on-chain once withdrawn. This breaks the privacy of the withdrawn funds.
          </Text>
          <Checkbox
            checked={acked}
            onChange={setAcked}
            label={<Text size={12} weight={"medium"} color={"brand"}>I understand the destination and amount will be public.</Text>}
            className={"mt-1"}
          />
        </div>
      )}
    </>
  )

  const amountStep = (
    <div>
      {operation === TransferOperation.IdentityCreateFromShielded && (
        <div className={"mb-3 flex flex-wrap gap-2"}>
          {POOL_IDENTITY_DENOMINATIONS.map(denomination => (
            <button
              key={denomination.toString()}
              type={"button"}
              onClick={() => setAmount(davToDash(creditsToDuffs(denomination)))}
              className={`px-4 py-2 rounded-[.75rem] cursor-pointer transition-opacity hover:opacity-90 ${amountCredits === denomination ? 'dash-bg-inverse' : 'dash-block-3'}`}
            >
              <Text size={12} weight={"extrabold"} color={amountCredits === denomination ? "blue-mint" : "brand"}>
                {davToDash(creditsToDuffs(denomination))} Dash
              </Text>
            </button>
          ))}
        </div>
      )}
      <AmountField
        value={amount}
        onChange={handleAmount}
        onMax={handleMax}
        unit={<DashLogo size={20} />}
      />
      {operation !== TransferOperation.IdentityCreateFromShielded && sliderMaxAmount !== null && (
        <AmountSlider
          percent={sliderPercent}
          onPercentChange={handleSliderPercent}
          disabled={sliderMaxAmount === 0n}
        />
      )}
      {fieldError && (
        <div className={"mt-2 px-1"}>
          <Text size={12} weight={"medium"} color={"red"}>{fieldError}</Text>
        </div>
      )}
      <div className={"mt-2 px-1 flex items-center justify-between gap-3"}>
        {isCoreOperation ? (
          <Text size={12} weight={"medium"} color={amountDuffs > 0n && amountDuffs > balanceDuffs ? "red" : "brand"} opacity={amountDuffs > 0n && amountDuffs > balanceDuffs ? 100 : 50}>
            {amountDuffs > 0n && amountDuffs > balanceDuffs ? 'Amount exceeds balance' : `Balance: ${davToDashCompact(balanceDuffs)} Dash`}
          </Text>
        ) : availableCredits !== null ? (
          <Text size={12} weight={"medium"} color={"brand"} opacity={50}>
            Available: <CreditsAmount credits={availableCredits} />
          </Text>
        ) : (
          <Text size={12} weight={"medium"} color={"brand"} opacity={50}>Sync notes on the Shielded page to see your balance</Text>
        )}
        {amountFiat && <Text size={12} weight={"medium"} color={"blue-mint"}>≈ {amountFiat}</Text>}
      </div>
      {isCoreOperation ? (
        <div className={"mt-2 px-1 flex items-center justify-between gap-3"}>
          <Text size={12} weight={"medium"} color={"brand"} opacity={50}>Network fee</Text>
          <Text size={12} weight={"medium"} color={"brand"}>{davToDash(totalFeeDuffs)} Dash</Text>
        </div>
      ) : (
        <div className={"mt-2 px-1 flex items-center justify-between gap-3"}>
          <Text size={12} weight={"medium"} color={"brand"} opacity={50}>Reserved for fee</Text>
          {feeErr === null && feeCredits !== null ? (
            <Text size={12} weight={"medium"} color={"brand"}><CreditsAmount credits={feeCredits} align={"end"} /></Text>
          ) : feeErr === null && feeLoading ? (
            <Spinner size={14} className={"text-dash-brand dark:text-dash-mint"} />
          ) : (
            <Text size={12} weight={"medium"} color={"brand"} opacity={50}>—</Text>
          )}
        </div>
      )}
    </div>
  )

  let fromDisplay = 'Your shielded balance'
  switch (fromKind) {
    case SourceKind.Core:
      fromDisplay = 'Dash Core (L1)'
      break
    case SourceKind.PlatformAddress:
      if (operation === TransferOperation.Shield) {
        fromDisplay = selectedSource?.platformAddress ?? ''
      } else if (appliedCoinControl.kind === 'platformAddress') {
        fromDisplay = appliedCoinControl.address
      } else if (appliedCoinControl.kind === 'platformInputs') {
        if (appliedCoinControl.inputs.length === 1) {
          fromDisplay = '1 Platform input'
        } else {
          fromDisplay = `${appliedCoinControl.inputs.length} Platform inputs`
        }
      } else {
        fromDisplay = 'Automatic Platform selection'
      }
      break
    case SourceKind.Identity:
      fromDisplay = selectedIdentity?.identifier ?? ''
      break
  }

  const toDisplay = toKind === DestinationKind.NewIdentity ? 'New identity' : trimmedTo

  const confirmStep = (
    <div className={"flex flex-col gap-3"}>
      <div className={"dash-block rounded-[.875rem] p-4 flex flex-col gap-3"}>
        <div className={"flex flex-col gap-1"}>
          <Text size={12} weight={"medium"} color={"brand"} opacity={50}>From</Text>
          <div className={"flex items-center gap-1.5"}>
            {fromKind === SourceKind.Shielded && <ShieldSmallIcon size={14} className={"text-dash-brand dark:text-dash-mint"} />}
            <Text size={14} weight={"medium"} color={"brand"} className={"font-mono break-all"}>{fromDisplay}</Text>
          </div>
        </div>
        <div className={"flex flex-col gap-1"}>
          <Text size={12} weight={"medium"} color={"brand"} opacity={50}>To</Text>
          <div className={"flex items-center gap-1.5"}>
            {toKind === DestinationKind.Shielded && <ShieldSmallIcon size={14} className={"text-dash-brand dark:text-dash-mint"} />}
            <Text size={14} weight={"medium"} color={"brand"} className={"font-mono break-all"}>{toDisplay}</Text>
          </div>
        </div>
      </div>
      <div className={"dash-block rounded-[.875rem] p-4 flex flex-col gap-2.5"}>
        <div className={"flex justify-between items-baseline gap-3"}>
          <Text size={12} weight={"medium"} color={"brand"} opacity={50}>Amount</Text>
          <Text size={14} weight={"medium"} color={"brand"}>
            {isCoreOperation ? `${davToDash(amountDuffs)} Dash` : <CreditsAmount credits={amountCredits} align={"end"} />}
          </Text>
        </div>
        {isCoreOperation ? (
          <>
            <div className={"flex justify-between items-baseline gap-3"}>
              <Text size={12} weight={"medium"} color={"brand"} opacity={50}>Network fee</Text>
              <Text size={14} weight={"medium"} color={"brand"}>{davToDash(totalFeeDuffs)} Dash</Text>
            </div>
            <div className={"h-px bg-dash-primary-dark-blue/8 dark:bg-white/10"} />
            <div className={"flex justify-between items-baseline gap-3"}>
              <Text size={12} weight={"medium"} color={"brand"} opacity={50}>Total</Text>
              <Text size={16} weight={"extrabold"} color={"brand"}>{davToDash(amountDuffs + totalFeeDuffs)} Dash</Text>
            </div>
          </>
        ) : feeCredits !== null && (
          <>
            <div className={"flex justify-between items-baseline gap-3"}>
              <Text size={12} weight={"medium"} color={"brand"} opacity={50}>Reserved for fee</Text>
              <Text size={14} weight={"medium"} color={"brand"}><CreditsAmount credits={feeCredits} align={"end"} /></Text>
            </div>
            <div className={"h-px bg-dash-primary-dark-blue/8 dark:bg-white/10"} />
            <div className={"flex justify-between items-baseline gap-3"}>
              <Text size={12} weight={"medium"} color={"brand"} opacity={50}>Total</Text>
              <Text size={16} weight={"extrabold"} color={"brand"}><CreditsAmount credits={amountCredits + feeCredits} align={"end"} /></Text>
            </div>
          </>
        )}
        {amountFiat && (
          <div className={"flex justify-between items-baseline gap-3"}>
            <Text size={12} weight={"medium"} color={"brand"} opacity={50}>≈ Fiat</Text>
            <Text size={12} weight={"medium"} color={"blue-mint"}>{amountFiat}</Text>
          </div>
        )}
      </div>
      {coreSourceGated && <P2pSyncAlert />}
    </div>
  )

  const startShieldedSpend = (password: string): Promise<ShieldedSpendState> => {
    if (!walletId) {
      return Promise.resolve<ShieldedSpendState>({ phase: ShieldedSpendPhase.Error, fetched: 0, total: 0, stHash: null, identityId: null, error: 'No wallet selected' })
    }
    if (operation === TransferOperation.ShieldedTransfer) {
      return API.startShieldedTransfer(
        walletId,
        manyShieldedRecipients ? shieldedRecipientList : [{ address: trimmedTo, amountCredits }],
        password,
        shieldedSpendSource,
      )
    }
    if (operation === TransferOperation.Unshield) return API.startShieldedUnshield(walletId, trimmedTo, amountCredits, password, shieldedSpendSource)
    if (operation === TransferOperation.IdentityCreateFromShielded) return API.startShieldedIdentityCreate(walletId, amountCredits, password)
    return API.startShieldedWithdrawal(walletId, trimmedTo, amountCredits, password, shieldedSpendSource)
  }

  const runPlatformOperation = (password: string) => {
    if (!walletId) return Promise.reject(new Error('No wallet selected'))
    if (operation === TransferOperation.AddressFundsTransfer) {
      return API.sendPlatformTransfer(
        walletId,
        platformSource,
        manyRecipients ? recipientList : [{ address: trimmedTo, amountCredits }],
        password,
      )
    }
    if (operation === TransferOperation.IdentityTopUp) {
      return API.topUpIdentityFromAddresses(walletId, trimmedTo, platformSource, amountCredits, password)
    }
    if (operation === TransferOperation.AddressWithdrawal) {
      return API.withdrawPlatformCredits(walletId, platformSource, trimmedTo, amountCredits, password)
    }
    if (operation === TransferOperation.IdentityToIdentity) {
      return API.transferIdentityCredits(walletId, selectedIdentity?.identifier ?? '', trimmedTo, amountCredits, password)
    }
    if (operation === TransferOperation.IdentityWithdrawal) {
      return API.withdrawIdentityCredits(walletId, selectedIdentity?.identifier ?? '', trimmedTo, amountCredits, password)
    }
    if (operation === TransferOperation.IdentityCreate) {
      return API.createIdentityFromAddresses(walletId, platformSource, amountCredits, password)
        .then(result => ({
          stHash: result.stHash,
          amountCredits: result.amountCredits,
          feeCredits: result.feeCredits,
          fromAddress: result.fromAddress,
          toAddress: result.identifier,
        }))
    }
    return API.sendIdentityCredits(walletId, selectedIdentity?.identifier ?? '', trimmedTo, amountCredits, password)
  }

  const isPlatformModalOperation = operation === TransferOperation.AddressFundsTransfer || operation === TransferOperation.IdentityTopUp
    || operation === TransferOperation.AddressWithdrawal || operation === TransferOperation.IdentityWithdrawal
    || operation === TransferOperation.IdentityToAddress || operation === TransferOperation.IdentityToIdentity || operation === TransferOperation.IdentityCreate
  const isShieldedSpendOperation = info?.spendKind != null

  return (
    <div className={"relative flex flex-col h-full pb-4"}>
      <div className={"flex items-end justify-between gap-6 px-12 pt-2"}>
        <div className={"flex flex-col gap-3"}>
          <Text size={40} weight={"medium"} color={"brand"} className={"leading-[125%] tracking-[-0.03em]"}>Send</Text>
          <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"leading-[120%] max-w-152.5"}>
            Move funds between your Dash Core, Platform addresses, identities and the shielded pool. Pick where the funds come from and where they go.
          </Text>
        </div>
        {shieldedInvolved && <ProverPill status={prover} />}
      </div>

      {resumableFunding && (
        <div className={"mx-12 mt-4 flex items-center justify-between gap-4 p-[.875rem] rounded-[.9375rem] dash-block-3"}>
          <div className={"flex flex-col gap-1 min-w-0"}>
            <Text size={14} weight={"extrabold"} color={"brand"}>
              {resumableFunding.kind === AssetLockFundingKind.Shielded ? 'Unfinished L1 shielding'
                : resumableFunding.kind === AssetLockFundingKind.Identity ? 'Unfinished identity registration'
                : resumableFunding.kind === AssetLockFundingKind.IdentityTopUp ? 'Unfinished identity top-up'
                : 'Unfinished Platform address funding'}
            </Text>
            <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"break-all leading-[130%]"}>
              {resumableFunding.amountDuffs ?? ''} duffs → {resumableFunding.kind === AssetLockFundingKind.Identity ? 'new identity' : (resumableFunding.toPlatformAddress ?? '')}
            </Text>
            {dismissError && <Text size={12} weight={"medium"} color={"red"}>{dismissError}</Text>}
          </div>
          <div className={"shrink-0 flex items-center gap-2"}>
            {resumableFunding.phase === AssetLockFundingPhase.Resumable && (
              <button
                type={"button"}
                onClick={() => {
                  setDismissError(null)
                  setDismissConfirmOpen(true)
                }}
                disabled={dismissBusy}
                className={"px-3 py-2 rounded-[.75rem] border border-red-300 dark:border-red-700 cursor-pointer hover:opacity-70 transition-opacity disabled:opacity-40 disabled:cursor-default"}
              >
                <span className={"flex items-center gap-1.5"}>
                  {dismissBusy && <Spinner size={12} className={"text-red-700 dark:text-red-400"} />}
                  <Text size={12} weight={"extrabold"} color={"red"}>{dismissBusy ? 'Dismissing…' : 'Dismiss'}</Text>
                </span>
              </button>
            )}
            <button
              type={"button"}
              onClick={() => setResumeOpen(true)}
              disabled={dismissBusy}
              className={"px-4 py-2 rounded-[.75rem] dash-bg-inverse cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-default"}
            >
              <Text size={12} weight={"extrabold"} color={"blue-mint"}>
                {resumableFunding.phase === AssetLockFundingPhase.Resumable ? 'Resume' : 'View progress'}
              </Text>
            </button>
          </div>
        </div>
      )}

      <TransferWizard
        key={wizardKey}
        steps={[
          { label: 'From & To', content: routeStep, canAdvance: routeReady },
          { label: 'Amount', content: amountStep, canAdvance: amountReady },
          { label: 'Confirm', content: confirmStep },
        ]}
        onSubmit={() => setConfirmOpen(true)}
        submitLabel={info?.submitLabel ?? 'Send'}
        submitDisabled={!canSubmit}
      />

      <CoinControlModal
        isOpen={coinControlOpen}
        operation={operation}
        selection={appliedCoinControl}
        coreAddresses={coreAddresses}
        utxos={utxos}
        platformAddresses={fundedAddresses}
        shieldedNotes={spendableNotes}
        identityLabel={selectedIdentity?.alias ?? null}
        identityId={selectedIdentity?.identifier ?? null}
        platformAddress={selectedSource}
        onClose={() => setCoinControlOpen(false)}
        onApply={setCoinControl}
      />

      {operation === TransferOperation.CoreSend && (
        <SendConfirmModal
          isOpen={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          walletId={walletId}
          network={network}
          recipients={coreRecipientList}
          amountFiat={amountFiat}
          source={coreSpendSource}
          onSuccess={() => {
            resetForm()
            if (walletId) {
              refreshBalance(walletId)
              refreshTransactions(walletId)
            }
          }}
        />
      )}

      {operation === TransferOperation.Shield && (
        <ShieldConfirmModal
          isOpen={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          walletId={walletId}
          fromAddress={selectedSource?.platformAddress ?? ''}
          toAddress={trimmedTo}
          amountCredits={amountCredits.toString()}
          feeCredits={feeCredits}
          proverReady={prover.ready}
          onSuccess={resetForm}
        />
      )}

      {isShieldedSpendOperation && (
        <ShieldedSpendModal
          isOpen={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          walletId={walletId}
          title={info?.title ?? 'Send'}
          toLabel={operation === TransferOperation.ShieldedTransfer ? 'To (shielded)' : operation === TransferOperation.Unshield ? 'To (Platform)' : operation === TransferOperation.IdentityCreateFromShielded ? 'Creates' : 'To (Core L1)'}
          toValue={operation === TransferOperation.IdentityCreateFromShielded ? 'New Platform identity with 6 keys' : trimmedTo}
          amountCredits={amountCredits.toString()}
          feeCredits={feeCredits}
          proverReady={prover.ready}
          start={startShieldedSpend}
          onSuccess={resetForm}
          successNote={operation === TransferOperation.ShieldedWithdrawal ? WITHDRAWAL_SUCCESS_NOTE : undefined}
        />
      )}

      {(operation === TransferOperation.AssetLockFunding || operation === TransferOperation.AssetLockShield || operation === TransferOperation.IdentityRegister || operation === TransferOperation.IdentityTopUpL1) && (
        <AssetLockFundingModal
          isOpen={confirmOpen}
          onClose={() => { setConfirmOpen(false); setFundingRefresh(n => n + 1) }}
          walletId={walletId}
          toPlatformAddress={operation === TransferOperation.IdentityRegister ? '' : trimmedTo}
          amountDuffs={amountDuffs.toString()}
          resume={false}
          kind={operation === TransferOperation.AssetLockShield ? AssetLockFundingKind.Shielded : operation === TransferOperation.IdentityRegister ? AssetLockFundingKind.Identity : operation === TransferOperation.IdentityTopUpL1 ? AssetLockFundingKind.IdentityTopUp : AssetLockFundingKind.Address}
          source={coreSpendSource}
          onSuccess={() => {
            resetForm()
            if (walletId) {
              refreshBalance(walletId)
              refreshTransactions(walletId)
            }
          }}
        />
      )}

      <AssetLockFundingModal
        isOpen={resumeOpen}
        onClose={() => setResumeOpen(false)}
        walletId={walletId}
        toPlatformAddress={resumableFunding?.toPlatformAddress ?? ''}
        amountDuffs={''}
        resume={true}
        kind={resumableFunding?.kind ?? AssetLockFundingKind.Address}
        onSuccess={() => {
          setResumableFunding(null)
          resetForm()
        }}
      />

      <DismissAssetLockFundingModal
        isOpen={dismissConfirmOpen}
        busy={dismissBusy}
        error={dismissError}
        onClose={() => {
          if (!dismissBusy) setDismissConfirmOpen(false)
        }}
        onConfirm={dismissFunding}
      />

      {isPlatformModalOperation && (
        <TransferConfirmModal
          isOpen={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          title={info?.title ?? 'Confirm transfer'}
          successTitle={operation === TransferOperation.IdentityCreate ? 'Identity created' : 'Credits sent'}
          rows={[
            {label: 'Amount', value: <CreditsAmount credits={amountCredits} align={"end"} />},
            ...(feeCredits !== null ? [{label: 'Reserved for fee', value: <CreditsAmount credits={feeCredits} align={"end"} />}] : []),
            {label: 'From', value: fromDisplay, mono: true},
            {label: 'To', value: toDisplay, mono: true},
          ]}
          run={runPlatformOperation}
          onSuccess={resetForm}
          successNote={operation === TransferOperation.AddressWithdrawal || operation === TransferOperation.IdentityWithdrawal ? WITHDRAWAL_SUCCESS_NOTE : undefined}
        />
      )}

      <ShieldedUnlockModal
        isOpen={notesUnlockOpen}
        onClose={() => setNotesUnlockOpen(false)}
        walletId={walletId}
      />
    </div>
  )
}
