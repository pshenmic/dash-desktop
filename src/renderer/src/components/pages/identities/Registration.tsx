import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, ChainSmallIcon, InfoCircleIcon, KeyIcon, Text } from '@renderer/components/dash-ui-kit-enxtended'
import AssetLockFundingModal from '@renderer/components/modal/AssetLockFundingModal'
import ShieldedSpendModal from '@renderer/components/modal/ShieldedSpendModal'
import ShieldedUnlockModal from '@renderer/components/modal/ShieldedUnlockModal'
import TransferConfirmModal from '@renderer/components/modal/TransferConfirmModal'
import AmountField from '@renderer/components/pages/transfer/AmountField'
import AmountSlider from '@renderer/components/pages/transfer/AmountSlider'
import ProverPill from '@renderer/components/pages/shielded/ProverPill'
import { SourcePicker } from '@renderer/components/pages/transfer/EndpointPicker'
import TransferWizard from '@renderer/components/pages/transfer/TransferWizard'
import CreditsAmount from '@renderer/components/ui/CreditsAmount'
import P2pSyncAlert from '@renderer/components/ui/P2pSyncAlert'
import ShieldedNotesAlert from '@renderer/components/ui/ShieldedNotesAlert'
import Spinner from '@renderer/components/ui/Spinner'
import { API } from '@renderer/api'
import { AssetLockFundingState, PlatformSpendSource, ShieldedSpendState } from '@renderer/api/types'
import { IDENTITY_REGISTRATION_DEFAULT_AMOUNT } from '@renderer/constants'
import { useAuth } from '@renderer/contexts/AuthContext'
import { useConnectionModeContext } from '@renderer/contexts/ConnectionModeContext'
import { AssetLockFundingKind } from '@renderer/enums/AssetLockFundingKind'
import { AssetLockFundingPhase } from '@renderer/enums/AssetLockFundingPhase'
import { ShieldedSpendPhase } from '@renderer/enums/ShieldedSpendPhase'
import { ShieldedSyncPhase } from '@renderer/enums/ShieldedSyncPhase'
import { SourceKind } from '@renderer/enums/SourceKind'
import { TransferOperation } from '@renderer/enums/TransferOperation'
import { useFiat } from '@renderer/hooks/useFiat'
import { refreshIdentities } from '@renderer/hooks/useIdentities'
import { useOperationFee } from '@renderer/hooks/useOperationFee'
import { refreshPlatformAddresses, usePlatformAddresses } from '@renderer/hooks/usePlatformAddresses'
import { useShieldedStatus, useShieldedSyncState } from '@renderer/hooks/useShielded'
import { refreshBalance, useWalletBalance } from '@renderer/hooks/useWalletBalance'
import { refreshTransactions } from '@renderer/hooks/useWalletTransactions'
import { amountErrorFor } from '@renderer/utils/amountValidation'
import { creditsToDuffs, davToDash, dashToDuffs, duffsToCredits, formatCredits } from '@renderer/utils/balance'
import {
  identityRegistrationAmountError,
  identityRegistrationMaxDuffs,
  isUnfinishedAssetLockFunding,
} from '@renderer/utils/identityRegistration'
import {
  operationInfo,
  POOL_IDENTITY_DENOMINATIONS,
  SOURCE_KINDS,
} from '@renderer/utils/transferMatrix'

