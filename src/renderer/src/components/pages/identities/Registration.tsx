import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, ChainSmallIcon, InfoCircleIcon, KeyIcon, Text } from '@renderer/components/dash-ui-kit-enxtended'
import AssetLockFundingModal from '@renderer/components/modal/AssetLockFundingModal'
import AmountField from '@renderer/components/pages/transfer/AmountField'
import AmountSlider from '@renderer/components/pages/transfer/AmountSlider'
import TransferWizard from '@renderer/components/pages/transfer/TransferWizard'
import P2pSyncAlert from '@renderer/components/ui/P2pSyncAlert'
import Spinner from '@renderer/components/ui/Spinner'
import { API } from '@renderer/api'
import { AssetLockFundingState } from '@renderer/api/types'
import { CORE_FEE_DUFFS, IDENTITY_REGISTRATION_DEFAULT_AMOUNT } from '@renderer/constants'
import { useAuth } from '@renderer/contexts/AuthContext'
import { useConnectionModeContext } from '@renderer/contexts/ConnectionModeContext'
import { AssetLockFundingKind } from '@renderer/enums/AssetLockFundingKind'
import { AssetLockFundingPhase } from '@renderer/enums/AssetLockFundingPhase'
import { useFiat } from '@renderer/hooks/useFiat'
import { refreshIdentities } from '@renderer/hooks/useIdentities'
import { refreshBalance, useWalletBalance } from '@renderer/hooks/useWalletBalance'
import { refreshTransactions } from '@renderer/hooks/useWalletTransactions'
import { davToDash, dashToDuffs, duffsToCredits, formatCredits } from '@renderer/utils/balance'
import {
  identityRegistrationAmountError,
  identityRegistrationMaxDuffs,
  isUnfinishedAssetLockFunding,
} from '@renderer/utils/identityRegistration'

