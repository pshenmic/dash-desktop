import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { DashLogo, BigNumber } from "dash-ui-kit/react";
import { Text, CreditsIcon, ShieldSmallIcon } from "@renderer/components/dash-ui-kit-enxtended";
import SyncGateNotice from "@renderer/components/ui/SyncGateNotice";
import WarmupPill from "@renderer/components/pages/shielded/WarmupPill";
import { useAuth } from "@renderer/contexts/AuthContext";
import { useConnectionModeContext } from "@renderer/contexts/ConnectionModeContext";
import { useFiat } from "@renderer/hooks/useFiat";
import { useWalletBalance, refreshBalance } from "@renderer/hooks/useWalletBalance";
import { refreshTransactions } from "@renderer/hooks/useWalletTransactions";
import { usePlatformAddresses, prefetchPlatformAddresses } from "@renderer/hooks/usePlatformAddresses";
import { useIdentities, prefetchIdentities } from "@renderer/hooks/useIdentities";
import { useShieldedStatus, useShieldedSyncState } from "@renderer/hooks/useShielded";
import { davToDash, dashToDuffs } from "@renderer/utils/balance";
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
} from "@renderer/utils/transferMatrix";
import { API } from "@renderer/api";
import { AssetLockFundingState, PlatformAddressDto, ShieldedSpendState } from "@renderer/api/types";
import { sendPageData } from "@renderer/constants";
import AmountField from "./AmountField";
import TransferWizard from "./TransferWizard";
import RecipientInput from "./RecipientInput";
import { SourcePicker, DestinationPicker } from "./EndpointPicker";
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
  const { platformAddresses } = usePlatformAddresses(walletId ?? undefined)
  const { identities } = useIdentities(walletId ?? undefined)
  const shieldedSync = useShieldedSyncState(walletId)
  const warmup = useShieldedStatus()

  const operation = resolveOperation(fromKind, toKind)
  const reason = unsupportedReason(fromKind, toKind)
  const info = operation ? operationInfo(operation) : null
  const shieldedInvolved = fromKind === 'shielded' || toKind === 'shielded'

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

  const balanceDuffs = balance.dash.amount
  const shieldedBalance = shieldedSync.phase === 'done' && shieldedSync.balance !== null ? BigInt(shieldedSync.balance) : null

  const availableCredits: bigint | null =
    fromKind === 'platformAddress' ? (selectedSource ? BigInt(selectedSource.balanceCredits) : 0n)
    : fromKind === 'identity' ? (selectedIdentity ? BigInt(String(selectedIdentity.balance.amount)) : 0n)
    : fromKind === 'shielded' ? shieldedBalance
    : null

  const isDashUnit = info?.unit === 'dash'
  const amountDuffs = useMemo(() => (isDashUnit ? dashToDuffs(amount) : 0n), [isDashUnit, amount])
  const amountCredits = !isDashUnit && amount.length > 0 ? BigInt(amount) : 0n
  const feeCredits = info?.feeCredits ?? 0n
  const minCredits = info?.minCredits ?? 0n

  const shieldedMaxPerTx = useMemo(() => {
    if (fromKind !== 'shielded' || shieldedSync.phase !== 'done') return null
    const top = shieldedSync.notes
      .filter((note) => !note.spent)
      .map((note) => BigInt(note.amount))
      .sort((a, b) => (a < b ? 1 : a > b ? -1 : 0))
      .slice(0, MAX_SPEND_NOTES)
    const total = top.reduce((sum, value) => sum + value, 0n)
    return total > feeCredits ? total - feeCredits : 0n
  }, [fromKind, shieldedSync.phase, shieldedSync.notes, feeCredits])

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
    : isLikelyShieldedAddress(trimmedTo)

  const selfSend = operation === 'addressFundsTransfer' && destinationValid && selectedSource != null && trimmedTo === selectedSource.platformAddress

  const destinationError = toKind === 'newIdentity' || trimmedTo.length === 0
    ? null
    : !destinationValid
      ? (toKind === 'coreAddress' ? `Enter a valid Dash ${network ?? ''} address.`
        : toKind === 'platformAddress' ? `Enter a valid Platform ${network ?? ''} address.`
        : toKind === 'identity' ? 'Enter a valid identity identifier.'
        : 'Enter a valid shielded address.')
      : selfSend
        ? 'Recipient must be different from the source address.'
        : null

  const needsAck = operation === 'shieldedWithdrawal'
  const destinationReady = destinationValid && !selfSend && (!needsAck || acked)
  const routeReady = operation != null && sourceReady && destinationReady

  const amountReady = isDashUnit
    ? amountDuffs > 0n && amountDuffs <= balanceDuffs
    : amountCredits >= minCredits && amountCredits > 0n
      && (availableCredits === null || amountCredits + feeCredits <= availableCredits)
      && (shieldedMaxPerTx === null || amountCredits <= shieldedMaxPerTx)

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

      {toKind === 'coreAddress' && operation === 'coreSend' ? (
        <div className={"flex flex-col gap-2"}>
          <DestinationPicker
            kind={toKind}
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
          onKindChange={k => { setToKind(k); setToValue(''); setAcked(false) }}
          value={toValue}
          onValueChange={setToValue}
          placeholder={destinationPlaceholder}
          error={destinationError}
          showValueInput={operation != null}
        />
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

      {operation === 'addressWithdrawal' && (
        <div className={"flex flex-col gap-[.375rem] p-[.875rem] rounded-[.9375rem] dash-block-3"}>
          <Text size={14} weight={"extrabold"} color={"brand"}>Cross-chain withdrawal</Text>
          <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"leading-[130%]"}>
            Withdrawing to Core costs a 400,000,000 credit network fee and the Dash payout arrives asynchronously after the withdrawal is processed.
          </Text>
        </div>
      )}

      {operation === 'shieldedWithdrawal' && (
        <div className={"flex flex-col gap-[.375rem] p-[.875rem] rounded-[.9375rem] dash-block-3"}>
          <Text size={14} weight={"extrabold"} color={"brand"}>Output becomes public</Text>
          <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"leading-[130%]"}>
            The receiving Core address and the amount will be publicly visible on-chain once withdrawn. This breaks the privacy of the withdrawn funds.
          </Text>
          <label className={"mt-1 flex items-center gap-2 cursor-pointer"}>
            <input type={"checkbox"} checked={acked} onChange={(e) => setAcked(e.target.checked)} className={"accent-dash-brand"} />
            <Text size={12} weight={"medium"} color={"brand"}>I understand the destination and amount will be public.</Text>
          </label>
        </div>
      )}
    </>
  )

  const amountStep = (
    <div>
      <AmountField
        value={amount}
        onChange={handleAmount}
        onMax={handleMax}
        unit={isDashUnit ? <DashLogo size={20} /> : <CreditsIcon size={20} />}
      />
      <div className={"mt-2 px-1 flex items-center justify-between gap-3"}>
        {isDashUnit ? (
          <Text size={12} weight={"medium"} color={amountDuffs > 0n && amountDuffs > balanceDuffs ? "red" : "brand"} opacity={amountDuffs > 0n && amountDuffs > balanceDuffs ? 100 : 50}>
            {amountDuffs > 0n && amountDuffs > balanceDuffs ? 'Amount exceeds balance' : `Balance: ${davToDash(balanceDuffs)} Dash`}
          </Text>
        ) : availableCredits !== null ? (
          <Text size={12} weight={"medium"} color={"brand"} opacity={50}>
            Available: <BigNumber>{availableCredits.toString()}</BigNumber> credits
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
    fromKind === 'core' ? 'Dash wallet (L1)'
    : fromKind === 'platformAddress' ? (selectedSource?.platformAddress ?? '')
    : fromKind === 'identity' ? (selectedIdentity?.identifier ?? '')
    : 'Your shielded balance'

  const toDisplay = toKind === 'newIdentity' ? 'New identity' : trimmedTo

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
            {isDashUnit ? `${davToDash(amountDuffs)} Dash` : <><BigNumber>{amountCredits.toString()}</BigNumber> credits</>}
          </Text>
        </div>
        {!isDashUnit && (
          <>
            <div className={"flex justify-between items-baseline gap-3"}>
              <Text size={12} weight={"medium"} color={"brand"} opacity={50}>Network fee{operation === 'shieldedTransfer' || operation === 'unshield' || operation === 'shieldedWithdrawal' ? ' (est.)' : ''}</Text>
              <Text size={14} weight={"medium"} color={"brand"}><BigNumber>{feeCredits.toString()}</BigNumber> credits</Text>
            </div>
            <div className={"h-px bg-dash-primary-dark-blue/8 dark:bg-white/10"} />
            <div className={"flex justify-between items-baseline gap-3"}>
              <Text size={12} weight={"medium"} color={"brand"} opacity={50}>Total</Text>
              <Text size={16} weight={"extrabold"} color={"brand"}><BigNumber>{(amountCredits + feeCredits).toString()}</BigNumber> credits</Text>
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
      return Promise.resolve<ShieldedSpendState>({ phase: 'error', fetched: 0, total: 0, stHash: null, error: 'No wallet selected' })
    }
    if (operation === 'shieldedTransfer') return API.startShieldedTransfer(walletId, trimmedTo, amountCredits.toString(), password)
    if (operation === 'unshield') return API.startShieldedUnshield(walletId, trimmedTo, amountCredits.toString(), password)
    return API.startShieldedWithdrawal(walletId, trimmedTo, amountCredits.toString(), password)
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
    || operation === 'addressWithdrawal' || operation === 'identityToAddress' || operation === 'identityCreate'
  const isShieldedSpendOperation = operation === 'shieldedTransfer' || operation === 'unshield' || operation === 'shieldedWithdrawal'

  return (
    <div className={"relative flex flex-col h-full pb-4"}>
      <div className={"flex items-end justify-between gap-6 px-12 pt-2"}>
        <div className={"flex flex-col gap-3"}>
          <Text size={40} weight={"medium"} color={"brand"} className={"leading-[125%] tracking-[-0.03em]"}>Send</Text>
          <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"leading-[120%] max-w-152.5"}>
            Move funds between your Dash wallet, Platform addresses, identities and the shielded pool. Pick where the funds come from and where they go.
          </Text>
        </div>
        {shieldedInvolved && <WarmupPill status={warmup} />}
      </div>

      {resumableFunding && (
        <div className={"mx-12 mt-4 flex items-center justify-between gap-4 p-[.875rem] rounded-[.9375rem] dash-block-3"}>
          <div className={"flex flex-col gap-1 min-w-0"}>
            <Text size={14} weight={"extrabold"} color={"brand"}>Unfinished Platform address funding</Text>
            <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"break-all leading-[130%]"}>
              {resumableFunding.amountDuffs ?? ''} duffs → {resumableFunding.toPlatformAddress ?? ''}
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
          amountCredits={amountCredits.toString()}
          warmupReady={warmup.ready}
          onSuccess={resetForm}
        />
      )}

      {isShieldedSpendOperation && (
        <ShieldedSpendModal
          isOpen={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          walletId={walletId}
          title={info?.title ?? 'Send'}
          toLabel={operation === 'shieldedTransfer' ? 'To (shielded)' : operation === 'unshield' ? 'To (Platform)' : 'To (Core L1)'}
          toValue={trimmedTo}
          amountCredits={amountCredits.toString()}
          warmupReady={warmup.ready}
          start={startShieldedSpend}
          onSuccess={resetForm}
        />
      )}

      {operation === 'assetLockFunding' && (
        <AssetLockFundingModal
          isOpen={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          walletId={walletId}
          toPlatformAddress={trimmedTo}
          amountDuffs={amountDuffs.toString()}
          resume={false}
          onSuccess={resetForm}
        />
      )}

      <AssetLockFundingModal
        isOpen={resumeOpen}
        onClose={() => setResumeOpen(false)}
        walletId={walletId}
        toPlatformAddress={resumableFunding?.toPlatformAddress ?? ''}
        amountDuffs={''}
        resume={true}
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
            {label: 'Amount', value: `${amountCredits.toString()} credits`},
            {label: 'Network fee', value: `${feeCredits.toString()} credits`},
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
