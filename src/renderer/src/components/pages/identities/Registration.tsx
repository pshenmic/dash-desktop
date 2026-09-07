import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, ChainSmallIcon, InfoCircleIcon, KeyIcon, SettingsIcon, Text } from '@renderer/components/dash-ui-kit-enxtended'
import AssetLockFundingModal from '@renderer/components/modal/AssetLockFundingModal'
import ShieldedSpendModal from '@renderer/components/modal/ShieldedSpendModal'
import ShieldedUnlockModal from '@renderer/components/modal/ShieldedUnlockModal'
import TransferConfirmModal from '@renderer/components/modal/TransferConfirmModal'
import AmountField from '@renderer/components/pages/transfer/AmountField'
import AmountSlider from '@renderer/components/pages/transfer/AmountSlider'
import CoinControlModal from '@renderer/components/pages/transfer/CoinControlModal'
import ProverPill from '@renderer/components/pages/shielded/ProverPill'
import { SourcePicker } from '@renderer/components/pages/transfer/EndpointPicker'
import TransferWizard from '@renderer/components/pages/transfer/TransferWizard'
import CreditsAmount from '@renderer/components/ui/CreditsAmount'
import P2pSyncAlert from '@renderer/components/ui/P2pSyncAlert'
import ShieldedNotesAlert from '@renderer/components/ui/ShieldedNotesAlert'
import Spinner from '@renderer/components/ui/Spinner'
import { API } from '@renderer/api'
import type { AssetLockFundingState, SelectableUtxo, ShieldedSpendState } from '@renderer/api/types'
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
import { useAdresses } from '@renderer/hooks/useAdresses'
import { refreshIdentities } from '@renderer/hooks/useIdentities'
import { useOperationFee } from '@renderer/hooks/useOperationFee'
import { refreshPlatformAddresses, usePlatformAddresses } from '@renderer/hooks/usePlatformAddresses'
import { useShieldedStatus, useShieldedSyncState } from '@renderer/hooks/useShielded'
import { refreshBalance, useWalletBalance } from '@renderer/hooks/useWalletBalance'
import { refreshTransactions } from '@renderer/hooks/useWalletTransactions'
import { amountErrorFor } from '@renderer/utils/amountValidation'
import { creditsToDuffs, davToDash, davToDashCompact, dashToDuffs, duffsToCredits, formatCredits } from '@renderer/utils/balance'
import {
  automaticCoinControl,
  normalizeCoinControlSelection,
  outpointKey,
  toCoreSpendSource,
  toPlatformSpendSource,
} from '@renderer/utils/coinControl'
import { getErrorMessage } from '@renderer/utils/error'
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
import type { CoinControlSelection } from '@renderer/types/CoinControl'

