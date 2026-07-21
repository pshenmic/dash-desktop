import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { DashLogo } from "dash-ui-kit/react";
import { Text, CreditsIcon, ShieldSmallIcon } from "@renderer/components/dash-ui-kit-enxtended";
import SyncGateNotice from "@renderer/components/ui/SyncGateNotice";
import CreditsAmount from "@renderer/components/ui/CreditsAmount";
import Checkbox from "@renderer/components/ui/Checkbox";
import ProverPill from "@renderer/components/pages/shielded/ProverPill";
import { useAuth } from "@renderer/contexts/AuthContext";
import { useConnectionModeContext } from "@renderer/contexts/ConnectionModeContext";
import { useFiat } from "@renderer/hooks/useFiat";
import { useWalletBalance, refreshBalance } from "@renderer/hooks/useWalletBalance";
import { refreshTransactions } from "@renderer/hooks/useWalletTransactions";
import { usePlatformAddresses, prefetchPlatformAddresses } from "@renderer/hooks/usePlatformAddresses";
import { useAdresses } from "@renderer/hooks/useAdresses";
import { useIdentities, prefetchIdentities } from "@renderer/hooks/useIdentities";
import { useShieldedStatus, useShieldedSyncState } from "@renderer/hooks/useShielded";
import { davToDash, davToDashCompact, dashToDuffs } from "@renderer/utils/balance";
import { isValidDashAddress } from "@renderer/utils/address";
import { isValidPlatformAddress } from "@renderer/utils/platformAddress";
import { isLikelyShieldedAddress } from "@renderer/utils/shieldedAddress";
import {
  SourceKind,
  DestinationKind,
  SOURCE_KINDS,
  DESTINATION_KINDS,
  resolveOperation,
  unsupportedReason,
  operationInfo,
  isLikelyIdentityId,
  isPoolIdentityDenomination,
  POOL_IDENTITY_DENOMINATIONS,
} from "@renderer/utils/transferMatrix";
import { API } from "@renderer/api";
import { AssetLockFundingState, PlatformAddressDto, ShieldedSpendState } from "@renderer/api/types";
import { sendPageData } from "@renderer/constants";
import AmountField from "./AmountField";
import TransferWizard from "./TransferWizard";
import RecipientInput from "./RecipientInput";
import { SourcePicker, DestinationPicker } from "./EndpointPicker";
import CoreAddressSelect from "@renderer/components/pages/receive/CoreAddressSelect";
import ShieldedNoteSelect from "./ShieldedNoteSelect";
import TransferConfirmModal from "@renderer/components/modal/TransferConfirmModal";
import AssetLockFundingModal from "@renderer/components/modal/AssetLockFundingModal";
import SendConfirmModal from "@renderer/components/modal/SendConfirmModal";
import ShieldConfirmModal from "@renderer/components/modal/ShieldConfirmModal";
import ShieldedSpendModal from "@renderer/components/modal/ShieldedSpendModal";

const MAX_SPEND_NOTES = 6

function initialSourceKind(value: string | null): SourceKind {
  return SOURCE_KINDS.some(k => k.kind === value) ? value as SourceKind : 'core'
}

function initialDestinationKind(value: string | null): DestinationKind {
  return DESTINATION_KINDS.some(k => k.kind === value) ? value as DestinationKind : 'coreAddress'
}