export default function IdentityRegistration(): React.JSX.Element {
  const navigate = useNavigate()
  const { status } = useAuth()
  const walletId = status?.selectedWalletId ?? null
  const { syncIncomplete } = useConnectionModeContext()
  const { balance, loading: balanceLoading, err: balanceError } = useWalletBalance(walletId ?? undefined)
  const { format: formatFiat, rateReady } = useFiat()

  const [amount, setAmount] = useState(IDENTITY_REGISTRATION_DEFAULT_AMOUNT)
  const [fundingState, setFundingState] = useState<AssetLockFundingState | null>(null)
  const [fundingLoading, setFundingLoading] = useState(true)
  const [fundingError, setFundingError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
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
    setAmount(IDENTITY_REGISTRATION_DEFAULT_AMOUNT)
    setModalOpen(false)
    successful.current = false
  }, [walletId])

  const balanceDuffs = balance.dash.amount
  const amountDuffs = useMemo(() => dashToDuffs(amount), [amount])
  const maxDuffs = identityRegistrationMaxDuffs(balanceDuffs)
  const amountError = identityRegistrationAmountError(amount, amountDuffs, balanceDuffs)
  const amountReady = !balanceLoading && !balanceError && amount.length > 0 && amountError === null
  const amountFiat = rateReady && amountDuffs > 0n ? formatFiat(amountDuffs) : null
  const totalDuffs = amountDuffs + CORE_FEE_DUFFS
  const unfinishedFunding = fundingState != null && isUnfinishedAssetLockFunding(fundingState.phase)
    ? fundingState
    : null

  const sliderPercent = useMemo(() => {
    if (maxDuffs <= 0n || amountDuffs <= 0n) return 0
    if (amountDuffs >= maxDuffs) return 100
    return Number((amountDuffs * 100n) / maxDuffs)
  }, [amountDuffs, maxDuffs])

  const handleAmountChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const value = event.target.value
    if (value === '' || /^(?:\d+(?:\.\d{0,8})?|\.\d{0,8})$/.test(value)) setAmount(value)
  }

  const handlePercentChange = (percent: number): void => {
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

  const handleSuccess = useCallback((): void => {
    successful.current = true
    if (!walletId) return
    void Promise.all([
      refreshIdentities(walletId),
      refreshBalance(walletId),
      refreshTransactions(walletId),
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

  const pageHeader = (
    <div className={"flex items-end justify-between gap-6 px-12 pt-2"}>
      <div className={"flex flex-col gap-3"}>
        <Text size={40} weight={"medium"} color={"brand"} className={"leading-[125%] tracking-[-0.03em]"}>Identity registration</Text>
        <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"leading-[120%] max-w-152.5"}>
          Register a wallet-owned Dash Platform identity funded directly from your Core balance.
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
          onSuccess={handleSuccess}
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
            Create your wallet-owned identity and fund it directly from your Dash Core balance.
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
            The wallet broadcasts the Core asset lock and registers the identity after the network lock arrives.
          </Text>
        </div>
        <div className={"flex flex-col gap-[.375rem] rounded-[.9375rem] dash-block-3 p-[.875rem]"}>
          <div className={"flex items-center gap-2"}>
            <KeyIcon size={18} color={"currentColor"} className={"dash-text-primary"} />
            <Text size={14} weight={"extrabold"} color={"brand"}>Keys stay local</Text>
          </div>
          <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"leading-[130%]"}>
            Six identity keys are derived and stored by this wallet. Your seed never leaves the device.
          </Text>
        </div>
      </div>
      <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"leading-[140%]"}>
        Registration starts at 0.1 Dash. Platform fees are paid from the locked amount and the remaining credits become the identity balance.
      </Text>
    </>
  )

  const amountStep = (
    <>
      <div className={"flex flex-col gap-1"}>
        <Text size={20} weight={"extrabold"} color={"brand"}>Choose identity funding</Text>
        <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"leading-[130%]"}>
          This Dash will be locked on Core and converted to Platform credits for the new identity.
        </Text>
      </div>
      <AmountField
        value={amount}
        onChange={handleAmountChange}
        onMax={() => setAmount(davToDash(maxDuffs))}
        unit={<Text size={14} weight={"extrabold"} color={"brand"}>Dash</Text>}
      />
      <AmountSlider percent={sliderPercent} onPercentChange={handlePercentChange} disabled={maxDuffs === 0n} />
      <div className={"flex flex-col gap-2 rounded-[.9375rem] dash-block-3 p-[.875rem]"}>
        <div className={"flex items-center justify-between gap-4"}>
          <Text size={12} weight={"medium"} color={"brand"} opacity={50}>Core balance</Text>
          <Text size={14} weight={"extrabold"} color={"brand"}>{davToDash(balanceDuffs)} Dash</Text>
        </div>
        <div className={"flex items-center justify-between gap-4"}>
          <Text size={12} weight={"medium"} color={"brand"} opacity={50}>Reserved Core fee</Text>
          <Text size={12} weight={"medium"} color={"brand"}>{davToDash(CORE_FEE_DUFFS)} Dash</Text>
        </div>
        {amountFiat && (
          <div className={"flex items-center justify-between gap-4"}>
            <Text size={12} weight={"medium"} color={"brand"} opacity={50}>Funding value</Text>
            <Text size={12} weight={"medium"} color={"blue-mint"}>~ {amountFiat}</Text>
          </div>
        )}
      </div>
      {amountError && <Text size={12} weight={"medium"} color={"red"} className={"px-1"}>{amountError}</Text>}
      {balanceError && <Text size={12} weight={"medium"} color={"red"} className={"px-1"}>{balanceError}</Text>}
      {syncIncomplete && <P2pSyncAlert />}
    </>
  )

  const reviewStep = (
    <>
      <div className={"flex flex-col gap-1"}>
        <Text size={20} weight={"extrabold"} color={"brand"}>Review registration</Text>
        <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"leading-[130%]"}>
          Confirm the amount, then unlock the wallet to start the L1 and Platform transactions.
        </Text>
      </div>
      <div className={"flex flex-col gap-3 rounded-[.9375rem] dash-block-3 p-[.875rem]"}>
        <div className={"flex items-center justify-between gap-4"}>
          <Text size={12} weight={"medium"} color={"brand"} opacity={50}>Amount to lock</Text>
          <Text size={14} weight={"extrabold"} color={"brand"}>{davToDash(amountDuffs)} Dash</Text>
        </div>
        <div className={"flex items-center justify-between gap-4"}>
          <Text size={12} weight={"medium"} color={"brand"} opacity={50}>Credits before Platform fee</Text>
          <Text size={14} weight={"medium"} color={"brand"}>{formatCredits(duffsToCredits(amountDuffs))} credits</Text>
        </div>
        <div className={"flex items-center justify-between gap-4"}>
          <Text size={12} weight={"medium"} color={"brand"} opacity={50}>Core network fee</Text>
          <Text size={12} weight={"medium"} color={"brand"}>{davToDash(CORE_FEE_DUFFS)} Dash</Text>
        </div>
        <div className={"h-px bg-dash-primary-dark-blue/8 dark:bg-white/8"} />
        <div className={"flex items-center justify-between gap-4"}>
          <Text size={12} weight={"medium"} color={"brand"} opacity={50}>Total from Core wallet</Text>
          <Text size={16} weight={"extrabold"} color={"brand"}>{davToDash(totalDuffs)} Dash</Text>
        </div>
        <div className={"flex items-center justify-between gap-4"}>
          <Text size={12} weight={"medium"} color={"brand"} opacity={50}>Creates</Text>
          <Text size={12} weight={"medium"} color={"brand"}>New Platform identity with 6 keys</Text>
        </div>
      </div>
      {syncIncomplete && <P2pSyncAlert />}
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
        submitDisabled={!amountReady || syncIncomplete}
      />
      <AssetLockFundingModal
        isOpen={modalOpen}
        onClose={handleModalClose}
        walletId={walletId}
        toPlatformAddress={''}
        amountDuffs={amountDuffs.toString()}
        resume={false}
        kind={AssetLockFundingKind.Identity}
        onSuccess={handleSuccess}
      />
    </div>
  )
}