export default function IdentityRegistration(): React.JSX.Element {
  const navigate = useNavigate()
  const { status } = useAuth()
  const walletId = status?.selectedWalletId ?? null
  const { syncIncomplete } = useConnectionModeContext()
  const { balance, loading: balanceLoading, err: balanceError } = useWalletBalance(walletId ?? undefined)
  const { receiving, change, err: coreAddressesError } = useAdresses(walletId ?? undefined)
  const { platformAddresses, loading: platformAddressesLoading, err: platformAddressesError } = usePlatformAddresses(walletId ?? undefined)
  const shieldedSync = useShieldedSyncState(walletId)
  const prover = useShieldedStatus()
  const { format: formatFiat, rateReady } = useFiat()

  const [fromKind, setFromKind] = useState(SourceKind.Core)
  const [amount, setAmount] = useState(IDENTITY_REGISTRATION_DEFAULT_AMOUNT)
  const [utxos, setUtxos] = useState<SelectableUtxo[]>([])
  const [utxosLoading, setUtxosLoading] = useState(false)
  const [utxosError, setUtxosError] = useState<string | null>(null)
  const [utxosReload, setUtxosReload] = useState(0)
  const [coinControl, setCoinControl] = useState<CoinControlSelection>(automaticCoinControl)
  const [coinControlOpen, setCoinControlOpen] = useState(false)
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
    setAmount(IDENTITY_REGISTRATION_DEFAULT_AMOUNT)
    setCoinControl(automaticCoinControl())
    setCoinControlOpen(false)
    setModalOpen(false)
    setNotesUnlockOpen(false)
    successful.current = false
  }, [walletId])

  useEffect(() => {
    if (!walletId || syncIncomplete) {
      setUtxos([])
      setUtxosLoading(false)
      setUtxosError(null)
      return
    }

    let cancelled = false
    setUtxos([])
    setUtxosLoading(true)
    setUtxosError(null)
    API.getUtxos(walletId)
      .then(loaded => {
        if (!cancelled) setUtxos(loaded)
      })
      .catch(error => {
        if (cancelled) return
        setUtxosError(`Could not load spendable UTXOs. ${getErrorMessage(error)}`)
      })
      .finally(() => {
        if (!cancelled) setUtxosLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [walletId, syncIncomplete, utxosReload])

  const balanceDuffs = balance.dash.amount
  const amountDuffs = useMemo(() => dashToDuffs(amount), [amount])
  const amountCredits = duffsToCredits(amountDuffs)
  let operation = TransferOperation.IdentityRegister
  switch (fromKind) {
    case SourceKind.PlatformAddress:
      operation = TransferOperation.IdentityCreate
      break
    case SourceKind.Shielded:
      operation = TransferOperation.IdentityCreateFromShielded
      break
  }
  const info = operationInfo(operation)

  const coreAddresses = useMemo(
    () => [...receiving, ...change]
      .filter(address => address.balance > 0n)
      .sort((a, b) => {
        if (a.balance < b.balance) return 1
        if (a.balance > b.balance) return -1
        return 0
      }),
    [receiving, change],
  )
  const fundedAddresses = useMemo(
    () => platformAddresses.filter(address => BigInt(address.balanceCredits) > 0n),
    [platformAddresses],
  )
  const shieldedBalance = shieldedSync.phase === ShieldedSyncPhase.Done && shieldedSync.balance !== null
    ? BigInt(shieldedSync.balance)
    : null
  const coinControlInventory = useMemo(() => ({
    coreAddresses: coreAddresses.map(address => address.address),
    coreOutpoints: utxos.map(outpointKey),
    platformBalances: Object.fromEntries(
      fundedAddresses.map(address => [address.platformAddress, address.balanceCredits]),
    ),
    shieldedAddresses: [],
    shieldedNoteIndexes: [],
  }), [coreAddresses, utxos, fundedAddresses])
  const appliedCoinControl = useMemo(
    () => normalizeCoinControlSelection(coinControl, operation, coinControlInventory),
    [coinControl, operation, coinControlInventory],
  )

  useEffect(() => {
    setCoinControl(automaticCoinControl())
    setCoinControlOpen(false)
  }, [fromKind])

  useEffect(() => {
    if (appliedCoinControl !== coinControl) setCoinControl(appliedCoinControl)
  }, [appliedCoinControl, coinControl])

  const coreSpendSource = useMemo(
    () => toCoreSpendSource(appliedCoinControl, utxos),
    [appliedCoinControl, utxos],
  )
  const platformSource = useMemo(
    () => toPlatformSpendSource(appliedCoinControl),
    [appliedCoinControl],
  )

  let selectedCoreDuffs = balanceDuffs
  if (appliedCoinControl.kind === 'coreAddress') {
    selectedCoreDuffs = coreAddresses.find(address => address.address === appliedCoinControl.address)?.balance ?? 0n
  } else if (appliedCoinControl.kind === 'coreOutpoints') {
    const selectedOutpoints = new Set(appliedCoinControl.outpoints)
    selectedCoreDuffs = utxos
      .filter(utxo => selectedOutpoints.has(outpointKey(utxo)))
      .reduce((sum, utxo) => sum + utxo.satoshis, 0n)
  }

  let availableCredits: bigint | null = null
  if (fromKind === SourceKind.PlatformAddress) {
    if (appliedCoinControl.kind === 'platformAddress') {
      availableCredits = fundedAddresses.find(
        address => address.platformAddress === appliedCoinControl.address,
      )?.balanceCredits ?? 0n
    } else if (appliedCoinControl.kind === 'platformInputs') {
      availableCredits = appliedCoinControl.inputs.reduce((sum, input) => sum + input.credits, 0n)
    } else {
      availableCredits = fundedAddresses.reduce((sum, address) => sum + address.balanceCredits, 0n)
    }
  } else if (fromKind === SourceKind.Shielded) {
    availableCredits = shieldedBalance
  }

  const { feeCredits, feeDuffs, maxDuffs: coreSelectableDuffs, maxPerTx, noteLimit, loading: feeLoading, err: feeError } = useOperationFee(walletId, operation, {
    destinationValid: true,
    recipient: '',
    amountCredits,
    amountDuffs: fromKind === SourceKind.Core ? amountDuffs : null,
    coreSource: coreSpendSource ?? null,
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
  let platformMaxDuffs: bigint | null = null
  if (maxPerTx !== null) {
    const cappedCredits = maxPerTx > 0n ? maxPerTx : 0n
    platformMaxDuffs = creditsToDuffs(cappedCredits)
  } else if (feeCredits !== null && availableCredits !== null) {
    const spendableCredits = availableCredits > feeCredits ? availableCredits - feeCredits : 0n
    platformMaxDuffs = creditsToDuffs(spendableCredits)
  }

  let maxDuffs = platformMaxDuffs
  if (fromKind === SourceKind.Core) maxDuffs = coreMaxDuffs

  let amountError = amountErrorFor({
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
  if (fromKind === SourceKind.Core) {
    amountError = identityRegistrationAmountError(amount, amountDuffs, coreMaxDuffs)
  }
  let sourceReady = shieldedBalance !== null
  if (fromKind === SourceKind.Core) {
    sourceReady = !balanceLoading && !balanceError
  } else if (fromKind === SourceKind.PlatformAddress) {
    sourceReady = !platformAddressesLoading && !platformAddressesError && fundedAddresses.length > 0
  }
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

  let coinControlSummary = 'Automatic'
  switch (appliedCoinControl.kind) {
    case 'coreAddress': {
      const addressDuffs = coreAddresses.find(address => address.address === appliedCoinControl.address)?.balance ?? 0n
      coinControlSummary = `One Core address · ${davToDashCompact(addressDuffs)} Dash`
      break
    }
    case 'coreOutpoints': {
      const selectedOutpoints = new Set(appliedCoinControl.outpoints)
      const selectedDuffs = utxos
        .filter(utxo => selectedOutpoints.has(outpointKey(utxo)))
        .reduce((sum, utxo) => sum + utxo.satoshis, 0n)
      const label = appliedCoinControl.outpoints.length === 1 ? 'UTXO' : 'UTXOs'
      coinControlSummary = `${appliedCoinControl.outpoints.length} ${label} · ${davToDashCompact(selectedDuffs)} Dash`
      break
    }
    case 'platformAddress': {
      const addressCredits = fundedAddresses.find(
        address => address.platformAddress === appliedCoinControl.address,
      )?.balanceCredits ?? 0n
      coinControlSummary = `One Platform address · ${davToDashCompact(creditsToDuffs(addressCredits))} Dash`
      break
    }
    case 'platformInputs': {
      const inputCredits = appliedCoinControl.inputs.reduce((sum, input) => sum + input.credits, 0n)
      const label = appliedCoinControl.inputs.length === 1 ? 'input' : 'inputs'
      coinControlSummary = `${appliedCoinControl.inputs.length} ${label} · ${davToDashCompact(creditsToDuffs(inputCredits))} Dash`
      break
    }
  }

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

  let sourceBalanceLabel = 'Shielded balance'
  let sourceBalanceValue = (
    <Text size={12} weight={"medium"} color={"brand"} opacity={50}>Sync notes to load</Text>
  )
  if (fromKind === SourceKind.Core) {
    sourceBalanceLabel = 'Available Core funds'
    sourceBalanceValue = (
      <Text size={14} weight={"extrabold"} color={"brand"}>{davToDash(selectedCoreDuffs)} Dash</Text>
    )
  } else if (fromKind === SourceKind.PlatformAddress) {
    sourceBalanceLabel = 'Available Platform funds'
    sourceBalanceValue = (
      <Text size={14} weight={"extrabold"} color={"brand"}>{davToDash(creditsToDuffs(availableCredits ?? 0n))} Dash</Text>
    )
  } else if (availableCredits !== null) {
    sourceBalanceValue = (
      <Text size={14} weight={"extrabold"} color={"brand"}>{davToDash(creditsToDuffs(availableCredits))} Dash</Text>
    )
  }

  let fundingFeeLabel = 'Reserved for Platform fee'
  let fundingFeeValue = (
    <Text size={12} weight={"medium"} color={"brand"} opacity={50}>—</Text>
  )
  if (fromKind === SourceKind.Core) {
    fundingFeeLabel = 'Reserved for fees'
    fundingFeeValue = (
      <Text size={12} weight={"medium"} color={"brand"}>{davToDash(totalFeeDuffs)} Dash</Text>
    )
  } else if (feeError === null && feeCredits !== null) {
    fundingFeeValue = (
      <Text size={12} weight={"medium"} color={"brand"}>{davToDash(creditsToDuffs(feeCredits))} Dash</Text>
    )
  } else if (feeError === null && feeLoading) {
    fundingFeeValue = <Spinner size={14} className={"text-dash-brand dark:text-dash-mint"} />
  }

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
          if (kind === SourceKind.Shielded) {
            setAmount(davToDash(creditsToDuffs(POOL_IDENTITY_DENOMINATIONS[0])))
          } else {
            setAmount(IDENTITY_REGISTRATION_DEFAULT_AMOUNT)
          }
        }}
        kinds={SOURCE_KINDS.filter(source => source.kind !== SourceKind.Identity)}
        label={"Funding source"}
        platformAddresses={fundedAddresses}
        selectedPlatformAddress={undefined}
        onPlatformAddressChange={() => {}}
        showPlatformAddress={false}
        identities={[]}
        identitiesLoading={false}
        identitiesError={null}
        selectedIdentity={undefined}
        onIdentityChange={() => {}}
        onRetryIdentities={() => {}}
      />
      {fromKind !== SourceKind.Shielded && (
        <button
          type={"button"}
          onClick={() => setCoinControlOpen(true)}
          className={"w-full flex items-center justify-between gap-3 px-4 py-3 rounded-[.875rem] dash-block hover:dash-block-accent-10 transition-colors cursor-pointer"}
        >
          <span className={"flex items-center gap-2"}>
            <SettingsIcon size={14} className={"dash-text-default"} />
            <Text size={12} weight={"extrabold"} color={"brand"}>Coin control</Text>
          </span>
          <Text size={12} weight={"medium"} color={"blue-mint"} className={"text-right"}>{coinControlSummary}</Text>
        </button>
      )}
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
          <Text size={12} weight={"medium"} color={"brand"} opacity={50}>{sourceBalanceLabel}</Text>
          {sourceBalanceValue}
        </div>
        <div className={"flex items-center justify-between gap-4"}>
          <Text size={12} weight={"medium"} color={"brand"} opacity={50}>{fundingFeeLabel}</Text>
          {fundingFeeValue}
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
      {fromKind === SourceKind.Core && coreAddressesError && <Text size={12} weight={"medium"} color={"red"} className={"px-1"}>{coreAddressesError}</Text>}
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

  let reviewFrom = 'Your shielded balance'
  let reviewFundingLabel = 'Identity denomination'
  let reviewFeeLabel = 'Reserved for Platform fee'
  let reviewFeeValue = (
    <Text size={12} weight={"medium"} color={"brand"} opacity={50}>—</Text>
  )
  if (fromKind === SourceKind.Core) {
    reviewFrom = 'Dash Core (L1)'
    reviewFundingLabel = 'Amount to lock'
    reviewFeeLabel = 'Network fees'
    reviewFeeValue = (
      <Text size={12} weight={"medium"} color={"brand"}>{davToDash(totalFeeDuffs)} Dash</Text>
    )
  } else if (fromKind === SourceKind.PlatformAddress) {
    reviewFrom = 'Dash Platform'
    reviewFundingLabel = 'Identity funding'
  }
  if (fromKind !== SourceKind.Core && feeCredits !== null) {
    reviewFeeValue = (
      <Text size={12} weight={"medium"} color={"brand"}>{formatCredits(feeCredits)} credits</Text>
    )
  }

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
          <Text size={12} weight={"medium"} color={"brand"}>{reviewFrom}</Text>
        </div>
        {fromKind !== SourceKind.Shielded && (
          <div className={"flex items-center justify-between gap-4"}>
            <Text size={12} weight={"medium"} color={"brand"} opacity={50}>Coin control</Text>
            <Text size={12} weight={"medium"} color={"brand"} className={"text-right"}>{coinControlSummary}</Text>
          </div>
        )}
        <div className={"flex items-center justify-between gap-4"}>
          <Text size={12} weight={"medium"} color={"brand"} opacity={50}>{reviewFundingLabel}</Text>
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
          <Text size={12} weight={"medium"} color={"brand"} opacity={50}>{reviewFeeLabel}</Text>
          {reviewFeeValue}
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
      <CoinControlModal
        isOpen={coinControlOpen}
        operation={operation}
        selection={appliedCoinControl}
        coreAddresses={coreAddresses}
        utxos={utxos}
        utxosLoading={utxosLoading}
        utxosError={utxosError}
        coreSyncIncomplete={syncIncomplete}
        platformAddresses={fundedAddresses}
        shieldedNotes={[]}
        identityLabel={null}
        identityId={null}
        platformAddress={undefined}
        onRetryUtxos={() => setUtxosReload(current => current + 1)}
        onClose={() => setCoinControlOpen(false)}
        onApply={setCoinControl}
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
          source={coreSpendSource}
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
            { label: 'From', value: coinControlSummary },
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