export default function TransferHub(): React.JSX.Element {
  const { status } = useAuth()
  const walletId = status?.selectedWalletId ?? null
  const network = status?.network ?? null

  const [searchParams] = useSearchParams()
  const [fromKind, setFromKind] = useState<SourceKind>(() => initialSourceKind(searchParams.get('from')))
  const [toKind, setToKind] = useState<DestinationKind>(() => initialDestinationKind(searchParams.get('to')))
  const [fromAddress, setFromAddress] = useState('')
  const [fromIdentity, setFromIdentity] = useState('')
  const [toValue, setToValue] = useState('')
  const [amount, setAmount] = useState('')
  const [acked, setAcked] = useState(false)
  const [useSpecificSource, setUseSpecificSource] = useState(false)
  const [coreFromAddress, setCoreFromAddress] = useState<string | null>(null)
  const [shieldedNoteIndex, setShieldedNoteIndex] = useState<number | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [wizardKey, setWizardKey] = useState(0)
  const [resumableFunding, setResumableFunding] = useState<AssetLockFundingState | null>(null)
  const [resumeOpen, setResumeOpen] = useState(false)

  useEffect(() => {
    if (!walletId) return
    let dead = false
    API.getAssetLockFundingState(walletId)
      .then(state => {
        if (!dead && state.phase !== 'idle' && state.phase !== 'done' && state.phase !== 'error') {
          setResumableFunding(state)
        }
      })
      .catch(() => {})
    return () => { dead = true }
  }, [walletId, wizardKey])

  const { fallbackActive: syncIncomplete } = useConnectionModeContext()
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
  const shieldedInvolved = fromKind === 'shielded' || toKind === 'shielded'
  const optionalShieldRecipient = operation === 'assetLockShield'

  const destinationKinds = useMemo(
    () => DESTINATION_KINDS.filter(d => d.kind !== 'newIdentity' && resolveOperation(fromKind, d.kind) != null),
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
  const selectedCoreAddress = coreAddresses.find(a => a.address === coreFromAddress) ?? coreAddresses[0]
  const coreSpecificAddress = operation === 'coreSend' && useSpecificSource ? selectedCoreAddress : undefined

  const spendableNotes = useMemo(
    () => (shieldedSync.phase === 'done' ? shieldedSync.notes.filter(n => !n.spent) : [])
      .slice()
      .sort((a, b) => (BigInt(a.amount) < BigInt(b.amount) ? 1 : BigInt(a.amount) > BigInt(b.amount) ? -1 : 0)),
    [shieldedSync.phase, shieldedSync.notes],
  )
  const shieldedSpendOperation = operation === 'shieldedTransfer' || operation === 'unshield' || operation === 'shieldedWithdrawal'
  const selectedNote = spendableNotes.find(n => n.index === shieldedNoteIndex) ?? spendableNotes[0]
  const shieldedSpecificNote = shieldedSpendOperation && useSpecificSource ? selectedNote : undefined

  const balanceDuffs = coreSpecificAddress ? coreSpecificAddress.balance : balance.dash.amount
  const shieldedBalance = shieldedSync.phase === 'done' && shieldedSync.balance !== null ? BigInt(shieldedSync.balance) : null

  const availableCredits: bigint | null =
    fromKind === 'platformAddress' ? (selectedSource ? BigInt(selectedSource.balanceCredits) : 0n)
    : fromKind === 'identity' ? (selectedIdentity ? BigInt(String(selectedIdentity.balance.amount)) : 0n)
    : fromKind === 'shielded' ? (shieldedSpecificNote ? BigInt(shieldedSpecificNote.amount) : shieldedBalance)
    : null

  const isDashUnit = info?.unit === 'dash'
  const amountDuffs = useMemo(() => (isDashUnit ? dashToDuffs(amount) : 0n), [isDashUnit, amount])
  const amountCredits = !isDashUnit && amount.length > 0 ? BigInt(amount) : 0n
  const feeCredits = info?.feeCredits ?? 0n
  const minCredits = info?.minCredits ?? 0n

  const shieldedMaxPerTx = useMemo(() => {
    if (fromKind !== 'shielded' || shieldedSync.phase !== 'done') return null
    if (shieldedSpecificNote != null) {
      const noteAmount = BigInt(shieldedSpecificNote.amount)
      return noteAmount > feeCredits ? noteAmount - feeCredits : 0n
    }
    const top = shieldedSync.notes
      .filter((note) => !note.spent)
      .map((note) => BigInt(note.amount))
      .sort((a, b) => (a < b ? 1 : a > b ? -1 : 0))
      .slice(0, MAX_SPEND_NOTES)
    const total = top.reduce((sum, value) => sum + value, 0n)
    return total > feeCredits ? total - feeCredits : 0n
  }, [fromKind, shieldedSync.phase, shieldedSync.notes, feeCredits, shieldedSpecificNote])

  const trimmedTo = toValue.trim()

  const sourceReady =
    fromKind === 'core' ? true
    : fromKind === 'platformAddress' ? selectedSource != null
    : fromKind === 'identity' ? selectedIdentity != null
    : true

  const destinationValid =
    toKind === 'coreAddress' ? isValidDashAddress(trimmedTo, network ?? undefined)
    : toKind === 'platformAddress' ? isValidPlatformAddress(trimmedTo, network ?? undefined)
    : toKind === 'identity' ? isLikelyIdentityId(trimmedTo)
    : toKind === 'newIdentity' ? true
    : (optionalShieldRecipient && trimmedTo.length === 0) || isLikelyShieldedAddress(trimmedTo)

  const selfSend =
    (operation === 'addressFundsTransfer' && destinationValid && selectedSource != null && trimmedTo === selectedSource.platformAddress)
    || (operation === 'identityToIdentity' && destinationValid && selectedIdentity != null && trimmedTo === selectedIdentity.identifier)

  const destinationError = toKind === 'newIdentity' || trimmedTo.length === 0
    ? null
    : !destinationValid
      ? (toKind === 'coreAddress' ? `Enter a valid Dash ${network ?? ''} address.`
        : toKind === 'platformAddress' ? `Enter a valid Platform ${network ?? ''} address.`
        : toKind === 'identity' ? 'Enter a valid identity identifier.'
        : 'Enter a valid shielded address.')
      : selfSend
        ? (operation === 'identityToIdentity' ? 'Recipient must be different from the source identity.' : 'Recipient must be different from the source address.')
        : null

  const needsAck = operation === 'shieldedWithdrawal'
  const destinationReady = destinationValid && !selfSend && (!needsAck || acked)
  const routeReady = operation != null && sourceReady && destinationReady

  const amountReady = isDashUnit
    ? amountDuffs > 0n && amountDuffs <= balanceDuffs
    : amountCredits >= minCredits && amountCredits > 0n
      && (availableCredits === null || amountCredits + feeCredits <= availableCredits)
      && (shieldedMaxPerTx === null || amountCredits <= shieldedMaxPerTx)
      && (operation !== 'identityCreateFromPool' || isPoolIdentityDenomination(amountCredits))

  const canSubmit = routeReady && amountReady && !(operation === 'coreSend' && syncIncomplete)

  const amountFiat = isDashUnit && rateReady && amountDuffs > 0n ? formatFiat(amountDuffs) : undefined

  const handleAmount = (e: React.ChangeEvent<HTMLInputElement>): void => {
    if (isDashUnit) {
      const val = e.target.value.replace(/[^0-9.]/g, '')
      const parts = val.split('.')
      if (parts.length > 2) return
      if (parts[1] && parts[1].length > 8) return
      setAmount(val)
    } else {
      setAmount(e.target.value.replace(/[^\d]/g, ''))
    }
  }

  const handleMax = (): void => {
    if (isDashUnit) {
      setAmount(davToDash(balanceDuffs))
      return
    }
    if (availableCredits === null) return
    const spendable = shieldedMaxPerTx !== null && shieldedMaxPerTx < availableCredits - feeCredits
      ? shieldedMaxPerTx
      : availableCredits - feeCredits
    setAmount(spendable > 0n ? spendable.toString() : '0')
  }

  const destinationPlaceholder =
    toKind === 'coreAddress' ? (network === 'mainnet' ? 'X… (Dash address)' : 'y… (Dash address)')
    : toKind === 'platformAddress' ? (network === 'mainnet' ? 'dash1…' : 'tdash1…')
    : toKind === 'identity' ? 'Identity identifier'
    : 'shielded address'

  const amountError = isDashUnit || amount.length === 0
    ? null
    : operation === 'identityCreateFromPool' && !isPoolIdentityDenomination(amountCredits)
      ? 'Pick one of the fixed denominations above.'
      : amountCredits < minCredits
        ? `Minimum is ${minCredits.toLocaleString('en-US')} credits.`
        : availableCredits !== null && amountCredits + feeCredits > availableCredits
          ? `Amount plus the ${feeCredits.toLocaleString('en-US')} credit fee exceeds this balance.`
          : shieldedMaxPerTx !== null && amountCredits > shieldedMaxPerTx
            ? `Limited to ${MAX_SPEND_NOTES} notes per transaction — max right now is ${shieldedMaxPerTx.toLocaleString('en-US')} credits.`
            : null

  const resetForm = (): void => {
    setToValue('')
    setAmount('')
    setAcked(false)
    setWizardKey(k => k + 1)
    if (walletId) {
      prefetchPlatformAddresses(walletId)
      prefetchIdentities(walletId)
    }
  }

  const routeStep = (
    <>
      <SourcePicker
        kind={fromKind}
        onKindChange={k => { setFromKind(k); setAcked(false) }}
        platformAddresses={fundedAddresses}
        selectedPlatformAddress={selectedSource}
        onPlatformAddressChange={setFromAddress}
        identities={identities}
        selectedIdentity={selectedIdentity}
        onIdentityChange={setFromIdentity}
      />

      {(operation === 'coreSend' || shieldedSpendOperation) && (
        <div className={"flex flex-col gap-2"}>
          <Checkbox
            checked={useSpecificSource}
            onChange={setUseSpecificSource}
            label={<Text size={12} weight={"medium"} color={"brand"}>{operation === 'coreSend' ? 'Send from a specific address' : 'Send from a specific note'}</Text>}
          />
          {useSpecificSource && operation === 'coreSend' && (
            <CoreAddressSelect
              addresses={coreAddresses}
              selected={selectedCoreAddress}
              onSelect={setCoreFromAddress}
            />
          )}
          {useSpecificSource && shieldedSpendOperation && (
            <ShieldedNoteSelect
              notes={spendableNotes}
              selected={selectedNote}
              onSelect={setShieldedNoteIndex}
            />
          )}
        </div>
      )}

      {toKind === 'coreAddress' && operation === 'coreSend' ? (
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

      {optionalShieldRecipient && (
        <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"px-1 leading-[130%]"}>
          Leave the address empty to shield to this wallet's own shielded balance.
        </Text>
      )}

      {reason && (
        <div className={"flex flex-col gap-[.375rem] p-[.875rem] rounded-[.9375rem] dash-block-3"}>
          <Text size={12} weight={"medium"} color={"brand"} opacity={60} className={"leading-[130%]"}>{reason}</Text>
        </div>
      )}

      {operation === 'unshield' && (
        <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"px-1 leading-[130%]"}>
          Unshield moves credits from the pool to a transparent Platform address — the amount and destination become public.
        </Text>
      )}

      {operation === 'assetLockFunding' && (
        <div className={"flex flex-col gap-[.375rem] p-[.875rem] rounded-[.9375rem] dash-block-3"}>
          <Text size={14} weight={"extrabold"} color={"brand"}>Two-step funding</Text>
          <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"leading-[130%]"}>
            Locking Dash for Platform credits broadcasts an L1 transaction, waits for a ChainLock (a few minutes) and then credits the address. The process resumes automatically if interrupted.
          </Text>
        </div>
      )}

      {operation === 'assetLockShield' && (
        <div className={"flex flex-col gap-[.375rem] p-[.875rem] rounded-[.9375rem] dash-block-3"}>
          <Text size={14} weight={"extrabold"} color={"brand"}>Two-step shielding</Text>
          <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"leading-[130%]"}>
            Locking Dash broadcasts an L1 transaction, waits for a ChainLock (a few minutes) and then shields the credits straight into your shielded balance. The L1 lock amount stays publicly visible; the process resumes automatically if interrupted.
          </Text>
        </div>
      )}

      {operation === 'identityRegister' && (
        <div className={"flex flex-col gap-[.375rem] p-[.875rem] rounded-[.9375rem] dash-block-3"}>
          <Text size={14} weight={"extrabold"} color={"brand"}>New Platform identity</Text>
          <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"leading-[130%]"}>
            Locks Dash on L1 and registers a new identity funded with the locked amount as credits. The registration waits for the network to lock the transaction — usually seconds; the process resumes automatically if interrupted.
          </Text>
        </div>
      )}

      {operation === 'identityTopUpL1' && (
        <div className={"flex flex-col gap-[.375rem] p-[.875rem] rounded-[.9375rem] dash-block-3"}>
          <Text size={14} weight={"extrabold"} color={"brand"}>Top up from L1</Text>
          <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"leading-[130%]"}>
            Locks Dash on L1 and credits the identity with the locked amount. You can top up any identity by its identifier — not just your own. The process resumes automatically if interrupted.
          </Text>
        </div>
      )}

      {(operation === 'addressWithdrawal' || operation === 'identityWithdrawal') && (
        <div className={"flex flex-col gap-[.375rem] p-[.875rem] rounded-[.9375rem] dash-block-3"}>
          <Text size={14} weight={"extrabold"} color={"brand"}>Cross-chain withdrawal</Text>
          <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"leading-[130%]"}>
            Withdrawing to Core costs a 400,000,000 credit network fee and the Dash payout arrives asynchronously after the withdrawal is processed.
          </Text>
        </div>
      )}

      {operation === 'identityCreateFromPool' && (
        <div className={"flex flex-col gap-[.375rem] p-[.875rem] rounded-[.9375rem] dash-block-3"}>
          <Text size={14} weight={"extrabold"} color={"brand"}>New identity from the pool</Text>
          <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"leading-[130%]"}>
            Creates a new Platform identity funded privately from your shielded balance. The protocol only allows fixed funding denominations, and the Platform fee is deducted from the chosen amount — the identity starts with slightly less. If creation fails on-chain, the credits are refunded to your Platform address.
          </Text>
        </div>
      )}

      {operation === 'shieldedWithdrawal' && (
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
      {operation === 'identityCreateFromPool' && (
        <div className={"mb-3 flex flex-wrap gap-2"}>
          {POOL_IDENTITY_DENOMINATIONS.map(denomination => (
            <button
              key={denomination.toString()}
              type={"button"}
              onClick={() => setAmount(denomination.toString())}
              className={`px-4 py-2 rounded-[.75rem] cursor-pointer transition-opacity hover:opacity-90 ${amountCredits === denomination ? 'dash-bg-inverse' : 'dash-block-3'}`}
            >
              <Text size={12} weight={"extrabold"} color={amountCredits === denomination ? "blue-mint" : "brand"}>
                {(Number(denomination) / 1e11).toLocaleString('en-US')} Dash in credits
              </Text>
            </button>
          ))}
        </div>
      )}
      <AmountField
        value={amount}
        onChange={handleAmount}
        onMax={handleMax}
        unit={isDashUnit ? <DashLogo size={20} /> : <CreditsIcon size={20} />}
      />
      <div className={"mt-2 px-1 flex items-center justify-between gap-3"}>
        {isDashUnit ? (
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
        {amountError && <Text size={12} weight={"medium"} color={"red"} className={"text-right"}>{amountError}</Text>}
        {amountFiat && <Text size={12} weight={"medium"} color={"blue-mint"}>≈ {amountFiat}</Text>}
      </div>
    </div>
  )

  const fromDisplay =
    fromKind === 'core' ? 'Dash Core (L1)'
    : fromKind === 'platformAddress' ? (selectedSource?.platformAddress ?? '')
    : fromKind === 'identity' ? (selectedIdentity?.identifier ?? '')
    : 'Your shielded balance'

  const toDisplay = toKind === 'newIdentity' ? 'New identity'
    : optionalShieldRecipient && trimmedTo.length === 0 ? 'Your shielded balance'
    : trimmedTo

  const confirmStep = (
    <div className={"flex flex-col gap-3"}>
      <div className={"dash-block rounded-[.875rem] p-4 flex flex-col gap-3"}>
        <div className={"flex flex-col gap-1"}>
          <Text size={12} weight={"medium"} color={"brand"} opacity={50}>From</Text>
          <div className={"flex items-center gap-1.5"}>
            {fromKind === 'shielded' && <ShieldSmallIcon size={14} className={"text-dash-brand dark:text-dash-mint"} />}
            <Text size={14} weight={"medium"} color={"brand"} className={"font-mono break-all"}>{fromDisplay}</Text>
          </div>
        </div>
        <div className={"flex flex-col gap-1"}>
          <Text size={12} weight={"medium"} color={"brand"} opacity={50}>To</Text>
          <div className={"flex items-center gap-1.5"}>
            {toKind === 'shielded' && <ShieldSmallIcon size={14} className={"text-dash-brand dark:text-dash-mint"} />}
            <Text size={14} weight={"medium"} color={"brand"} className={"font-mono break-all"}>{toDisplay}</Text>
          </div>
        </div>
      </div>
      <div className={"dash-block rounded-[.875rem] p-4 flex flex-col gap-2.5"}>
        <div className={"flex justify-between items-baseline gap-3"}>
          <Text size={12} weight={"medium"} color={"brand"} opacity={50}>Amount</Text>
          <Text size={14} weight={"medium"} color={"brand"}>
            {isDashUnit ? `${davToDash(amountDuffs)} Dash` : <CreditsAmount credits={amountCredits} align={"end"} />}
          </Text>
        </div>
        {!isDashUnit && (
          <>
            <div className={"flex justify-between items-baseline gap-3"}>
              <Text size={12} weight={"medium"} color={"brand"} opacity={50}>Network fee{operation === 'shieldedTransfer' || operation === 'unshield' || operation === 'shieldedWithdrawal' ? ' (est.)' : ''}</Text>
              <Text size={14} weight={"medium"} color={"brand"}><CreditsAmount credits={feeCredits} align={"end"} /></Text>
            </div>
            <div className={"h-px bg-dash-primary-dark-blue/8 dark:bg-white/10"} />
            <div className={"flex justify-between items-baseline gap-3"}>
              <Text size={12} weight={"medium"} color={"brand"} opacity={50}>Total</Text>
              <Text size={16} weight={"extrabold"} color={"brand"}><CreditsAmount credits={amountCredits + feeCredits} align={"end"} /></Text>
            </div>
          </>
        )}
        {isDashUnit && amountFiat && (
          <div className={"flex justify-between items-baseline gap-3"}>
            <Text size={12} weight={"medium"} color={"brand"} opacity={50}>≈ Fiat</Text>
            <Text size={12} weight={"medium"} color={"blue-mint"}>{amountFiat}</Text>
          </div>
        )}
      </div>
      {operation === 'coreSend' && syncIncomplete && <SyncGateNotice />}
    </div>
  )

  const startShieldedSpend = (password: string): Promise<ShieldedSpendState> => {
    if (!walletId) {
      return Promise.resolve<ShieldedSpendState>({ phase: 'error', fetched: 0, total: 0, stHash: null, identityId: null, error: 'No wallet selected' })
    }
    const noteIndex = shieldedSpecificNote?.index
    if (operation === 'shieldedTransfer') return API.startShieldedTransfer(walletId, trimmedTo, amountCredits.toString(), password, noteIndex)
    if (operation === 'unshield') return API.startShieldedUnshield(walletId, trimmedTo, amountCredits.toString(), password, noteIndex)
    if (operation === 'identityCreateFromPool') return API.startShieldedIdentityCreate(walletId, amountCredits.toString(), password)
    return API.startShieldedWithdrawal(walletId, trimmedTo, amountCredits.toString(), password, noteIndex)
  }

  const runPlatformOperation = (password: string) => {
    if (!walletId) return Promise.reject(new Error('No wallet selected'))
    const sourceAddress = selectedSource?.platformAddress ?? null
    if (operation === 'addressFundsTransfer') {
      return API.sendPlatformTransfer(walletId, sourceAddress ?? '', trimmedTo, amountCredits.toString(), password)
    }
    if (operation === 'identityTopUp') {
      return API.topUpIdentityFromAddresses(walletId, trimmedTo, sourceAddress, amountCredits.toString(), password)
    }
    if (operation === 'addressWithdrawal') {
      return API.withdrawPlatformCredits(walletId, sourceAddress, trimmedTo, amountCredits.toString(), password)
    }
    if (operation === 'identityToIdentity') {
      return API.transferIdentityCredits(walletId, selectedIdentity?.identifier ?? '', trimmedTo, amountCredits.toString(), password)
    }
    if (operation === 'identityWithdrawal') {
      return API.withdrawIdentityCredits(walletId, selectedIdentity?.identifier ?? '', trimmedTo, amountCredits.toString(), password)
    }
    if (operation === 'identityCreate') {
      return API.createIdentityFromAddresses(walletId, sourceAddress, amountCredits.toString(), password)
        .then(result => ({
          stHash: result.stHash,
          amountCredits: result.amountCredits,
          feeCredits: result.feeCredits,
          fromAddress: result.fromAddress,
          toAddress: result.identifier,
        }))
    }
    return API.sendIdentityCredits(walletId, selectedIdentity?.identifier ?? '', trimmedTo, amountCredits.toString(), password)
  }

  const isPlatformModalOperation = operation === 'addressFundsTransfer' || operation === 'identityTopUp'
    || operation === 'addressWithdrawal' || operation === 'identityWithdrawal'
    || operation === 'identityToAddress' || operation === 'identityToIdentity' || operation === 'identityCreate'
  const isShieldedSpendOperation = operation === 'shieldedTransfer' || operation === 'unshield' || operation === 'shieldedWithdrawal' || operation === 'identityCreateFromPool'

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
              {resumableFunding.kind === 'shielded' ? 'Unfinished L1 shielding'
                : resumableFunding.kind === 'identity' ? 'Unfinished identity registration'
                : resumableFunding.kind === 'identityTopUp' ? 'Unfinished identity top-up'
                : 'Unfinished Platform address funding'}
            </Text>
            <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"break-all leading-[130%]"}>
              {resumableFunding.amountDuffs ?? ''} duffs → {resumableFunding.kind === 'identity' ? 'new identity' : (resumableFunding.toPlatformAddress ?? '')}
            </Text>
          </div>
          <button
            type={"button"}
            onClick={() => setResumeOpen(true)}
            className={"shrink-0 px-4 py-2 rounded-[.75rem] dash-bg-inverse cursor-pointer hover:opacity-90 transition-opacity"}
          >
            <Text size={12} weight={"extrabold"} color={"blue-mint"}>Resume</Text>
          </button>
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

      {operation === 'coreSend' && (
        <SendConfirmModal
          isOpen={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          walletId={walletId}
          network={network}
          toAddress={trimmedTo}
          amountDuffs={amountDuffs}
          amountFiat={amountFiat}
          fromAddress={coreSpecificAddress?.address}
          onSuccess={() => {
            resetForm()
            if (walletId) {
              refreshBalance(walletId)
              refreshTransactions(walletId)
            }
          }}
        />
      )}

      {operation === 'shield' && (
        <ShieldConfirmModal
          isOpen={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          walletId={walletId}
          fromAddress={selectedSource?.platformAddress ?? ''}
          toAddress={trimmedTo}
          amountCredits={amountCredits.toString()}
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
          toLabel={operation === 'shieldedTransfer' ? 'To (shielded)' : operation === 'unshield' ? 'To (Platform)' : operation === 'identityCreateFromPool' ? 'Creates' : 'To (Core L1)'}
          toValue={operation === 'identityCreateFromPool' ? 'New Platform identity with 6 keys' : trimmedTo}
          amountCredits={amountCredits.toString()}
          proverReady={prover.ready}
          start={startShieldedSpend}
          onSuccess={resetForm}
        />
      )}

      {(operation === 'assetLockFunding' || operation === 'assetLockShield' || operation === 'identityRegister' || operation === 'identityTopUpL1') && (
        <AssetLockFundingModal
          isOpen={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          walletId={walletId}
          toPlatformAddress={operation === 'identityRegister' ? '' : trimmedTo}
          amountDuffs={amountDuffs.toString()}
          resume={false}
          kind={operation === 'assetLockShield' ? 'shielded' : operation === 'identityRegister' ? 'identity' : operation === 'identityTopUpL1' ? 'identityTopUp' : 'address'}
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
        kind={resumableFunding?.kind ?? 'address'}
        onSuccess={() => {
          setResumableFunding(null)
          resetForm()
        }}
      />

      {isPlatformModalOperation && (
        <TransferConfirmModal
          isOpen={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          title={info?.title ?? 'Confirm transfer'}
          successTitle={operation === 'identityCreate' ? 'Identity created' : 'Credits sent'}
          rows={[
            {label: 'Amount', value: <CreditsAmount credits={amountCredits} align={"end"} />},
            {label: 'Network fee', value: <CreditsAmount credits={feeCredits} align={"end"} />},
            {label: 'From', value: fromDisplay, mono: true},
            {label: 'To', value: toDisplay, mono: true},
          ]}
          run={runPlatformOperation}
          onSuccess={resetForm}
        />
      )}
    </div>
  )
}