export default function IdentityRegistration(): React.JSX.Element {
  const navigate = useNavigate()
  const { status } = useAuth()
  const walletId = status?.selectedWalletId ?? null
  const { syncIncomplete } = useConnectionModeContext()
  const { balance, loading: balanceLoading, err: balanceError } = useWalletBalance(walletId ?? undefined)
  const { platformAddresses, loading: platformAddressesLoading, err: platformAddressesError } = usePlatformAddresses(walletId ?? undefined)
  const shieldedSync = useShieldedSyncState(walletId)
  const prover = useShieldedStatus()
  const { format: formatFiat, rateReady } = useFiat()

  const [fromKind, setFromKind] = useState(SourceKind.Core)
  const [fromAddress, setFromAddress] = useState('')
  const [amount, setAmount] = useState(IDENTITY_REGISTRATION_DEFAULT_AMOUNT)
  const [fundingState, setFundingState] = useState<AssetLockFundingState | null>(null)
  const [fundingLoading, setFundingLoading] = useState(true)
  const [fundingError, setFundingError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [notesUnlockOpen, setNotesUnlockOpen] = useState(false)
  const successful = useRef(false)

  const loadFundingState = useCallback(async (): Promise<void> => {
    if (!walletId) {
      setFundingState(null)
      setFundingLoading(false)
      return
    }

    setFundingLoading(true)
    setFundingError(null)
    try {
      setFundingState(await API.getAssetLockFundingState(walletId))
    } catch (e) {
      setFundingError(e instanceof Error ? e.message : 'Could not check the current funding state.')
    } finally {
      setFundingLoading(false)
    }
  }, [walletId])

  useEffect(() => {
    void loadFundingState()
  }, [loadFundingState])

  useEffect(() => {
    setFromKind(SourceKind.Core)
    setFromAddress('')
    setAmount(IDENTITY_REGISTRATION_DEFAULT_AMOUNT)
    setModalOpen(false)
    setNotesUnlockOpen(false)
    successful.current = false
  }, [walletId])

  const balanceDuffs = balance.dash.amount
  const amountDuffs = useMemo(() => dashToDuffs(amount), [amount])
  const amountCredits = duffsToCredits(amountDuffs)
  const operation = fromKind === SourceKind.Core
    ? TransferOperation.IdentityRegister
    : fromKind === SourceKind.PlatformAddress
      ? TransferOperation.IdentityCreate
      : TransferOperation.IdentityCreateFromShielded
  const info = operationInfo(operation)

  const fundedAddresses = useMemo(
    () => platformAddresses.filter(address => BigInt(address.balanceCredits) > 0n),
    [platformAddresses],
  )
  const defaultSource = useMemo(
    () => fundedAddresses.reduce<(typeof fundedAddresses)[number] | undefined>(
      (best, address) => best == null || BigInt(address.balanceCredits) > BigInt(best.balanceCredits) ? address : best,
      undefined,
    ),
    [fundedAddresses],
  )
  const selectedSource = fundedAddresses.find(address => address.platformAddress === fromAddress) ?? defaultSource
  const shieldedBalance = shieldedSync.phase === ShieldedSyncPhase.Done && shieldedSync.balance !== null
    ? BigInt(shieldedSync.balance)
    : null
  // Only the transitions platform addresses fund read this; an L1 registration
  // is funded by coins and names none.
  const platformSource: PlatformSpendSource | null =
    selectedSource != null && operation === TransferOperation.IdentityCreate
      ? { kind: 'address', address: selectedSource.platformAddress }
      : null

  const availableCredits = fromKind === SourceKind.PlatformAddress
    ? BigInt(selectedSource?.balanceCredits ?? 0n)
    : fromKind === SourceKind.Shielded
      ? shieldedBalance
      : null

  const { feeCredits, feeDuffs, maxDuffs: coreSelectableDuffs, maxPerTx, noteLimit, loading: feeLoading, err: feeError } = useOperationFee(walletId, operation, {
    destinationValid: true,
    recipient: '',
    amountCredits,
    amountDuffs: fromKind === SourceKind.Core ? amountDuffs : null,
    platformSource,
    identityId: null,
    shieldedSource: null,
  })

  // The Core fee is paid on top of the amount, and an L1 registration locks the
  // identity-create fee on top of that so the amount typed is what is credited.
  const totalFeeDuffs = feeDuffs === null ? 0n : feeDuffs + creditsToDuffs(feeCredits ?? 0n)
  const coreMaxDuffs = coreSelectableDuffs === null
    ? null
    : identityRegistrationMaxDuffs(coreSelectableDuffs, creditsToDuffs(feeCredits ?? 0n))
  const platformMaxDuffs = maxPerTx !== null
    ? creditsToDuffs(maxPerTx > 0n ? maxPerTx : 0n)
    : feeCredits !== null && availableCredits !== null
      ? creditsToDuffs(availableCredits > feeCredits ? availableCredits - feeCredits : 0n)
      : null
  const maxDuffs = fromKind === SourceKind.Core ? coreMaxDuffs : platformMaxDuffs
  const amountError = fromKind === SourceKind.Core
    ? identityRegistrationAmountError(amount, amountDuffs, coreMaxDuffs)
    : amountErrorFor({
        isCoreOperation: false,
        amount,
        coreMaxDuffs,
        operation,
        amountDuffs,
        amountCredits,
        minCredits: info.minCredits ?? 0n,
        availableCredits,
        feeCredits,
        maxPerTx,
        noteLimit,
      })
  const sourceReady = fromKind === SourceKind.Core
    ? !balanceLoading && !balanceError
    : fromKind === SourceKind.PlatformAddress
      ? !platformAddressesLoading && !platformAddressesError && selectedSource != null
      : shieldedBalance !== null
  const amountReady = sourceReady
    && amount.length > 0
    && amountError === null
    && (fromKind === SourceKind.Core || feeCredits !== null)
  const amountFiat = rateReady && amountDuffs > 0n ? formatFiat(amountDuffs) : null
  const totalDuffs = fromKind === SourceKind.Core
    ? amountDuffs + totalFeeDuffs
    : creditsToDuffs(amountCredits + (feeCredits ?? 0n))
  const unfinishedFunding = fundingState != null && isUnfinishedAssetLockFunding(fundingState.phase)
    ? fundingState
    : null

  const sliderPercent = useMemo(() => {
    if (maxDuffs === null || maxDuffs <= 0n || amountDuffs <= 0n) return 0
    if (amountDuffs >= maxDuffs) return 100
    return Number((amountDuffs * 100n) / maxDuffs)
  }, [amountDuffs, maxDuffs])

  const handleAmountChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const value = event.target.value
    if (value === '' || /^(?:\d+(?:\.\d{0,8})?|\.\d{0,8})$/.test(value)) setAmount(value)
  }

  const handlePercentChange = (percent: number): void => {
    if (maxDuffs === null) return
    setAmount(davToDash((maxDuffs * BigInt(percent)) / 100n))
  }

  const openNewRegistration = (): void => {
    successful.current = false
    setModalOpen(true)
  }

  const openExistingRegistration = (): void => {
    successful.current = false
    setModalOpen(true)
  }

  const handleCoreSuccess = useCallback((): void => {
    successful.current = true
    if (!walletId) return
    void Promise.all([
      refreshIdentities(walletId),
      refreshBalance(walletId),
      refreshTransactions(walletId),
    ])
  }, [walletId])

  const handlePlatformSuccess = useCallback((): void => {
    successful.current = true
    if (!walletId) return
    void Promise.all([
      refreshIdentities(walletId),
      refreshBalance(walletId),
      refreshPlatformAddresses(walletId),
    ])
  }, [walletId])

  const handleShieldedSuccess = useCallback((): void => {
    successful.current = true
    if (!walletId) return
    void Promise.all([
      refreshIdentities(walletId),
      refreshBalance(walletId),
    ])
  }, [walletId])

  const handleModalClose = (): void => {
    setModalOpen(false)
    if (successful.current) {
      navigate('/identities')
      return
    }
    void loadFundingState()
  }

  const runPlatformRegistration = (password: string) => {
    if (!walletId) return Promise.reject(new Error('No wallet selected'))
    return API.createIdentityFromAddresses(walletId, platformSource, amountCredits, password)
      .then(result => ({
        stHash: result.stHash,
        amountCredits: result.amountCredits,
        feeCredits: result.feeCredits,
        fromAddress: result.fromAddress,
        toAddress: result.identifier,
      }))
  }

  const startShieldedRegistration = (password: string): Promise<ShieldedSpendState> => {
    if (!walletId) {
      return Promise.resolve({
        phase: ShieldedSpendPhase.Error,
        fetched: 0,
        total: 0,
        stHash: null,
        identityId: null,
        error: 'No wallet selected',
      })
    }
    return API.startShieldedIdentityCreate(walletId, amountCredits, password)
  }

  const pageHeader = (
    <div className={"flex items-end justify-between gap-6 px-12 pt-2"}>
      <div className={"flex flex-col gap-3"}>
        <Text size={40} weight={"medium"} color={"brand"} className={"leading-[125%] tracking-[-0.03em]"}>Identity registration</Text>
        <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"leading-[120%] max-w-152.5"}>
          Register a wallet-owned Dash Platform identity using your Core, Platform or Shielded balance.
        </Text>
      </div>
    </div>
  )

  if (fundingLoading) {
    return (
      <div className={"relative flex flex-col h-full pb-4"}>
        {pageHeader}
        <div className={"flex min-h-80 items-center justify-center"}>
          <Spinner size={24} />
        </div>
      </div>
    )
  }

  if (!walletId) {
    return (
      <div className={"relative flex flex-col h-full pb-4"}>
        {pageHeader}
        <div className={"mx-12 mt-8 rounded-3xl dash-card-base p-8 text-center"}>
          <Text size={16} weight={"bold"} color={"brand"}>Select a wallet to register an identity.</Text>
        </div>
      </div>
    )
  }

  if (fundingError) {
    return (
      <div className={"relative flex flex-col h-full pb-4"}>
        {pageHeader}
        <div className={"mx-12 mt-8 flex flex-col items-center gap-4 rounded-3xl dash-card-base p-8 text-center"}>
          <Text size={16} weight={"bold"} color={"brand"}>Could not check funding progress</Text>
          <Text size={12} weight={"medium"} color={"red"} className={"break-all"}>{fundingError}</Text>
          <Button type={"button"} size={"sm"} onClick={() => { void loadFundingState() }}>Try again</Button>
        </div>
      </div>
    )
  }

  if (unfinishedFunding && unfinishedFunding.kind !== AssetLockFundingKind.Identity) {
    return (
      <div className={"relative flex flex-col h-full pb-4"}>
        {pageHeader}
        <div className={"mx-12 mt-8 flex flex-col gap-5 rounded-3xl dash-card-base p-8 shadow-[0_0_32px_0_rgba(12,28,51,0.08)]"}>
          <div className={"flex items-center gap-3"}>
            <span className={"flex size-10 items-center justify-center rounded-full bg-dash-orange/12 text-dash-orange"}>
              <InfoCircleIcon size={18} color={"currentColor"} />
            </span>
            <div className={"flex flex-col gap-1"}>
              <Text size={20} weight={"extrabold"} color={"brand"}>Another L1 funding is in progress</Text>
              <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"leading-[130%]"}>
                Finish or resume the current {unfinishedFunding.kind} funding before registering an identity.
              </Text>
            </div>
          </div>
          <div className={"flex gap-2"}>
            <Button type={"button"} variant={"outline"} colorScheme={"primary-light"} className={"flex-1"} onClick={() => navigate('/identities')}>Back to identities</Button>
            <Button type={"button"} className={"flex-1"} onClick={() => navigate('/send')}>Open Send</Button>
          </div>
        </div>
      </div>
    )
  }

  if (unfinishedFunding) {
    const isResumable = unfinishedFunding.phase === AssetLockFundingPhase.Resumable
    return (
      <div className={"relative flex flex-col h-full pb-4"}>
        {pageHeader}
        <div className={"mx-12 mt-8 flex flex-col gap-5 rounded-3xl dash-card-base p-8 shadow-[0_0_32px_0_rgba(12,28,51,0.08)]"}>
          <div className={"flex items-center gap-3"}>
            <span className={"flex size-10 items-center justify-center rounded-full dash-block-accent-12 dash-text-primary"}>
              <KeyIcon size={18} color={"currentColor"} />
            </span>
            <div className={"flex flex-col gap-1"}>
              <Text size={20} weight={"extrabold"} color={"brand"}>Identity registration is already in progress</Text>
              <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"leading-[130%]"}>
                {isResumable
                  ? 'The L1 asset lock is safe and ready to continue.'
                  : 'The wallet is processing the L1 asset lock and Platform registration.'}
              </Text>
            </div>
          </div>
          {unfinishedFunding.amountDuffs != null && (
            <div className={"flex items-center justify-between rounded-[.9375rem] dash-block-3 p-[.875rem]"}>
              <Text size={12} weight={"medium"} color={"brand"} opacity={50}>Amount locked</Text>
              <Text size={14} weight={"extrabold"} color={"brand"}>{davToDash(unfinishedFunding.amountDuffs)} Dash</Text>
            </div>
          )}
          <div className={"flex gap-2"}>
            <Button type={"button"} variant={"outline"} colorScheme={"primary-light"} className={"flex-1"} onClick={() => navigate('/identities')}>Back to identities</Button>
            <Button type={"button"} className={"flex-1"} onClick={openExistingRegistration}>
              {isResumable ? 'Resume registration' : 'View progress'}
            </Button>
          </div>
        </div>
        <AssetLockFundingModal
          isOpen={modalOpen}
          onClose={handleModalClose}
          walletId={walletId}
          toPlatformAddress={unfinishedFunding.toPlatformAddress ?? ''}
          amountDuffs={unfinishedFunding.amountDuffs?.toString() ?? ''}
          resume={true}
          kind={AssetLockFundingKind.Identity}
          onSuccess={handleCoreSuccess}
        />
      </div>
    )
  }

  const overviewStep = (
    <>
      <div className={"flex flex-col items-center text-center gap-3"}>
        <span className={"flex size-14 items-center justify-center rounded-full dash-block-accent-12 dash-text-primary"}>
          <KeyIcon size={24} color={"currentColor"} />
        </span>
        <div className={"flex flex-col items-center gap-2"}>
          <Text size={20} weight={"extrabold"} color={"brand"} className={"leading-[120%]"}>Create a Platform identity</Text>
          <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"leading-[130%]"}>
            Create your wallet-owned identity and choose whether its credits come from Core, a Platform address or your Shielded balance.
          </Text>
        </div>
      </div>
      <div className={"grid grid-cols-2 gap-3"}>
        <div className={"flex flex-col gap-[.375rem] rounded-[.9375rem] dash-block-3 p-[.875rem]"}>
          <div className={"flex items-center gap-2"}>
            <ChainSmallIcon size={18} color={"currentColor"} className={"dash-text-primary"} />
            <Text size={14} weight={"extrabold"} color={"brand"}>One secure flow</Text>
          </div>
          <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"leading-[130%]"}>
            The wallet selects the correct registration transaction for your chosen source and guides it through confirmation.
          </Text>
        </div>
        <div className={"flex flex-col gap-[.375rem] rounded-[.9375rem] dash-block-3 p-[.875rem]"}>
          <div className={"flex items-center gap-2"}>
            <KeyIcon size={18} color={"currentColor"} className={"dash-text-primary"} />
            <Text size={14} weight={"extrabold"} color={"brand"}>Keys stay local</Text>
          </div>
          <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"leading-[130%]"}>
            Identity keys are derived and stored by this wallet. Your seed never leaves the device.
          </Text>
        </div>
      </div>
      <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"leading-[140%]"}>
        Core registration starts at 0.1 Dash. Platform and Shielded sources use their network-defined fees and balance limits.
      </Text>
    </>
  )

  const amountStep = (
    <>
      <div className={"flex flex-col gap-1"}>
        <Text size={20} weight={"extrabold"} color={"brand"}>Choose identity funding</Text>
        <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"leading-[130%]"}>
          Select where the credits for your new identity should come from.
        </Text>
      </div>
      <SourcePicker
        kind={fromKind}
        onKindChange={(kind) => {
          setFromKind(kind)
          setAmount(kind === SourceKind.Shielded
            ? davToDash(creditsToDuffs(POOL_IDENTITY_DENOMINATIONS[0]))
            : IDENTITY_REGISTRATION_DEFAULT_AMOUNT)
        }}
        kinds={SOURCE_KINDS.filter(source => source.kind !== SourceKind.Identity)}
        label={"Funding source"}
        platformAddresses={fundedAddresses}
        selectedPlatformAddress={selectedSource}
        onPlatformAddressChange={setFromAddress}
        identities={[]}
        selectedIdentity={undefined}
        onIdentityChange={() => {}}
      />
      {fromKind === SourceKind.Shielded && (
        <div className={"flex flex-col gap-2"}>
          <div className={"flex flex-wrap gap-2"}>
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
          <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"leading-[130%]"}>
            Shielded identity registration only supports these fixed denominations.
          </Text>
        </div>
      )}
      <AmountField
        value={amount}
        onChange={handleAmountChange}
        onMax={() => {
          if (maxDuffs !== null) setAmount(davToDash(maxDuffs))
        }}
        unit={<Text size={14} weight={"extrabold"} color={"brand"}>Dash</Text>}
        disabled={fromKind === SourceKind.Shielded}
      />
      {fromKind !== SourceKind.Shielded && maxDuffs !== null && (
        <AmountSlider percent={sliderPercent} onPercentChange={handlePercentChange} disabled={maxDuffs === 0n} />
      )}
      <div className={"flex flex-col gap-2 rounded-[.9375rem] dash-block-3 p-[.875rem]"}>
        <div className={"flex items-center justify-between gap-4"}>
          <Text size={12} weight={"medium"} color={"brand"} opacity={50}>
            {fromKind === SourceKind.Core ? 'Core balance' : fromKind === SourceKind.PlatformAddress ? 'Address balance' : 'Shielded balance'}
          </Text>
          {fromKind === SourceKind.Core ? (
            <Text size={14} weight={"extrabold"} color={"brand"}>{davToDash(balanceDuffs)} Dash</Text>
          ) : availableCredits !== null ? (
            <Text size={14} weight={"extrabold"} color={"brand"}>{davToDash(creditsToDuffs(availableCredits))} Dash</Text>
          ) : (
            <Text size={12} weight={"medium"} color={"brand"} opacity={50}>Sync notes to load</Text>
          )}
        </div>
        <div className={"flex items-center justify-between gap-4"}>
          <Text size={12} weight={"medium"} color={"brand"} opacity={50}>
            {fromKind === SourceKind.Core ? 'Reserved for fees' : 'Reserved for Platform fee'}
          </Text>
          {fromKind === SourceKind.Core ? (
            <Text size={12} weight={"medium"} color={"brand"}>{davToDash(totalFeeDuffs)} Dash</Text>
          ) : feeError === null && feeCredits !== null ? (
            <Text size={12} weight={"medium"} color={"brand"}>{davToDash(creditsToDuffs(feeCredits))} Dash</Text>
          ) : feeError === null && feeLoading ? (
            <Spinner size={14} className={"text-dash-brand dark:text-dash-mint"} />
          ) : (
            <Text size={12} weight={"medium"} color={"brand"} opacity={50}>—</Text>
          )}
        </div>
        {amountFiat && (
          <div className={"flex items-center justify-between gap-4"}>
            <Text size={12} weight={"medium"} color={"brand"} opacity={50}>Funding value</Text>
            <Text size={12} weight={"medium"} color={"blue-mint"}>~ {amountFiat}</Text>
          </div>
        )}
      </div>
      {amountError && <Text size={12} weight={"medium"} color={"red"} className={"px-1"}>{amountError}</Text>}
      {fromKind === SourceKind.Core && balanceError && <Text size={12} weight={"medium"} color={"red"} className={"px-1"}>{balanceError}</Text>}
      {fromKind === SourceKind.PlatformAddress && platformAddressesError && <Text size={12} weight={"medium"} color={"red"} className={"px-1"}>{platformAddressesError}</Text>}
      {feeError && <Text size={12} weight={"medium"} color={"red"} className={"px-1"}>{feeError}</Text>}
      {fromKind === SourceKind.Core && syncIncomplete && <P2pSyncAlert />}
      {fromKind === SourceKind.Shielded && (
        <>
          <ProverPill status={prover} />
          <ShieldedNotesAlert
            walletId={walletId}
            onSync={() => setNotesUnlockOpen(true)}
            syncing={shieldedSync.phase === ShieldedSyncPhase.Syncing || shieldedSync.phase === ShieldedSyncPhase.Recovering}
          />
        </>
      )}
    </>
  )

  const reviewStep = (
    <>
      <div className={"flex flex-col gap-1"}>
        <Text size={20} weight={"extrabold"} color={"brand"}>Review registration</Text>
        <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"leading-[130%]"}>
          Confirm the selected source and amount, then unlock the wallet to register the identity.
        </Text>
      </div>
      <div className={"flex flex-col gap-3 rounded-[.9375rem] dash-block-3 p-[.875rem]"}>
        <div className={"flex items-center justify-between gap-4"}>
          <Text size={12} weight={"medium"} color={"brand"} opacity={50}>From</Text>
          <Text size={12} weight={"medium"} color={"brand"} className={fromKind === SourceKind.PlatformAddress ? 'font-mono break-all text-right' : ''}>
            {fromKind === SourceKind.Core
              ? 'Dash Core (L1)'
              : fromKind === SourceKind.PlatformAddress
                ? selectedSource?.platformAddress
                : 'Your shielded balance'}
          </Text>
        </div>
        <div className={"flex items-center justify-between gap-4"}>
          <Text size={12} weight={"medium"} color={"brand"} opacity={50}>
            {fromKind === SourceKind.Core ? 'Amount to lock' : fromKind === SourceKind.Shielded ? 'Identity denomination' : 'Identity funding'}
          </Text>
          {fromKind === SourceKind.Core ? (
            <Text size={14} weight={"extrabold"} color={"brand"}>{davToDash(amountDuffs)} Dash</Text>
          ) : (
            <Text size={14} weight={"medium"} color={"brand"}>{formatCredits(amountCredits)} credits</Text>
          )}
        </div>
        {fromKind === SourceKind.Core && (
          <div className={"flex items-center justify-between gap-4"}>
            <Text size={12} weight={"medium"} color={"brand"} opacity={50}>Identity is credited</Text>
            <Text size={14} weight={"medium"} color={"brand"}>{formatCredits(amountCredits)} credits</Text>
          </div>
        )}
        <div className={"flex items-center justify-between gap-4"}>
          <Text size={12} weight={"medium"} color={"brand"} opacity={50}>
            {fromKind === SourceKind.Core ? 'Network fees' : 'Reserved for Platform fee'}
          </Text>
          {fromKind === SourceKind.Core ? (
            <Text size={12} weight={"medium"} color={"brand"}>{davToDash(totalFeeDuffs)} Dash</Text>
          ) : feeCredits !== null ? (
            <Text size={12} weight={"medium"} color={"brand"}>{formatCredits(feeCredits)} credits</Text>
          ) : (
            <Text size={12} weight={"medium"} color={"brand"} opacity={50}>—</Text>
          )}
        </div>
        <div className={"h-px bg-dash-primary-dark-blue/8 dark:bg-white/8"} />
        <div className={"flex items-center justify-between gap-4"}>
          <Text size={12} weight={"medium"} color={"brand"} opacity={50}>Total from source</Text>
          {fromKind === SourceKind.Core ? (
            <Text size={16} weight={"extrabold"} color={"brand"}>{davToDash(totalDuffs)} Dash</Text>
          ) : (
            <Text size={16} weight={"extrabold"} color={"brand"}>{formatCredits(amountCredits + (feeCredits ?? 0n))} credits</Text>
          )}
        </div>
        <div className={"flex items-center justify-between gap-4"}>
          <Text size={12} weight={"medium"} color={"brand"} opacity={50}>Creates</Text>
          <Text size={12} weight={"medium"} color={"brand"} className={"text-right"}>
            New Platform identity with {fromKind === SourceKind.PlatformAddress ? 4 : 6} keys
          </Text>
        </div>
      </div>
      {fromKind === SourceKind.Core && syncIncomplete && <P2pSyncAlert />}
    </>
  )

  return (
    <div className={"relative flex flex-col h-full pb-4"}>
      {pageHeader}
      <TransferWizard
        key={walletId}
        steps={[
          { label: 'Overview', content: overviewStep },
          { label: 'Funding', content: amountStep, canAdvance: amountReady },
          { label: 'Review', content: reviewStep },
        ]}
        onSubmit={openNewRegistration}
        submitLabel={"Register identity"}
        submitDisabled={!amountReady || (fromKind === SourceKind.Core && syncIncomplete) || (fromKind === SourceKind.Shielded && !prover.ready)}
      />
      {fromKind === SourceKind.Core && (
        <AssetLockFundingModal
          isOpen={modalOpen}
          onClose={handleModalClose}
          walletId={walletId}
          toPlatformAddress={''}
          amountDuffs={amountDuffs.toString()}
          resume={false}
          kind={AssetLockFundingKind.Identity}
          onSuccess={handleCoreSuccess}
        />
      )}
      {fromKind === SourceKind.PlatformAddress && (
        <TransferConfirmModal
          isOpen={modalOpen}
          onClose={handleModalClose}
          title={"Register identity"}
          successTitle={"Identity registered"}
          rows={[
            { label: 'From', value: selectedSource?.platformAddress ?? '', mono: true },
            { label: 'Identity funding', value: <CreditsAmount credits={amountCredits} showFiat={false} align={"end"} /> },
            ...(feeCredits !== null ? [{ label: 'Reserved for fee', value: <CreditsAmount credits={feeCredits} showFiat={false} align={"end"} /> }] : []),
            { label: 'Creates', value: 'New Platform identity with 4 keys' },
          ]}
          run={runPlatformRegistration}
          onSuccess={handlePlatformSuccess}
        />
      )}
      {fromKind === SourceKind.Shielded && (
        <ShieldedSpendModal
          isOpen={modalOpen}
          onClose={handleModalClose}
          walletId={walletId}
          title={"Register identity from Shield"}
          toLabel={"Creates"}
          toValue={"New Platform identity with 6 keys"}
          amountCredits={amountCredits.toString()}
          feeCredits={feeCredits}
          proverReady={prover.ready}
          start={startShieldedRegistration}
          onSuccess={handleShieldedSuccess}
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
