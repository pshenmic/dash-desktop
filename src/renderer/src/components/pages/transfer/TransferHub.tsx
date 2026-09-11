import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { DashLogo } from "dash-ui-kit/react";
import { Text, ShieldSmallIcon, SettingsIcon } from "@renderer/components/dash-ui-kit-enxtended";
import P2pSyncAlert from "@renderer/components/ui/P2pSyncAlert";
import ShieldedNotesAlert from "@renderer/components/ui/ShieldedNotesAlert";
import CreditsAmount from "@renderer/components/ui/CreditsAmount";
import Checkbox from "@renderer/components/ui/Checkbox";
import ProverPill from "@renderer/components/pages/shielded/ProverPill";
import Spinner from "@renderer/components/ui/Spinner";
import { toast } from "@renderer/components/ui/Toast";
import { useAuth } from "@renderer/contexts/AuthContext";
import { useConnectionModeContext } from "@renderer/contexts/ConnectionModeContext";
import { useFiat } from "@renderer/hooks/useFiat";
import { useWalletBalance, refreshBalance } from "@renderer/hooks/useWalletBalance";
import { refreshTransactions } from "@renderer/hooks/useWalletTransactions";
import { usePlatformAddresses, refreshPlatformAddresses } from "@renderer/hooks/usePlatformAddresses";
import { useAdresses } from "@renderer/hooks/useAdresses";
import { useIdentities, prefetchIdentities, refreshIdentities } from "@renderer/hooks/useIdentities";
import { useShieldedStatus, useShieldedSyncState } from "@renderer/hooks/useShielded";
import { useOperationFee } from "@renderer/hooks/useOperationFee";
import { useSendTransactionPreview } from "@renderer/hooks/useSendTransactionPreview";
import { useErrorToast } from "@renderer/hooks/useErrorToast";
import { useWalletUtxos } from "@renderer/hooks/useWalletUtxos";
import { invalidateAsyncCache } from "@renderer/hooks/useAsyncWithCache";
import { compareBigIntsDescending, creditsToDuffs, davToDash, davToDashCompact, dashToDuffs, duffsToCredits } from "@renderer/utils/balance";
import { isValidDashAddress, isValidDashChangeAddress } from "@renderer/utils/address";
import { isValidPlatformAddress } from "@renderer/utils/platformAddress";
import { isLikelyShieldedAddress } from "@renderer/utils/shieldedAddress";
import { amountErrorFor } from "@renderer/utils/amountValidation";
import { getErrorMessage } from "@renderer/utils/error";
import { isUnfinishedAssetLockFunding } from "@renderer/utils/identityRegistration";
import { getAdvancedSendRoute, getOrCreateSendDraft, resetCurrentSendRoute, saveSendDraft, setSendAdvanced } from "@renderer/utils/sendDraft";
import { capRecipientAmounts, capSendAmount, orderPlatformRecipients, recipientAllocationBudget, recipientTotalDuffs, validateSendRecipients, withOutputFee } from "@renderer/utils/sendRecipients";
import { SEND_RECIPIENT_LIMITS } from "@renderer/constants/sendRecipients";
import {
  buildCoinControlInventory,
  coinControlSelectionSummary,
  coinControlSelectionTotals,
  isCoinControlSelectionValid,
  normalizeCoinControlSelection,
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
import { AssetLockFundingState, PlatformAddressDto, ShieldedSpendState } from "@renderer/api/types";
import type { AdvancedSendRoute, SendDraft } from "@renderer/types/SendDraft";
import type { CoinControlSelection } from "@renderer/types/CoinControl";
import type { SendPreviewRequest } from "@renderer/types/SendTransactionPreview";
import { sendPreviewParams, sendPreviewRequestKey } from "@renderer/utils/sendTransactionPreview";
import { COIN_CONTROL_INVALID_MESSAGE } from "@renderer/constants/coinControl";
import { coreSendChangeTo } from "@renderer/utils/changeAddress";
import { sendPageData, WITHDRAWAL_SUCCESS_NOTE } from "@renderer/constants";
import { DESTINATION_PLACEHOLDERS, INVALID_DESTINATION_MESSAGES, OPERATION_FUNDING_KINDS, SHIELDED_DESTINATION_LABELS, UNFINISHED_FUNDING_LABELS } from "@renderer/constants/sendPages";
import AmountField from "./AmountField";
import AmountSlider from "./AmountSlider";
import SendRecipientsEditor from "./SendRecipientsEditor";
import ChangeAddressField from "./ChangeAddressField";
import TransactionSummary from "./TransactionSummary";
import SendTransactionPreview from "./SendTransactionPreview";
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
  const { syncIncomplete } = useConnectionModeContext()
  const walletId = status?.selectedWalletId ?? null
  const network = status?.network ?? null

  const [searchParams] = useSearchParams()
  const [draft, setDraftState] = useState<SendDraft>(() =>
    getOrCreateSendDraft(walletId, searchParams.get('from'), searchParams.get('to')))
  const draftRef = useRef(draft)
  const { fromKind, toKind, fromAddress, fromIdentity, toValue, amount, acked, coinControl, advanced } = draft
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
  const setCoinControl = (coinControl: CoinControlSelection): void => updateDraft(current => ({ ...current, coinControl }))
  const [coinControlOpen, setCoinControlOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [review, setReview] = useState<SendPreviewRequest | null>(null)
  const previewSequence = useRef(0)
  const preview = useSendTransactionPreview(review)
  const [notesUnlockOpen, setNotesUnlockOpen] = useState(false)
  const [wizardKey, setWizardKey] = useState(0)
  const { utxos, loading: utxosLoading, error: utxosError, retry: retryUtxos } = useWalletUtxos(wizardKey)
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
      .catch(error => {
        if (dead) return
        toast.error(`**Could not check funding progress** ${getErrorMessage(error)}`)
      })
    return () => { dead = true }
  }, [walletId, wizardKey, fundingRefresh])

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

  const { format: formatFiat, rateReady } = useFiat()
  const { balance } = useWalletBalance(walletId ?? undefined)
  const { receiving, change, loading: coreAddressesLoading, err: coreAddressesError } = useAdresses(walletId ?? undefined)
  const { platformAddresses, loading: platformAddressesLoading, err: platformAddressesError } = usePlatformAddresses(walletId ?? undefined)
  const { identities, loading: identitiesLoading, err: identitiesError } = useIdentities(walletId ?? undefined)
  const shieldedSync = useShieldedSyncState(walletId)
  const prover = useShieldedStatus()
  useErrorToast(utxosError)
  useErrorToast(coreAddressesError)
  useErrorToast(platformAddressesError)
  useErrorToast(identitiesError)
  useErrorToast(shieldedSync.error)

  const operation = resolveOperation(fromKind, toKind)
  const recipientLimit = operation == null ? 1 : SEND_RECIPIENT_LIMITS[operation] ?? 1
  const advancedMulti = advanced && recipientLimit > 1
  const advancedRoute = useMemo(() => getAdvancedSendRoute(draft, operation), [draft.advancedRoutes, operation])
  const updateAdvancedRoute = (update: Partial<AdvancedSendRoute>): void => updateDraft(current => ({
    ...current,
    advancedRoutes: operation == null ? current.advancedRoutes : {
      ...current.advancedRoutes,
      [operation]: {...getAdvancedSendRoute(current, operation), ...update},
    },
  }))
  const activeRecipients = useMemo(() => advancedMulti ? advancedRoute.recipients : [{id: 'simple', address: toValue, amount}], [advancedMulti, advancedRoute.recipients, toValue, amount])
  const orderedRecipients = useMemo(
    () => operation === TransferOperation.AddressFundsTransfer ? orderPlatformRecipients(activeRecipients) : activeRecipients,
    [operation, activeRecipients],
  )
  const recipientsDuffs = useMemo(
    () => orderedRecipients.map(recipient => ({address: recipient.address.trim(), amountDuffs: dashToDuffs(recipient.amount)})),
    [orderedRecipients],
  )
  const recipientsCredits = useMemo(
    () => recipientsDuffs.map(recipient => ({address: recipient.address, amountCredits: duffsToCredits(recipient.amountDuffs)})),
    [recipientsDuffs],
  )
  const displayRecipientsCredits = useMemo(
    () => activeRecipients.map(recipient => ({address: recipient.address.trim(), amountCredits: duffsToCredits(dashToDuffs(recipient.amount))})),
    [activeRecipients],
  )
  const subtractFee = advancedMulti && operation === TransferOperation.AddressFundsTransfer && advancedRoute.subtractFee
  const feeOutputPosition = orderedRecipients.findIndex(recipient => recipient.id === advancedRoute.feeRecipientId)
  const feeOutputIndex = subtractFee && feeOutputPosition >= 0 ? feeOutputPosition : undefined
  const displayFeeOutputIndex = subtractFee ? activeRecipients.findIndex(recipient => recipient.id === advancedRoute.feeRecipientId) : undefined
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
      .sort((a, b) => compareBigIntsDescending(a.balance, b.balance)),
    [receiving, change],
  )
  const spendableNotes = useMemo(
    () => (shieldedSync.phase === ShieldedSyncPhase.Done ? shieldedSync.notes.filter(n => !n.spent) : [])
      .slice()
      .sort((a, b) => compareBigIntsDescending(a.amount, b.amount)),
    [shieldedSync.phase, shieldedSync.notes],
  )
  const notesSyncing = shieldedSync.phase === ShieldedSyncPhase.Syncing || shieldedSync.phase === ShieldedSyncPhase.Recovering
  const coinControlFunds = useMemo(() => ({
    coreAddresses, utxos, platformAddresses: fundedAddresses, shieldedNotes: spendableNotes,
  }), [coreAddresses, utxos, fundedAddresses, spendableNotes])
  const coinControlInventory = useMemo(() => buildCoinControlInventory(coinControlFunds), [coinControlFunds])
  const appliedCoinControl = useMemo(
    () => normalizeCoinControlSelection(coinControl, operation),
    [coinControl, operation],
  )
  const coinControlLoading = {
    automatic: false,
    coreAddress: coreAddressesLoading,
    coreOutpoints: utxosLoading || syncIncomplete,
    platformAddress: platformAddressesLoading,
    platformInputs: platformAddressesLoading,
    shieldedAddress: shieldedSync.phase !== ShieldedSyncPhase.Done && shieldedSync.phase !== ShieldedSyncPhase.Error,
    shieldedNotes: shieldedSync.phase !== ShieldedSyncPhase.Done && shieldedSync.phase !== ShieldedSyncPhase.Error,
  }[appliedCoinControl.kind]
  const sourceInventoryError = {
    [SourceKind.Core]: coreAddressesError ?? (appliedCoinControl.kind === 'coreOutpoints' ? utxosError : null),
    [SourceKind.PlatformAddress]: platformAddressesError,
    [SourceKind.Identity]: identitiesError,
    [SourceKind.Shielded]: shieldedSync.error,
  }[fromKind]
  const coinControlValid = !coinControlLoading && !sourceInventoryError
    && isCoinControlSelectionValid(appliedCoinControl, coinControlInventory)

  useEffect(() => {
    if (!coinControlLoading && !sourceInventoryError && !coinControlValid) toast.error(COIN_CONTROL_INVALID_MESSAGE)
  }, [coinControlLoading, sourceInventoryError, coinControlValid])

  useEffect(() => {
    if (appliedCoinControl !== coinControl) setCoinControl(appliedCoinControl)
  }, [appliedCoinControl, coinControl])

  const coreSpendSource = useMemo(() => toCoreSpendSource(appliedCoinControl, utxos), [appliedCoinControl, utxos])
  const platformSource = useMemo(() => withOutputFee(toPlatformSpendSource(appliedCoinControl), feeOutputIndex), [appliedCoinControl, feeOutputIndex])
  const shieldedSpendSource = useMemo(
    () => toShieldedSpendSource(appliedCoinControl, spendableNotes),
    [appliedCoinControl, spendableNotes],
  )
  const selectedTotals = coinControlSelectionTotals(appliedCoinControl, coinControlFunds)
  let fundingAddresses = fundedAddresses.map(address => address.platformAddress)
  if (appliedCoinControl.kind === 'platformInputs') {
    fundingAddresses = appliedCoinControl.inputs.map(input => input.address)
  } else if (appliedCoinControl.kind === 'platformAddress') {
    fundingAddresses = [appliedCoinControl.address]
  }

  let balanceDuffs = balance.dash.amount
  if (appliedCoinControl.kind === 'coreOutpoints' || appliedCoinControl.kind === 'coreAddress') {
    balanceDuffs = selectedTotals.duffs
  }
  const shieldedBalance = shieldedSync.phase === ShieldedSyncPhase.Done && shieldedSync.balance !== null ? BigInt(shieldedSync.balance) : null

  let availableCredits: bigint | null = null
  if (fromKind === SourceKind.PlatformAddress) {
    if (operation === TransferOperation.Shield) {
      availableCredits = selectedSource?.balanceCredits ?? 0n
    } else if (appliedCoinControl.kind === 'platformInputs' || appliedCoinControl.kind === 'platformAddress') {
      availableCredits = selectedTotals.credits
    } else {
      availableCredits = fundedAddresses.reduce((sum, address) => sum + address.balanceCredits, 0n)
    }
  } else if (fromKind === SourceKind.Identity) {
    availableCredits = selectedIdentity ? BigInt(String(selectedIdentity.balance.amount)) : 0n
  } else if (fromKind === SourceKind.Shielded) {
    availableCredits = shieldedBalance
    if (appliedCoinControl.kind === 'shieldedNotes' || appliedCoinControl.kind === 'shieldedAddress') {
      availableCredits = selectedTotals.credits
    }
  }

  const isCoreOperation = fromKind === SourceKind.Core
  const amountDuffs = useMemo(() => recipientTotalDuffs(activeRecipients), [activeRecipients])
  const minCredits = info?.minCredits ?? 0n
  const trimmedTo = toValue.trim()

  const amountCredits = isCoreOperation ? 0n : duffsToCredits(amountDuffs)

  let destinationValid = false
  switch (toKind) {
    case DestinationKind.CoreAddress:
      destinationValid = isValidDashAddress(trimmedTo, network ?? undefined)
      break
    case DestinationKind.PlatformAddress:
      destinationValid = isValidPlatformAddress(trimmedTo, network ?? undefined)
      break
    case DestinationKind.Identity:
      destinationValid = isLikelyIdentityId(trimmedTo)
      break
    case DestinationKind.NewIdentity:
      destinationValid = true
      break
    case DestinationKind.Shielded:
      destinationValid = isLikelyShieldedAddress(trimmedTo)
      break
  }

  const recipientValidation = {
    recipients: activeRecipients, operation, destination: toKind, network, fundingAddresses,
    feeRecipientId: subtractFee ? advancedRoute.feeRecipientId : null,
  }
  if (advancedMulti) destinationValid = activeRecipients.length > 0 && validateSendRecipients({...recipientValidation, feeCredits: null}).every(error => error.address == null)

  const { feeCredits, feeDuffs, maxDuffs, maxPerTx, noteLimit, loading: feeLoading, err: feeErr, retry: retryFee } = useOperationFee(walletId, coinControlValid ? operation : null, {
    destinationValid,
    recipient: advancedMulti ? orderedRecipients.map(recipient => recipient.address.trim()) : trimmedTo,
    amountCredits,
    amountDuffs: isCoreOperation ? amountDuffs : null,
    coreSource: coreSpendSource ?? null,
    platformSource,
    identityId: selectedIdentity?.identifier ?? null,
    shieldedSource: shieldedSpendSource ?? null,
  })
  useErrorToast(feeErr)
  const recipientErrors = validateSendRecipients({...recipientValidation, feeCredits})
  const quoteReady = (operation === TransferOperation.CoreSend || destinationValid)
    && !feeLoading && !feeErr && (isCoreOperation ? feeDuffs !== null : feeCredits !== null)
  const feeSourceValid = !subtractFee || (platformSource?.kind === 'inputs' && feeOutputIndex != null)
  const totalDebitCredits = amountCredits + (subtractFee ? 0n : feeCredits ?? 0n)

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
    const spendable = availableCredits - (subtractFee ? 0n : feeCredits)
    return creditsToDuffs(spendable > 0n ? spendable : 0n)
  }, [isCoreOperation, coreMaxDuffs, maxPerTx, availableCredits, feeCredits, subtractFee])

  const sliderPercent = useMemo(() => {
    if (sliderMaxAmount === null || sliderMaxAmount === 0n) return 0
    if (amountDuffs <= 0n) return 0
    if (amountDuffs >= sliderMaxAmount) return 100
    return Math.max(0, Math.min(100, Math.round(Number(amountDuffs) * 100 / Number(sliderMaxAmount))))
  }, [sliderMaxAmount, amountDuffs])

  const handleSliderPercent = (percent: number): void => {
    const maximum = operation === TransferOperation.CoreSend ? allocationBudgetDuffs : sliderMaxAmount
    if (maximum === null) return
    const value = (maximum * BigInt(percent)) / 100n
    setAmount(davToDash(value))
  }

  const sourceReady = {
    [SourceKind.Core]: true,
    [SourceKind.PlatformAddress]: selectedSource != null,
    [SourceKind.Identity]: selectedIdentity != null,
    [SourceKind.Shielded]: true,
  }[fromKind]
  let allocationAvailableDuffs: bigint | null = null
  if (coinControlValid && sourceReady) {
    if (isCoreOperation) allocationAvailableDuffs = balanceDuffs
    else if (availableCredits != null) allocationAvailableDuffs = creditsToDuffs(availableCredits)
  }
  const allocationReady = operation === TransferOperation.CoreSend ? coreMaxDuffs !== null && !feeErr : quoteReady
  const allocationBudgetDuffs = operation === TransferOperation.CoreSend && !allocationReady
    ? null : recipientAllocationBudget(allocationAvailableDuffs, sliderMaxAmount, allocationReady)

  useEffect(() => {
    if (operation !== TransferOperation.CoreSend || allocationBudgetDuffs == null) return
    if (advancedMulti) {
      const recipients = capRecipientAmounts(activeRecipients, allocationBudgetDuffs)
      if (recipients !== activeRecipients) updateAdvancedRoute({recipients})
    } else {
      const capped = capSendAmount(amount, allocationBudgetDuffs)
      if (capped !== amount) setAmount(capped)
    }
  }, [operation, advancedMulti, activeRecipients, amount, allocationBudgetDuffs])

  const selfSend =
    (operation === TransferOperation.AddressFundsTransfer && destinationValid
      && !advancedMulti && fundingAddresses.includes(trimmedTo))
    || (operation === TransferOperation.IdentityToIdentity && destinationValid && selectedIdentity != null && trimmedTo === selectedIdentity.identifier)

  let destinationError: string | null = null
  if (toKind !== DestinationKind.NewIdentity && trimmedTo.length > 0) {
    if (!destinationValid) {
      destinationError = INVALID_DESTINATION_MESSAGES[toKind].replace('{network}', network ?? '')
    } else if (selfSend) {
      destinationError = 'Recipient must be different from the source address.'
      if (operation === TransferOperation.IdentityToIdentity) {
        destinationError = 'Recipient must be different from the source identity.'
      }
    }
  }

  const needsAck = operation === TransferOperation.ShieldedWithdrawal
  const destinationReady = destinationValid && !selfSend && (!needsAck || acked)
  const coreSourceGated = fromKind === SourceKind.Core && syncIncomplete
  const routeReady = operation != null && sourceReady && destinationReady && !coreSourceGated && coinControlValid

  const amountReady = isCoreOperation
    ? amountDuffs > 0n && coreMaxDuffs !== null && amountDuffs <= coreMaxDuffs
    : amountCredits >= minCredits && amountCredits > 0n
      && feeCredits !== null
      && availableCredits !== null && totalDebitCredits <= availableCredits
      && (maxPerTx === null || amountCredits <= maxPerTx)
      && (operation !== TransferOperation.IdentityCreateFromShielded || isPoolIdentityDenomination(amountCredits))

  const recipientsReady = !advancedMulti || (activeRecipients.length <= recipientLimit && recipientErrors.every(error => !error.address && !error.amount))
  const changeTo = coreSendChangeTo({advanced, customChangeEnabled: advancedRoute.customChangeEnabled, operation, amountDuffs, maxDuffs: coreMaxDuffs, change, selected: advancedRoute.changeAddress})
  const changeAddressValid = changeTo === undefined || isValidDashChangeAddress(changeTo, network ?? undefined)
  const canSubmit = routeReady && amountReady && recipientsReady && feeSourceValid && quoteReady && changeAddressValid
  const canCustomizeChange = advanced && isCoreOperation && allocationReady && coinControlValid
    && coreMaxDuffs !== null && coreMaxDuffs > 0n && amountDuffs < coreMaxDuffs
  const customChangeControl = canCustomizeChange ? <Checkbox
    checked={advancedRoute.customChangeEnabled ?? false}
    onChange={customChangeEnabled => updateAdvancedRoute({customChangeEnabled})}
    label={<Text size={12} weight="medium" color="brand">Custom change address</Text>}
  /> : null
  const customChangeField = canCustomizeChange && advancedRoute.customChangeEnabled ? <ChangeAddressField
    change={change}
    value={advancedRoute.changeAddress}
    loading={coreAddressesLoading}
    error={coreAddressesError}
    previewOnly={operation !== TransferOperation.CoreSend}
    onChange={changeAddress => updateAdvancedRoute({changeAddress})}
    onRetry={() => { if (walletId) invalidateAsyncCache('addresses', walletId) }}
  /> : null

  const amountFiat = rateReady && amountDuffs > 0n ? formatFiat(amountDuffs) : undefined

  const handleAmount = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const val = e.target.value.replace(/[^0-9.]/g, '')
    const parts = val.split('.')
    if (parts.length > 2) return
    if (parts[1] && parts[1].length > 8) return
    setAmount(operation === TransferOperation.CoreSend && allocationBudgetDuffs != null
      ? capSendAmount(val, allocationBudgetDuffs) : val)
  }

  const handleMax = (): void => {
    if (operation === TransferOperation.CoreSend) {
      if (allocationBudgetDuffs !== null) setAmount(davToDash(allocationBudgetDuffs))
      return
    }
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

  const destinationPlaceholder = DESTINATION_PLACEHOLDERS[toKind][network ?? 'testnet']

  const amountError = amountErrorFor({
    isCoreOperation,
    amount: advancedMulti ? davToDash(amountDuffs) : amount,
    coreMaxDuffs,
    operation,
    amountDuffs,
    amountCredits,
    minCredits,
    availableCredits,
    feeCredits: subtractFee ? 0n : feeCredits,
    maxPerTx,
    noteLimit,
  })

  const reloadIdentities = (): void => {
    if (!walletId) return
    void refreshIdentities(walletId)
  }

  let coinControlSummary = coinControlSelectionSummary(appliedCoinControl, selectedTotals)
  if (operation === TransferOperation.Shield) coinControlSummary = 'Fixed address'

  const resetForm = (): void => {
    setPreviewOpen(false)
    setReview(null)
    const resetDraft = resetCurrentSendRoute(draftRef.current)
    draftRef.current = resetDraft
    setDraftState(resetDraft)
    if (walletId) saveSendDraft(walletId, resetDraft)
    setWizardKey(k => k + 1)
    if (walletId) {
      refreshPlatformAddresses(walletId)
      prefetchIdentities(walletId)
    }
  }

  const coreRecipientInput = !advancedMulti && toKind === DestinationKind.CoreAddress && operation === TransferOperation.CoreSend
  const changeDestinationKind = (kind: DestinationKind): void => {
    setToKind(kind)
    if (!advancedMulti) setToValue('')
    setAcked(false)
  }
  const changeSendMode = (mode: boolean): void => {
    updateDraft(current => setSendAdvanced(current, mode))
    setWizardKey(key => key + 1)
  }
  const routeStep = (
    <>
      <SourcePicker
        kind={fromKind}
        onKindChange={k => {
          setFromKind(k)
          setAcked(false)
          if (k === SourceKind.Identity && identities.length === 0) reloadIdentities()
        }}
        platformAddresses={fundedAddresses}
        selectedPlatformAddress={selectedSource}
        onPlatformAddressChange={setFromAddress}
        platformAddressesLoading={platformAddressesLoading}
        platformAddressesError={platformAddressesError}
        onRetryPlatformAddresses={() => { if (walletId) void refreshPlatformAddresses(walletId) }}
        showPlatformAddress={operation === TransferOperation.Shield}
        identities={identities}
        identitiesLoading={identitiesLoading}
        identitiesError={identitiesError}
        selectedIdentity={selectedIdentity}
        onIdentityChange={setFromIdentity}
        onRetryIdentities={reloadIdentities}
      />

      {operation != null && fromKind !== SourceKind.Identity && (
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

      {fromKind === SourceKind.Shielded && (
        <ShieldedNotesAlert walletId={walletId} onSync={() => setNotesUnlockOpen(true)} syncing={notesSyncing} />
      )}

      <div className="flex flex-col gap-2">
        <DestinationPicker
          kind={toKind}
          kinds={destinationKinds}
          onKindChange={changeDestinationKind}
          value={coreRecipientInput ? trimmedTo : toValue}
          onValueChange={setToValue}
          placeholder={destinationPlaceholder}
          error={advancedMulti ? null : destinationError}
          showValueInput={!advancedMulti && !coreRecipientInput && operation != null}
        />
        {coreRecipientInput && <>
          <RecipientInput value={toValue} onChange={setToValue} data={sendPageData.recipient} />
          {destinationError && <Text size={12} weight={"medium"} color={"red"} className={"px-1"}>{destinationError}</Text>}
        </>}
      </div>

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

  let sourceBalanceDisplay = (
    <Text size={12} weight={"medium"} color={"brand"} opacity={50}>Sync notes on the Shielded page to see your balance</Text>
  )
  if (isCoreOperation) {
    const exceedsBalance = amountDuffs > 0n && amountDuffs > balanceDuffs
    sourceBalanceDisplay = (
      <Text size={12} weight={"medium"} color={exceedsBalance ? "red" : "brand"} opacity={exceedsBalance ? 100 : 50}>
        {exceedsBalance ? 'Amount exceeds balance' : `Balance: ${davToDashCompact(balanceDuffs)} Dash`}
      </Text>
    )
  } else if (availableCredits !== null) {
    sourceBalanceDisplay = <Text size={12} weight={"medium"} color={"brand"} opacity={50}>Available: <CreditsAmount credits={availableCredits} /></Text>
  }

  let feeDisplay = <Text size={12} weight={"medium"} color={"brand"} opacity={50}>—</Text>
  if (isCoreOperation) {
    feeDisplay = <Text size={12} weight={"medium"} color={"brand"}>{davToDash(totalFeeDuffs)} Dash</Text>
  } else if (feeErr === null && feeCredits !== null) {
    feeDisplay = <Text size={12} weight={"medium"} color={"brand"}><CreditsAmount credits={feeCredits} align={"end"} /></Text>
  } else if (feeErr === null && feeLoading) {
    feeDisplay = <Spinner size={14} className={"text-dash-brand dark:text-dash-mint"} />
  }

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
        disabled={operation === TransferOperation.CoreSend && allocationBudgetDuffs == null}
        unit={<DashLogo size={20} />}
      />
      {operation !== TransferOperation.IdentityCreateFromShielded && sliderMaxAmount !== null && (
        <AmountSlider
          percent={sliderPercent}
          onPercentChange={handleSliderPercent}
          disabled={sliderMaxAmount === 0n || (operation === TransferOperation.CoreSend && allocationBudgetDuffs == null)}
        />
      )}
      {amountError && (
        <div className={"mt-2 px-1"}>
          <Text size={12} weight={"medium"} color={"red"}>{amountError}</Text>
        </div>
      )}
      {feeErr && <button type={'button'} onClick={retryFee} className={'dash-text-primary text-sm cursor-pointer'}>Retry fee estimate</button>}
      <div className={"mt-2 px-1 flex items-center justify-between gap-3"}>
        {sourceBalanceDisplay}
        {amountFiat && <Text size={12} weight={"medium"} color={"blue-mint"}>≈ {amountFiat}</Text>}
      </div>
      <div className={"mt-2 px-1 flex items-center justify-between gap-3"}>
        <Text size={12} weight={"medium"} color={"brand"} opacity={50}>{isCoreOperation ? 'Network fee' : 'Reserved for fee'}</Text>
        {feeDisplay}
      </div>
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

  const previewParams = operation == null ? null : sendPreviewParams({
    operation,
    recipients: recipientsDuffs,
    coreSource: coreSpendSource,
    platformSource,
    shieldedSource: shieldedSpendSource,
    identityId: selectedIdentity?.identifier,
    fromAddress: selectedSource?.platformAddress,
    changeTo,
  })
  const previewKey = sendPreviewRequestKey({walletId, network, operation, params: previewParams})
  const reviewCurrent = review?.key === previewKey && preview.data != null && !preview.loading && !preview.error
  const signingSourceValid = canSubmit && (!previewOpen || reviewCurrent)
  const confirmationPreview = previewOpen ? preview.data : null
  const confirmationFeeDuffs = confirmationPreview?.feeDuffs ?? feeDuffs
  const confirmationFeeCredits = confirmationPreview?.feeCredits ?? feeCredits
  const confirmationDebitCredits = confirmationPreview?.totalDebitCredits ?? totalDebitCredits

  const closePreview = (): void => {
    setPreviewOpen(false)
    setReview(null)
  }

  const showPreview = (): void => {
    if (!canSubmit || !walletId || !operation || !previewParams) return
    setPreviewOpen(true)
    setReview({
      id: ++previewSequence.current,
      key: previewKey,
      walletId,
      operation,
      params: previewParams,
      from: fromDisplay,
    })
  }

  const signTransaction = (): void => {
    if (signingSourceValid) setConfirmOpen(true)
  }

  const reviewTransaction = (): void => {
    if (advanced) showPreview()
    else signTransaction()
  }

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
      <button type="button" onClick={showPreview} disabled={!canSubmit} className="w-full rounded-xl px-4 py-3 dash-block text-sm font-medium dash-text-default opacity-70 cursor-pointer hover:opacity-100 transition-opacity outline-none focus-visible:ring-2 focus-visible:ring-dash-brand/40 dark:focus-visible:ring-white/40 disabled:opacity-40 disabled:cursor-default">Transaction details</button>
    </div>
  )

  const startShieldedSpend = (password: string): Promise<ShieldedSpendState> => {
    if (!walletId) {
      return Promise.resolve<ShieldedSpendState>({ phase: ShieldedSpendPhase.Error, fetched: 0, total: 0, stHash: null, identityId: null, error: 'No wallet selected' })
    }
    if (operation === TransferOperation.ShieldedTransfer) {
      return API.startShieldedTransfer(
        walletId,
        recipientsCredits,
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
        recipientsCredits,
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
    <div className={"relative flex flex-col h-full pb-4"} inert={confirmOpen || coinControlOpen || notesUnlockOpen || resumeOpen || dismissConfirmOpen}>
      {previewOpen && review && <SendTransactionPreview
        data={preview.data}
        loading={preview.loading}
        error={preview.error}
        valid={signingSourceValid}
        canRefresh={canSubmit && !preview.loading}
        onBack={closePreview}
        onRetry={showPreview}
        onSign={signTransaction}
      />}
      <div className={previewOpen ? 'hidden' : 'contents'}>
      <div className={"flex items-end justify-between gap-6 px-12 pt-2"}>
        <div className={"flex flex-col gap-3"}>
          <Text size={40} weight={"medium"} color={"brand"} className={"leading-[125%] tracking-[-0.03em]"}>Send</Text>
          <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"leading-[120%] max-w-152.5"}>
            Move funds between your Dash Core, Platform addresses, identities and the shielded pool. Pick where the funds come from and where they go.
          </Text>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <div className="flex gap-1 dash-block p-1 rounded-xl" aria-label="Send mode">
            {[false, true].map(mode => (
              <button
                key={String(mode)}
                type="button"
                aria-pressed={advanced === mode}
                onClick={() => changeSendMode(mode)}
                className={`px-4 py-2 rounded-lg text-xs font-bold cursor-pointer ${advanced === mode ? 'dash-bg-inverse text-dash-brand dark:text-dash-mint' : 'dash-text-default'}`}
              >
                {mode ? 'Advanced' : 'Simple'}
              </button>
            ))}
          </div>
          {shieldedInvolved && <ProverPill status={prover} />}
        </div>
      </div>

      {resumableFunding && (
        <div className={"mx-12 mt-4 flex items-center justify-between gap-4 p-[.875rem] rounded-[.9375rem] dash-block-3"}>
          <div className={"flex flex-col gap-1 min-w-0"}>
            <Text size={14} weight={"extrabold"} color={"brand"}>
              {UNFINISHED_FUNDING_LABELS[resumableFunding.kind]}
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

      {advanced ? (
        <div className="flex-1 min-h-0 overflow-y-auto px-6 xl:px-12 mt-6 pb-6">
          <div className="mx-auto max-w-280 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_20rem] gap-6 items-start">
            <div className="flex flex-col gap-5 min-w-0">
              <div className="flex flex-col gap-4">{routeStep}</div>
              {advancedMulti ? <SendRecipientsEditor
                recipients={activeRecipients}
                errors={recipientErrors}
                limit={recipientLimit}
                destination={toKind}
                budgetDuffs={allocationBudgetDuffs}
                feeRecipientId={subtractFee ? advancedRoute.feeRecipientId : null}
                feeCredits={feeCredits}
                budgetIsEstimate={!allocationReady}
                headerAction={customChangeControl}
                beforeRecipients={customChangeField}
                onChange={recipients => updateAdvancedRoute({recipients})}
              /> : <>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <Text size={16} weight="extrabold" color="brand">Recipients (1/1)</Text>
                  {customChangeControl}
                </div>
                {customChangeField}
                <Text size={12} weight="medium" color="brand" opacity={50}>This route supports one recipient.</Text>
                {amountStep}
              </>}
            </div>
            <TransactionSummary
              operation={operation}
              isCoreOperation={isCoreOperation}
              amountDuffs={amountDuffs}
              maxAmountDuffs={sliderMaxAmount}
              fee={{credits: feeCredits, totalDuffs: totalFeeDuffs, ready: quoteReady, loading: feeLoading, error: feeErr}}
              route={advancedRoute}
              hasManualPlatformInputs={appliedCoinControl.kind === 'platformInputs'}
              amountError={amountError}
              canSubmit={canSubmit}
              onRouteChange={updateAdvancedRoute}
              onCoinControl={() => setCoinControlOpen(true)}
              onRetryFee={retryFee}
              onReview={reviewTransaction}
            >
              {sourceBalanceDisplay}
            </TransactionSummary>
          </div>
        </div>
      ) : <>
      <TransferWizard
        key={wizardKey}
        steps={[
          { label: 'From & To', content: routeStep, canAdvance: routeReady },
          { label: 'Amount', content: amountStep, canAdvance: canSubmit },
          { label: 'Confirm', content: confirmStep },
        ]}
        onSubmit={reviewTransaction}
        submitLabel="Send"
        submitDisabled={!canSubmit}
      />
      </>}
      </div>

      <CoinControlModal
        isOpen={coinControlOpen}
        feeFromOutput={subtractFee}
        operation={operation}
        selection={appliedCoinControl}
        coreAddresses={coreAddresses}
        coreAddressesLoading={coreAddressesLoading}
        coreAddressesError={coreAddressesError}
        onRetryCoreAddresses={() => { if (walletId) invalidateAsyncCache('addresses', walletId) }}
        utxos={utxos}
        utxosLoading={utxosLoading}
        utxosError={utxosError}
        coreSyncIncomplete={syncIncomplete}
        platformAddresses={fundedAddresses}
        platformAddressesLoading={platformAddressesLoading}
        platformAddressesError={platformAddressesError}
        onRetryPlatformAddresses={() => { if (walletId) void refreshPlatformAddresses(walletId) }}
        shieldedNotes={spendableNotes}
        identityLabel={selectedIdentity?.alias ?? null}
        identityId={selectedIdentity?.identifier ?? null}
        platformAddress={selectedSource}
        onRetryUtxos={retryUtxos}
        onClose={() => setCoinControlOpen(false)}
        onApply={setCoinControl}
      />

      {operation === TransferOperation.CoreSend && (
        <SendConfirmModal
          isOpen={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          walletId={walletId}
          network={network}
          recipients={recipientsDuffs}
          feeDuffs={confirmationFeeDuffs}
          amountFiat={amountFiat}
          source={coreSpendSource}
          changeTo={changeTo}
          sourceValid={signingSourceValid}
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
          sourceValid={signingSourceValid}
          toAddress={trimmedTo}
          amountCredits={amountCredits.toString()}
          feeCredits={confirmationFeeCredits}
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
          toLabel={SHIELDED_DESTINATION_LABELS[operation ?? TransferOperation.ShieldedWithdrawal] ?? 'To (Core L1)'}
          toValue={operation === TransferOperation.IdentityCreateFromShielded ? 'New Platform identity with 6 keys' : trimmedTo}
          recipients={operation === TransferOperation.ShieldedTransfer ? recipientsCredits : undefined}
          amountCredits={amountCredits.toString()}
          feeCredits={confirmationFeeCredits}
          proverReady={prover.ready}
          start={startShieldedSpend}
          sourceValid={signingSourceValid}
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
          kind={OPERATION_FUNDING_KINDS[operation] ?? AssetLockFundingKind.Address}
          source={coreSpendSource}
          sourceValid={signingSourceValid}
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
          recipients={operation === TransferOperation.AddressFundsTransfer ? displayRecipientsCredits : undefined}
          feeOutputIndex={displayFeeOutputIndex}
          feeCredits={confirmationFeeCredits}
          rows={[
            {label: 'Amount', value: <CreditsAmount credits={amountCredits} align={"end"} />},
            ...(confirmationFeeCredits !== null ? [{label: 'Reserved for fee', value: <CreditsAmount credits={confirmationFeeCredits} align={"end"} />}] : []),
            {label: 'Total debit', value: <CreditsAmount credits={confirmationDebitCredits} align={"end"} />},
            {label: 'From', value: fromDisplay, mono: true},
            ...(operation === TransferOperation.AddressFundsTransfer ? [] : [{label: 'To', value: toDisplay, mono: true}]),
          ]}
          run={runPlatformOperation}
          sourceValid={signingSourceValid}
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
