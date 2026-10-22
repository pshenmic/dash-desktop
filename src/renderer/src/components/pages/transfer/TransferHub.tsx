import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { DashLogo } from "dash-ui-kit/react";
import { Button, Text } from "@renderer/components/dash-ui-kit-enxtended";
import P2pSyncAlert from "@renderer/components/ui/P2pSyncAlert";
import PasswordField from "@renderer/components/ui/PasswordField";
import RetryButton from "@renderer/components/ui/RetryButton";
import TxSummary from "@renderer/components/ui/TxSummary";
import ShieldedNotesAlert from "@renderer/components/ui/ShieldedNotesAlert";
import CreditsAmount from "@renderer/components/ui/CreditsAmount";
import DashBigNumber from "@renderer/components/ui/DashBigNumber";
import DenominationChips from "@renderer/components/ui/DenominationChips";
import Checkbox from "@renderer/components/ui/Checkbox";
import PageHeader from "@renderer/components/ui/PageHeader";
import SegmentedControl from "@renderer/components/ui/SegmentedControl";
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
import { useSavedShieldedAddresses } from "@renderer/hooks/useSavedShieldedAddresses";
import { ownRecipientOptions } from "@renderer/utils/ownRecipients";
import { useIdentities, prefetchIdentities, refreshIdentities } from "@renderer/hooks/useIdentities";
import { useShieldedStatus, useShieldedSyncState } from "@renderer/hooks/useShielded";
import { useOperationFee } from "@renderer/hooks/useOperationFee";
import { useSendTransactionPreview } from "@renderer/hooks/useSendTransactionPreview";
import { useErrorToast } from "@renderer/hooks/useErrorToast";
import { useWalletUtxos } from "@renderer/hooks/useWalletUtxos";
import { invalidateAsyncCache } from "@renderer/hooks/useAsyncWithCache";
import { compareBigIntsDescending, creditsToDuffs, davToDash, davToDashCompact, dashToDuffs, duffsToCredits, lockedFeeDuffs } from "@renderer/utils/balance";
import { isValidDashAddress, isValidDashChangeAddress } from "@renderer/utils/address";
import { isValidPlatformAddress } from "@renderer/utils/platformAddress";
import { isLikelyShieldedAddress } from "@renderer/utils/shieldedAddress";
import { amountErrorFor } from "@renderer/utils/amountValidation";
import { getErrorMessage } from "@renderer/utils/error";
import { formatApproxFiat } from "@renderer/utils/approxFiat";
import { isUnfinishedAssetLockFunding } from "@renderer/utils/identityRegistration";
import { getAdvancedSendRoute, getOrCreateSendDraft, resetCurrentSendRoute, saveSendDraft, setSendAdvanced } from "@renderer/utils/sendDraft";
import { capRecipientAmounts, capSendAmount, orderPlatformRecipients, recipientAllocationBudget, recipientTotalDuffs, validateSendRecipients, withOutputFee } from "@renderer/utils/sendRecipients";
import { SEND_RECIPIENT_LIMITS } from "@renderer/constants/sendRecipients";
import {
  buildCoinControlInventory,
  coinControlSelectionSummary,
  coinControlSelectionTotals,
  expandAddressCoinControlSelection,
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
  locksPlatformFeeOnTop,
  POOL_IDENTITY_DENOMINATIONS,
} from "@renderer/utils/transferMatrix";
import { SourceKind } from "@renderer/enums/SourceKind";
import { DestinationKind } from "@renderer/enums/DestinationKind";
import { TransferOperation } from "@renderer/enums/TransferOperation";
import { ShieldedSyncPhase } from "@renderer/enums/ShieldedSyncPhase";
import { ShieldedSpendPhase } from "@renderer/enums/ShieldedSpendPhase";
import { AssetLockFundingPhase } from "@renderer/enums/AssetLockFundingPhase";
import { AssetLockFundingKind } from "@renderer/enums/AssetLockFundingKind";
import { SegmentedControlAppearance } from "@renderer/enums/SegmentedControlAppearance";
import { SendMode } from "@renderer/enums/SendMode";
import { API } from "@renderer/api";
import { AssetLockFundingState, ShieldedSpendState } from "@renderer/api/types";
import type { AdvancedSendRoute, SendDraft } from "@renderer/types/SendDraft";
import type { CoinControlSelection } from "@renderer/types/CoinControl";
import type { SendPreviewRequest } from "@renderer/types/SendTransactionPreview";
import { sendPreviewParams, sendPreviewRequestKey } from "@renderer/utils/sendTransactionPreview";
import { COIN_CONTROL_INVALID_MESSAGE } from "@renderer/constants/coinControl";
import { DASH_UNIT } from "@renderer/constants/balance";
import { PAGE_HEADERS } from "@renderer/constants/pageHeaders";
import { SEND_MODE_LABEL, SEND_MODE_OPTIONS } from "@renderer/constants/sendMode";
import { CHIP_VALUE, SURFACE_SECTION } from "@renderer/constants/surfaces";
import { TRANSFER_WIZARD_CTA_CLASS } from "@renderer/constants/transferWizard";
import { coreSendChangeTo } from "@renderer/utils/changeAddress";
import { INVALID_WALLET_PASSWORD_MESSAGE, sendPageData, WITHDRAWAL_SUCCESS_NOTE } from "@renderer/constants";
import { AUTOMATIC_PLATFORM_SELECTION, AUTOMATIC_SOURCE_LABELS, DESTINATION_PLACEHOLDERS, INVALID_DESTINATION_MESSAGES, OPERATION_FUNDING_KINDS, UNFINISHED_FUNDING_LABELS } from "@renderer/constants/sendPages";
import { SEND_INPUTS_CHANGED_MESSAGE } from "@renderer/constants/sendConfirmModal";
import { POOL_IDENTITY_LABEL } from "@renderer/constants/sendSummary";
import { SIMPLE_SEND_LABELS, SIMPLE_SEND_PASSWORD_ID } from "@renderer/constants/simpleSend";
import { sourceEndpoint } from "@renderer/utils/txSummaryEndpoints";
import { sendSummary } from "@renderer/utils/sendSummary";
import { simpleSendSubmit } from "@renderer/utils/simpleSend";
import AmountField from "./AmountField";
import AmountSlider from "./AmountSlider";
import SendRecipientsEditor from "./SendRecipientsEditor";
import ChangeAddressField from "./ChangeAddressField";
import TransactionSummary from "./TransactionSummary";
import SendTransactionPreview from "./SendTransactionPreview";
import TransferWizard from "./TransferWizard";
import TransferRouteCards from "./TransferRouteCards";
import CoinControlButton from "./CoinControlButton";
import RecipientInput from "./RecipientInput";
import { SourcePicker, DestinationPicker } from "./EndpointPicker";
import EndpointKindIcon from "./EndpointKindIcon";
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
  const { fromKind, toKind, fromIdentity, toValue, amount, acked, coinControl, advanced } = draft
  const updateDraft = (update: (current: SendDraft) => SendDraft): void => {
    const next = update(draftRef.current)
    draftRef.current = next
    setDraftState(next)
    if (walletId != null) saveSendDraft(walletId, next)
  }
  const setFromKind = (fromKind: SourceKind): void => updateDraft(current => ({ ...current, fromKind }))
  const setToKind = (toKind: DestinationKind): void => updateDraft(current => ({ ...current, toKind }))
  const setFromIdentity = (fromIdentity: string): void => updateDraft(current => ({ ...current, fromIdentity }))
  const setToValue = (toValue: string): void => updateDraft(current => ({ ...current, toValue }))
  const setAmount = (amount: string): void => updateDraft(current => ({ ...current, amount }))
  const setAcked = (acked: boolean): void => updateDraft(current => ({ ...current, acked }))
  const setCoinControl = (coinControl: CoinControlSelection): void => updateDraft(current => ({ ...current, coinControl }))
  const [coinControlOpen, setCoinControlOpen] = useState(false)
  const [recipientDraft, setRecipientDraft] = useState<AdvancedSendRoute | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [verifying, setVerifying] = useState(false)
  const verifyingRef = useRef(false)
  const signingSourceValidRef = useRef(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [review, setReview] = useState<SendPreviewRequest | null>(null)
  const previewSequence = useRef(0)
  const preview = useSendTransactionPreview(review)
  const [notesUnlockOpen, setNotesUnlockOpen] = useState(false)
  const [wizardKey, setWizardKey] = useState(0)
  const { utxos, loading: utxosLoading, localSnapshot: utxosLocalSnapshot, error: utxosError, retry: retryUtxos } = useWalletUtxos(wizardKey)
  const [fundingRefresh, setFundingRefresh] = useState(0)
  const [resumableFunding, setResumableFunding] = useState<AssetLockFundingState | null>(null)
  const [resumeOpen, setResumeOpen] = useState(false)
  const [dismissConfirmOpen, setDismissConfirmOpen] = useState(false)
  const [dismissBusy, setDismissBusy] = useState(false)

  useEffect(() => {
    if (passwordError && !verifying) document.getElementById(SIMPLE_SEND_PASSWORD_ID)?.focus()
  }, [passwordError, verifying])

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
    try {
      await API.dismissAssetLockFunding(walletId)
      setResumableFunding(null)
      setResumeOpen(false)
      setDismissConfirmOpen(false)
    } catch (error) {
      toast.error(`**Could not dismiss pending funding** ${getErrorMessage(error)}`)
    } finally {
      setDismissBusy(false)
    }
  }

  const { format: formatFiat, rateReady } = useFiat()
  const { balance } = useWalletBalance(walletId ?? undefined)
  const { receiving, change, loading: coreAddressesLoading, err: coreAddressesError } = useAdresses(walletId ?? undefined)
  const { platformAddresses, loading: platformAddressesLoading, err: platformAddressesError } = usePlatformAddresses(walletId ?? undefined)
  const { identities, loading: identitiesLoading, err: identitiesError } = useIdentities(walletId ?? undefined)
  const shieldedSync = useShieldedSyncState(walletId, true)
  const savedShielded = useSavedShieldedAddresses(!advanced && toKind === DestinationKind.Shielded, shieldedSync.phase)
  const ownRecipients = useMemo(() => ownRecipientOptions(toKind, {
    receiving, change, platformAddresses, identities, shieldedAddresses: savedShielded.addresses,
    shieldedNotes: shieldedSync.phase === ShieldedSyncPhase.Done ? shieldedSync.notes : null,
  }), [toKind, receiving, change, platformAddresses, identities, savedShielded.addresses, shieldedSync.phase, shieldedSync.notes])
  const prover = useShieldedStatus()
  useErrorToast(utxosError)
  useErrorToast(coreAddressesError)
  useErrorToast(platformAddressesError)
  useErrorToast(identitiesError)
  useErrorToast(savedShielded.errorMessage, !advanced && toKind === DestinationKind.Shielded)

  const operation = resolveOperation(fromKind, toKind)
  const recipientLimit = operation == null ? 1 : SEND_RECIPIENT_LIMITS[operation] ?? 1
  const advancedMulti = advanced && recipientLimit > 1
  const usesRecipientEditor = advanced && operation != null
  const savedAdvancedRoute = useMemo(() => getAdvancedSendRoute(draft, operation), [draft.advancedRoutes, operation])
  const advancedRoute = recipientDraft ?? savedAdvancedRoute
  const updateAdvancedRoute = (update: Partial<AdvancedSendRoute>): void => {
    if (recipientDraft != null) {
      setRecipientDraft(current => current == null ? null : {...current, ...update})
    } else {
      updateDraft(current => ({
        ...current,
        advancedRoutes: operation == null ? current.advancedRoutes : {
          ...current.advancedRoutes,
          [operation]: {...getAdvancedSendRoute(current, operation), ...update},
        },
      }))
    }
  }
  const applyRecipients = (): void => {
    if (recipientDraft == null || operation == null) return
    updateDraft(current => ({
      ...current,
      advancedRoutes: {...current.advancedRoutes, [operation]: recipientDraft},
    }))
    setRecipientDraft(null)
  }
  const activeRecipients = useMemo(() => usesRecipientEditor ? advancedRoute.recipients : [{id: 'simple', address: toValue, amount}], [usesRecipientEditor, advancedRoute.recipients, toValue, amount])
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
      if (!advanced) setToValue('')
      setAcked(false)
    }
  }, [destinationKinds, toKind, advanced])

  const fundedAddresses = useMemo(
    () => platformAddresses.filter(a => BigInt(a.balanceCredits) > 0n),
    [platformAddresses],
  )

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
  const normalizedCoinControl = useMemo(() => normalizeCoinControlSelection(coinControl, operation), [coinControl, operation])
  const appliedCoinControl = useMemo(
    () => operation === TransferOperation.Shield
      ? expandAddressCoinControlSelection(normalizedCoinControl, coinControlFunds, operation)
      : normalizedCoinControl,
    [normalizedCoinControl, operation, coinControlFunds],
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

  const coinControlSelectionError = !coinControlLoading && !sourceInventoryError && !coinControlValid
    ? COIN_CONTROL_INVALID_MESSAGE : null

  useEffect(() => {
    if (normalizedCoinControl !== coinControl) setCoinControl(normalizedCoinControl)
  }, [normalizedCoinControl, coinControl])

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
    const fundedCredits = fundedAddresses.reduce((sum, address) => sum + address.balanceCredits, 0n)
    if (appliedCoinControl.kind === 'platformInputs' || appliedCoinControl.kind === 'platformAddress') {
      availableCredits = selectedTotals.credits
    } else {
      availableCredits = fundedCredits
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
  const trimmedTo = usesRecipientEditor ? activeRecipients[0]?.address.trim() ?? '' : toValue.trim()

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

  // An L1 send pays its fee on top of the amount, and a lock that carries the L2
  // fee on top adds that too.
  const lockedFee = operation !== null && locksPlatformFeeOnTop(operation) ? lockedFeeDuffs(feeCredits ?? 0n) : 0n
  const totalFeeDuffs = feeDuffs === null ? 0n : feeDuffs + lockedFee

  // What the L1 selection can fund, less whatever the operation locks on L2.
  const coreMaxDuffs = useMemo((): bigint | null => {
    if (maxDuffs === null) return null
    const spendable = maxDuffs - lockedFee
    return spendable > 0n ? spendable : 0n
  }, [maxDuffs, lockedFee])

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
    [SourceKind.PlatformAddress]: fundedAddresses.length > 0,
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
    if (usesRecipientEditor) {
      const recipients = capRecipientAmounts(activeRecipients, allocationBudgetDuffs)
      if (recipients !== activeRecipients) updateAdvancedRoute({recipients})
    } else {
      const capped = capSendAmount(amount, allocationBudgetDuffs)
      if (capped !== amount) setAmount(capped)
    }
  }, [operation, usesRecipientEditor, activeRecipients, amount, allocationBudgetDuffs])

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

  const recipientsReady = !usesRecipientEditor || (activeRecipients.length > 0 && activeRecipients.length <= recipientLimit
    && (!advancedMulti || recipientErrors.every(error => !error.address && !error.amount)))
  const changeTo = coreSendChangeTo({advanced, customChangeEnabled: advancedRoute.customChangeEnabled, operation, amountDuffs, maxDuffs: coreMaxDuffs, change, selected: advancedRoute.changeAddress})
  const changeAddressValid = changeTo === undefined || isValidDashChangeAddress(changeTo, network ?? undefined)
  const canSubmit = routeReady && amountReady && recipientsReady && feeSourceValid && quoteReady && changeAddressValid
  const canCustomizeChange = advanced && isCoreOperation && allocationReady && coinControlValid
    && coreMaxDuffs !== null && coreMaxDuffs > 0n && amountDuffs < coreMaxDuffs
  const customChangeControl = advanced && isCoreOperation ? <Checkbox
    appearance="subtle"
    className="flex-row-reverse! has-disabled:cursor-default has-disabled:opacity-50"
    disabled={!canCustomizeChange}
    checked={canCustomizeChange && (advancedRoute.customChangeEnabled ?? false)}
    onChange={customChangeEnabled => updateAdvancedRoute({customChangeEnabled})}
    label={<Text size={14} weight="medium" color="brand" opacity={50}>Custom Change Address</Text>}
  /> : null
  const customChangeField = canCustomizeChange && advancedRoute.customChangeEnabled ? <ChangeAddressField
    compact={recipientDraft != null}
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

  const recipientAmount = usesRecipientEditor ? activeRecipients[0]?.amount ?? '' : amount
  const amountError = amountErrorFor({
    isCoreOperation,
    amount: advancedMulti ? (amountDuffs > 0n ? davToDash(amountDuffs) : '') : recipientAmount,
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
  const editorRecipientErrors = advancedMulti ? recipientErrors : [{address: destinationError, amount: amountError}]

  const reloadIdentities = (): void => {
    if (!walletId) return
    void refreshIdentities(walletId)
  }

  const coinControlSummary = coinControlSelectionSummary(appliedCoinControl, selectedTotals)

  const clearPassword = (): void => {
    setPassword('')
    setPasswordError(null)
  }

  const closeConfirm = (): void => {
    setConfirmOpen(false)
    clearPassword()
  }

  const resetForm = (): void => {
    clearPassword()
    setRecipientDraft(null)
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
      refreshTransactions(walletId)
    }
  }

  const coreRecipientInput = !advanced && toKind === DestinationKind.CoreAddress && operation != null
  const ownRecipientsLoading = {
    [DestinationKind.CoreAddress]: coreAddressesLoading,
    [DestinationKind.PlatformAddress]: platformAddressesLoading,
    [DestinationKind.Identity]: identitiesLoading,
    [DestinationKind.Shielded]: savedShielded.loading,
    [DestinationKind.NewIdentity]: false,
  }[toKind]
  const ownRecipientsError = {
    [DestinationKind.CoreAddress]: coreAddressesError,
    [DestinationKind.PlatformAddress]: platformAddressesError,
    [DestinationKind.Identity]: identitiesError,
    [DestinationKind.Shielded]: savedShielded.errorMessage,
    [DestinationKind.NewIdentity]: null,
  }[toKind]
  const retryOwnRecipients = (): void => {
    if (!walletId) return
    if (toKind === DestinationKind.CoreAddress) invalidateAsyncCache('addresses', walletId)
    else if (toKind === DestinationKind.PlatformAddress) void refreshPlatformAddresses(walletId)
    else if (toKind === DestinationKind.Identity) reloadIdentities()
    else if (toKind === DestinationKind.Shielded) savedShielded.retry()
  }
  const changeDestinationKind = (kind: DestinationKind): void => {
    setToKind(kind)
    if (!advanced) setToValue('')
    setAcked(false)
  }
  const changeSendMode = (mode: boolean): void => {
    clearPassword()
    updateDraft(current => setSendAdvanced(current, mode))
    setWizardKey(key => key + 1)
  }
  let recipientControl: React.ReactNode
  if (usesRecipientEditor) {
    recipientControl = (
      <CoinControlButton
        label={PAGE_HEADERS.recipients.title}
        summary={<>
          <span className="opacity-[.48]">(</span>
          <strong className="font-bold">{activeRecipients.length}</strong>
          <span className="opacity-[.48]">/{recipientLimit})</span>
        </>}
        onClick={() => setRecipientDraft(savedAdvancedRoute)}
      />
    )
  } else if (coreRecipientInput) {
    recipientControl = <RecipientInput compact value={toValue} onChange={setToValue} data={sendPageData.recipient} ownOptions={ownRecipients} ownOptionsLoading={ownRecipientsLoading} ownOptionsError={ownRecipientsError} onRetryOwnOptions={retryOwnRecipients} />
  }
  const routeStep = (
    <>
      <TransferRouteCards
        from={<>
          <SourcePicker
            compact
            trailingControl={operation != null && fromKind !== SourceKind.Identity
              ? <CoinControlButton summary={coinControlSummary} onClick={() => setCoinControlOpen(true)} />
              : undefined}
            kind={fromKind}
            onKindChange={k => {
              setFromKind(k)
              setAcked(false)
              if (k === SourceKind.Identity && identities.length === 0) reloadIdentities()
            }}
            platformAddresses={fundedAddresses}
            selectedPlatformAddress={undefined}
            onPlatformAddressChange={() => {}}
            platformAutomaticLabel={AUTOMATIC_PLATFORM_SELECTION}
            platformAddressesLoading={platformAddressesLoading}
            platformAddressesError={platformAddressesError}
            onRetryPlatformAddresses={() => { if (walletId) void refreshPlatformAddresses(walletId) }}
            showPlatformAddress={false}
            identities={identities}
            identitiesLoading={identitiesLoading}
            identitiesError={identitiesError}
            selectedIdentity={selectedIdentity}
            onIdentityChange={setFromIdentity}
            onRetryIdentities={reloadIdentities}
          />
          {coinControlSelectionError && <Text size={12} weight="medium" color="red" className="mt-2 block px-1">{coinControlSelectionError}</Text>}
        </>}
        to={<div className="flex flex-col gap-2">
          <DestinationPicker
            compact
            trailingControl={recipientControl}
            kind={toKind}
            kinds={destinationKinds}
            onKindChange={changeDestinationKind}
            value={coreRecipientInput ? trimmedTo : toValue}
            onValueChange={setToValue}
            placeholder={destinationPlaceholder}
            error={usesRecipientEditor ? null : destinationError}
            showValueInput={!advanced && !coreRecipientInput && operation != null}
            ownOptions={!advanced ? ownRecipients : undefined}
            ownOptionsLoading={!advanced && ownRecipientsLoading}
            ownOptionsError={!advanced ? ownRecipientsError : null}
            onRetryOwnOptions={retryOwnRecipients}
          />
          {coreRecipientInput && <>
            {destinationError && <Text size={12} weight={"medium"} color={"red"} className={"px-1"}>{destinationError}</Text>}
          </>}
          {!advanced && operation != null && toKind !== DestinationKind.NewIdentity && <>
            {ownRecipients.length === 0 && !ownRecipientsLoading && !ownRecipientsError && (
              <Text size={12} weight="medium" color="brand" opacity={50}>
                {toKind === DestinationKind.Identity ? 'No identities in this wallet. Enter an identity ID manually.'
                  : toKind === DestinationKind.Shielded && shieldedSync.phase !== ShieldedSyncPhase.Done
                    ? 'Sync shielded notes to find unused addresses. You can enter a recipient address manually.'
                    : 'No unused addresses of this type in your wallet. Enter a recipient address manually.'}
              </Text>
            )}
          </>}
        </div>}
      />

      {fromKind === SourceKind.Shielded && (
        <ShieldedNotesAlert walletId={walletId} onSync={() => setNotesUnlockOpen(true)} syncing={notesSyncing} />
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
            Locking Dash for Platform credits broadcasts a Core transaction, waits for a ChainLock (a few minutes) and then credits the address. The process resumes automatically if interrupted.
          </Text>
        </div>
      )}

      {operation === TransferOperation.AssetLockShield && (
        <div className={"flex flex-col gap-[.375rem] p-[.875rem] rounded-[.9375rem] dash-block-3"}>
          <Text size={14} weight={"extrabold"} color={"brand"}>Two-step shielding</Text>
          <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"leading-[130%]"}>
            Locking Dash broadcasts a Core transaction, waits for a ChainLock (a few minutes) and then shields the credits straight into the recipient's shielded balance. The Core lock amount stays publicly visible; the process resumes automatically if interrupted.
          </Text>
        </div>
      )}

      {operation === TransferOperation.IdentityRegister && (
        <div className={"flex flex-col gap-[.375rem] p-[.875rem] rounded-[.9375rem] dash-block-3"}>
          <Text size={14} weight={"extrabold"} color={"brand"}>New Platform identity</Text>
          <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"leading-[130%]"}>
            Locks Dash on Core and registers a new identity funded with the locked amount as credits. The registration waits for the network to lock the transaction — usually seconds; the process resumes automatically if interrupted.
          </Text>
        </div>
      )}

      {operation === TransferOperation.IdentityTopUpL1 && (
        <div className={"flex flex-col gap-[.375rem] p-[.875rem] rounded-[.9375rem] dash-block-3"}>
          <Text size={14} weight={"extrabold"} color={"brand"}>Top up from Core</Text>
          <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"leading-[130%]"}>
            Locks Dash on Core and credits the identity with the locked amount. You can top up any identity by its identifier — not just your own. The process resumes automatically if interrupted.
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
            appearance={"subtle"}
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

  let totalSourceBalanceDuffs: bigint | null = null
  if (isCoreOperation) totalSourceBalanceDuffs = balanceDuffs
  else if (availableCredits != null) totalSourceBalanceDuffs = creditsToDuffs(availableCredits)
  const totalSourceBalanceDisplay = totalSourceBalanceDuffs == null ? sourceBalanceDisplay : (
    <span><DashBigNumber>{davToDashCompact(totalSourceBalanceDuffs, 2)}</DashBigNumber><span className="font-normal"> {DASH_UNIT}</span></span>
  )

  let feeDisplay = <Text size={12} weight={"medium"} color={"brand"} opacity={50}>—</Text>
  if (isCoreOperation) {
    feeDisplay = <Text size={12} weight={"medium"} color={"brand"}>{davToDash(totalFeeDuffs)} Dash</Text>
  } else if (feeErr === null && feeCredits !== null) {
    feeDisplay = <Text size={12} weight={"medium"} color={"brand"}><CreditsAmount credits={feeCredits} align={"end"} /></Text>
  } else if (feeErr === null && feeLoading) {
    feeDisplay = <Spinner size={14} />
  }

  const withdrawalNotice = (operation === TransferOperation.AddressWithdrawal || operation === TransferOperation.IdentityWithdrawal) && (
    <div className={`${SURFACE_SECTION} mb-4 flex flex-col gap-[.375rem]`}>
      <Text size={14} weight="extrabold" color="brand">Cross-chain withdrawal</Text>
      <Text size={12} weight="medium" color="brand" opacity={50} className="leading-[130%]">
        The Dash payout arrives asynchronously after the withdrawal is processed.
      </Text>
    </div>
  )
  const amountStep = (
    <div>
      {withdrawalNotice}
      {operation === TransferOperation.IdentityCreateFromShielded && (
        <DenominationChips
          denominations={POOL_IDENTITY_DENOMINATIONS}
          selected={amountCredits}
          onSelect={denomination => setAmount(davToDash(creditsToDuffs(denomination)))}
          className={"mb-3"}
        />
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
      {feeErr && <RetryButton onRetry={retryFee} label={SIMPLE_SEND_LABELS.retryFee} className={"mt-2 ml-1"} />}
      <div className={"mt-2 px-1 flex items-center justify-between gap-3"}>
        {sourceBalanceDisplay}
        {amountFiat && <Text size={12} weight={"medium"} color={"blue-mint"}>{formatApproxFiat(amountFiat)}</Text>}
      </div>
      <div className={"mt-2 px-1 flex items-center justify-between gap-3"}>
        <Text size={12} weight={"medium"} color={"brand"} opacity={50}>{isCoreOperation ? 'Network fee' : 'Reserved for fee'}</Text>
        {feeDisplay}
      </div>
    </div>
  )

  let fromDisplay = 'Your shielded balance'
  let fromAddress: string | null = null
  switch (fromKind) {
    case SourceKind.Core:
      fromDisplay = AUTOMATIC_SOURCE_LABELS[SourceKind.Core]
      break
    case SourceKind.PlatformAddress:
      if (appliedCoinControl.kind === 'platformAddress') {
        fromDisplay = appliedCoinControl.address
        fromAddress = appliedCoinControl.address
      } else if (appliedCoinControl.kind === 'platformInputs') {
        if (appliedCoinControl.inputs.length === 1) {
          fromDisplay = '1 Platform input'
        } else {
          fromDisplay = `${appliedCoinControl.inputs.length} Platform inputs`
        }
      } else {
        fromDisplay = AUTOMATIC_PLATFORM_SELECTION
      }
      break
    case SourceKind.Identity:
      fromDisplay = selectedIdentity?.identifier ?? ''
      fromAddress = selectedIdentity?.identifier ?? null
      break
  }

  const fromEndpoint = sourceEndpoint(fromKind, normalizedCoinControl, coinControlSummary, selectedIdentity?.identifier)
  const toDisplay = toKind === DestinationKind.NewIdentity ? 'New identity' : trimmedTo

  const previewParams = operation == null ? null : sendPreviewParams({
    operation,
    recipients: recipientsDuffs,
    coreSource: coreSpendSource,
    platformSource,
    shieldedSource: shieldedSpendSource,
    identityId: selectedIdentity?.identifier,
    changeTo,
  })
  const previewKey = sendPreviewRequestKey({walletId, network, operation, params: previewParams})
  const reviewCurrent = review?.key === previewKey && preview.data != null && !preview.loading && !preview.error
  const signingSourceValid = canSubmit && (!previewOpen || reviewCurrent)
  signingSourceValidRef.current = signingSourceValid
  const confirmationPreview = previewOpen ? preview.data : null
  const confirmationFeeDuffs = confirmationPreview?.feeDuffs ?? feeDuffs
  const confirmationFeeCredits = confirmationPreview?.feeCredits ?? feeCredits
  const confirmationDebitCredits = confirmationPreview?.totalDebitCredits ?? totalDebitCredits
  const summary = operation == null ? null : sendSummary({
    operation,
    from: fromEndpoint,
    destination: toKind,
    toDisplay,
    coreRecipients: recipientsDuffs,
    platformRecipients: displayRecipientsCredits,
    feeOutputIndex: displayFeeOutputIndex,
    amountDuffs,
    amountCredits,
    feeDuffs: confirmationFeeDuffs,
    feeCredits: confirmationFeeCredits,
    totalDebitCredits: confirmationDebitCredits,
  })
  const simpleSubmit = simpleSendSubmit({operation, sourceValid: signingSourceValid, password, verifying, prover})
  const presetPassword = advanced || previewOpen ? undefined : password

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
      fromAddress,
    })
  }

  const signTransaction = (): void => {
    if (signingSourceValid) setConfirmOpen(true)
  }

  const submitSimpleSend = async (): Promise<void> => {
    if (!walletId || !simpleSubmit.ready || verifyingRef.current) return
    verifyingRef.current = true
    setVerifying(true)
    setPasswordError(null)
    try {
      if (!await API.verifyWalletPassword(walletId, password)) {
        setPasswordError(INVALID_WALLET_PASSWORD_MESSAGE)
        return
      }
      if (!signingSourceValidRef.current) {
        toast.error(SEND_INPUTS_CHANGED_MESSAGE)
        return
      }
      setConfirmOpen(true)
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      verifyingRef.current = false
      setVerifying(false)
    }
  }

  const confirmStep = (
    <div className={"flex flex-col gap-3"}>
      {summary && <TxSummary {...summary} />}
      <button type="button" onClick={showPreview} disabled={!canSubmit} className="w-full rounded-xl px-4 py-3 dash-block text-sm font-medium dash-text-default opacity-70 cursor-pointer hover:opacity-100 transition-opacity outline-none focus-visible:ring-2 focus-visible:ring-dash-brand/40 dark:focus-visible:ring-white/40 disabled:opacity-50 disabled:cursor-default">{PAGE_HEADERS.sendPreview.title}</button>
      <PasswordField
        id={SIMPLE_SEND_PASSWORD_ID}
        value={password}
        onChange={value => {
          setPasswordError(null)
          setPassword(value)
        }}
        onSubmit={() => { void submitSimpleSend() }}
        error={passwordError}
      />
      {coreSourceGated && <P2pSyncAlert />}
      {simpleSubmit.proverError && (
        <Text size={12} weight={"medium"} color={"red"} className={"px-1 break-words"}>{simpleSubmit.proverError}</Text>
      )}
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

  return (
    <div className={"relative flex flex-col h-[calc(100dvh-8rem)] pb-4"} inert={confirmOpen || verifying || notesUnlockOpen || resumeOpen || dismissConfirmOpen}>
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
      {recipientDraft != null && !coinControlOpen && !previewOpen && (
        <section className="px-12" aria-label={PAGE_HEADERS.recipients.title}>
          <PageHeader
            title={PAGE_HEADERS.recipients.title}
            subtitle={PAGE_HEADERS.recipients.subtitle}
            onBack={() => setRecipientDraft(null)}
            backLabel={PAGE_HEADERS.recipients.back}
          />
          <SendRecipientsEditor
            recipients={activeRecipients}
            errors={editorRecipientErrors}
            limit={recipientLimit}
            destination={toKind}
            budgetDuffs={allocationBudgetDuffs}
            feeRecipientId={subtractFee ? advancedRoute.feeRecipientId : null}
            feeCredits={feeCredits}
            budgetIsEstimate={!allocationReady}
            amountDenominations={operation === TransferOperation.IdentityCreateFromShielded ? POOL_IDENTITY_DENOMINATIONS : undefined}
            headerAction={customChangeControl}
            beforeRecipients={withdrawalNotice || customChangeField ? <>{withdrawalNotice}{customChangeField}</> : undefined}
            onChange={recipients => updateAdvancedRoute({recipients})}
            footer={<div className="flex gap-3">
              <Button type="button" variant="solid" colorScheme="lightBlue-mint" size="md" className={TRANSFER_WIZARD_CTA_CLASS} onClick={() => updateAdvancedRoute({
                recipients: [{id: activeRecipients[0]?.id ?? 'first', address: '', amount: ''}],
                feeRecipientId: subtractFee ? activeRecipients[0]?.id ?? 'first' : null,
                customChangeEnabled: false,
                changeAddress: undefined,
              })}>Reset</Button>
              <Button type="button" variant="solid" colorScheme="primary" size="md" className={TRANSFER_WIZARD_CTA_CLASS} onClick={applyRecipients}>Apply</Button>
            </div>}
          />
        </section>
      )}
      <div className={previewOpen || coinControlOpen || recipientDraft != null ? 'hidden' : `flex flex-1 min-h-0 flex-col overflow-y-auto px-12 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${advanced ? '' : 'pb-8'}`}>
        <PageHeader
          title={PAGE_HEADERS.send.title}
          subtitle={PAGE_HEADERS.send.subtitle}
          actions={<SegmentedControl
            appearance={SegmentedControlAppearance.Pill}
            ariaLabel={SEND_MODE_LABEL}
            options={SEND_MODE_OPTIONS}
            value={advanced ? SendMode.Advanced : SendMode.Simple}
            onChange={mode => changeSendMode(mode === SendMode.Advanced)}
          />}
          actionsFooter={shieldedInvolved && <ProverPill status={prover} />}
        />

        {resumableFunding && (
          <div className={`${SURFACE_SECTION} mb-7 flex items-center justify-between gap-4`}>
            <div className={"flex flex-col gap-1 min-w-0"}>
              <Text size={14} weight={"extrabold"} color={"brand"}>
                {UNFINISHED_FUNDING_LABELS[resumableFunding.kind]}
              </Text>
              <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"break-all leading-[130%]"}>
                {resumableFunding.amountDuffs != null && `${davToDash(resumableFunding.amountDuffs)} ${DASH_UNIT} `}→ {resumableFunding.kind === AssetLockFundingKind.Identity ? 'new identity' : (resumableFunding.toPlatformAddress ?? '')}
              </Text>
            </div>
            <div className={"shrink-0 flex items-center gap-2"}>
              {resumableFunding.phase === AssetLockFundingPhase.Resumable && (
                <Button
                  type={"button"}
                  variant={"outline"}
                  colorScheme={"red"}
                  size={"compact"}
                  onClick={() => setDismissConfirmOpen(true)}
                  disabled={dismissBusy}
                  className={"gap-1.5"}
                >
                  {dismissBusy && <Spinner size={12} className={"text-red-700 dark:text-red-400"} />}
                  {dismissBusy ? 'Dismissing…' : 'Dismiss'}
                </Button>
              )}
              <Button
                type={"button"}
                colorScheme={"primary"}
                size={"compact"}
                onClick={() => setResumeOpen(true)}
                disabled={dismissBusy}
              >
                {resumableFunding.phase === AssetLockFundingPhase.Resumable ? 'Resume' : 'View progress'}
              </Button>
            </div>
          </div>
        )}

        {advanced ? (
          <div className="mt-4 flex min-w-0 flex-col gap-10 pb-6">
            <div className="flex flex-col gap-5 min-w-0">
              <div className="flex flex-col gap-4">{routeStep}</div>
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
              onReview={showPreview}
            >
              <EndpointKindIcon kind={fromKind} />
              <div className="mt-2 flex items-end justify-between gap-2">
                <div className="flex min-w-0 flex-col gap-0.5 text-xs font-extrabold dash-text-default">
                  <Text size={12} weight="medium" color="brand" opacity={50}>Balance:</Text>
                  {totalSourceBalanceDisplay}
                </div>
                {rateReady && totalSourceBalanceDuffs != null && <span className={`shrink-0 ${CHIP_VALUE} dash-text-primary`}>{formatApproxFiat(formatFiat(totalSourceBalanceDuffs))}</span>}
              </div>
            </TransactionSummary>
          </div>
        ) : <>
          <div className="flex flex-1 flex-col min-h-0">
            <TransferWizard
              key={wizardKey}
              steps={[
                { label: 'From & To', content: routeStep, canAdvance: routeReady },
                { label: 'Amount', content: amountStep, canAdvance: canSubmit },
                { label: 'Confirm', content: confirmStep },
              ]}
              onSubmit={() => { void submitSimpleSend() }}
              submitLabel={simpleSubmit.label}
              submitDisabled={!simpleSubmit.ready}
              onStepChange={clearPassword}
            />
          </div>
        </>}
      </div>

      <CoinControlModal
        isOpen={coinControlOpen}
        feeFromOutput={subtractFee}
        operation={operation}
        selection={normalizedCoinControl}
        coreAddresses={coreAddresses}
        coreAddressesLoading={coreAddressesLoading}
        coreAddressesError={coreAddressesError}
        onRetryCoreAddresses={() => { if (walletId) invalidateAsyncCache('addresses', walletId) }}
        utxos={utxos}
        utxosLoading={utxosLoading}
        utxosLocalSnapshot={utxosLocalSnapshot}
        utxosError={utxosError}
        coreSyncIncomplete={syncIncomplete}
        platformAddresses={fundedAddresses}
        platformAddressesLoading={platformAddressesLoading}
        platformAddressesError={platformAddressesError}
        onRetryPlatformAddresses={() => { if (walletId) void refreshPlatformAddresses(walletId) }}
        shieldedNotes={spendableNotes}
        identityLabel={selectedIdentity?.alias ?? null}
        identityId={selectedIdentity?.identifier ?? null}
        platformAddress={undefined}
        onRetryUtxos={retryUtxos}
        onClose={() => setCoinControlOpen(false)}
        onApply={setCoinControl}
      />

      {operation === TransferOperation.CoreSend && (
        <SendConfirmModal
          isOpen={confirmOpen}
          onClose={closeConfirm}
          walletId={walletId}
          network={network}
          recipients={recipientsDuffs}
          advanced={advanced}
          from={fromEndpoint}
          feeDuffs={confirmationFeeDuffs}
          source={coreSpendSource}
          changeTo={changeTo}
          sourceValid={signingSourceValid}
          presetPassword={presetPassword}
          onSuccess={() => {
            resetForm()
            if (walletId) {
              refreshBalance(walletId)
            }
          }}
        />
      )}

      {operation === TransferOperation.Shield && (
        <ShieldConfirmModal
          advanced={advanced}
          isOpen={confirmOpen}
          onClose={closeConfirm}
          walletId={walletId}
          source={platformSource}
          from={fromEndpoint}
          sourceValid={signingSourceValid}
          toAddress={trimmedTo}
          amountCredits={amountCredits}
          feeCredits={confirmationFeeCredits}
          totalCredits={confirmationFeeCredits === null ? null : confirmationDebitCredits}
          proverReady={prover.ready}
          presetPassword={presetPassword}
          onSuccess={resetForm}
        />
      )}

      {info?.spendKind != null && (
        <ShieldedSpendModal
          advanced={advanced}
          isOpen={confirmOpen}
          onClose={closeConfirm}
          walletId={walletId}
          title={info.title}
          kind={info.spendKind}
          from={fromEndpoint}
          toValue={operation === TransferOperation.IdentityCreateFromShielded ? POOL_IDENTITY_LABEL : trimmedTo}
          recipients={operation === TransferOperation.ShieldedTransfer ? recipientsCredits : undefined}
          amountCredits={amountCredits}
          feeCredits={confirmationFeeCredits}
          proverReady={prover.ready}
          start={startShieldedSpend}
          sourceValid={signingSourceValid}
          presetPassword={presetPassword}
          onSuccess={resetForm}
          successNote={operation === TransferOperation.ShieldedWithdrawal ? WITHDRAWAL_SUCCESS_NOTE : undefined}
        />
      )}

      {(operation === TransferOperation.AssetLockFunding || operation === TransferOperation.AssetLockShield || operation === TransferOperation.IdentityRegister || operation === TransferOperation.IdentityTopUpL1) && (
        <AssetLockFundingModal
          advanced={advanced}
          isOpen={confirmOpen}
          onClose={() => { closeConfirm(); setFundingRefresh(n => n + 1) }}
          walletId={walletId}
          toPlatformAddress={operation === TransferOperation.IdentityRegister ? '' : trimmedTo}
          amountDuffs={amountDuffs}
          feeDuffs={confirmationFeeDuffs}
          feeCredits={confirmationFeeCredits}
          from={fromEndpoint}
          resume={false}
          kind={OPERATION_FUNDING_KINDS[operation] ?? AssetLockFundingKind.Address}
          source={coreSpendSource}
          sourceValid={signingSourceValid}
          presetPassword={presetPassword}
          onSuccess={() => {
            resetForm()
            if (walletId) {
              refreshBalance(walletId)
            }
          }}
        />
      )}

      <AssetLockFundingModal
        isOpen={resumeOpen}
        onClose={() => setResumeOpen(false)}
        walletId={walletId}
        toPlatformAddress={resumableFunding?.toPlatformAddress ?? ''}
        amountDuffs={resumableFunding?.amountDuffs ?? null}
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
        onClose={() => {
          if (!dismissBusy) setDismissConfirmOpen(false)
        }}
        onConfirm={dismissFunding}
      />

      {isPlatformModalOperation && summary != null && (
        <TransferConfirmModal
          advanced={advanced}
          isOpen={confirmOpen}
          onClose={closeConfirm}
          title={info?.title ?? 'Confirm transfer'}
          successTitle={operation === TransferOperation.IdentityCreate ? 'Identity created' : 'Credits sent'}
          recipients={operation === TransferOperation.AddressFundsTransfer ? displayRecipientsCredits : undefined}
          feeOutputIndex={displayFeeOutputIndex}
          feeCredits={confirmationFeeCredits}
          summary={summary}
          run={runPlatformOperation}
          sourceValid={signingSourceValid}
          presetPassword={presetPassword}
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
