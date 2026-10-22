import { useMemo, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Button, KeyIcon, Text } from '@renderer/components/dash-ui-kit-enxtended'
import SignedActionModal from '@renderer/components/modal/SignedActionModal'
import TransferWizard from '@renderer/components/pages/transfer/TransferWizard'
import Alert from '@renderer/components/ui/Alert'
import CreditsAmount from '@renderer/components/ui/CreditsAmount'
import CustomBadge from '@renderer/components/ui/CustomBadge'
import IdentitySelect from '@renderer/components/ui/IdentitySelect'
import NoResults from '@renderer/components/ui/NoResults'
import PageHeader from '@renderer/components/ui/PageHeader'
import RetryButton from '@renderer/components/ui/RetryButton'
import SensitiveValue from '@renderer/components/ui/SensitiveValue'
import Spinner from '@renderer/components/ui/Spinner'
import StatusPill from '@renderer/components/ui/StatusPill'
import TxSummary from '@renderer/components/ui/TxSummary'
import { API } from '@renderer/api'
import type { AliasDto } from '@renderer/api/types'
import { DASHPAY_CACHE_NAMESPACES, DASHPAY_PARAMS, DASHPAY_READINESS_BADGES, DASHPAY_ROUTES } from '@renderer/constants/dashPay'
import {
  IDENTITY_TOP_UP_HREF,
  REGISTER_SIGN_COPY,
  REGISTER_USERNAME_COPY,
  REGISTER_USERNAME_STEPS,
  USERNAME_AVAILABILITY_BLOCKING,
  USERNAME_DIVIDER_CLASS,
  USERNAMES_TAB_HREF,
} from '@renderer/constants/dashPayUsernames'
import { ALIAS_PRESENTATION } from '@renderer/constants/dpns'
import { PAGE_HEADERS } from '@renderer/constants/pageHeaders'
import { CHIP_ACTION, SURFACE_SECTION } from '@renderer/constants/surfaces'
import { TX_SUMMARY_PENDING_VALUE } from '@renderer/constants/txSummary'
import { useAuth } from '@renderer/contexts/AuthContext'
import { AlertTone } from '@renderer/enums/AlertTone'
import { AliasPresentation, DpnsLabelKind, UsernameAvailability } from '@renderer/enums/DashPay'
import { NoResultsTone } from '@renderer/enums/NoResultsTone'
import { TransferOperation } from '@renderer/enums/TransferOperation'
import { TxEndpointKind } from '@renderer/enums/TxEndpointKind'
import { useActiveIdentity } from '@renderer/hooks/useActiveIdentity'
import { useAliasSearch } from '@renderer/hooks/useAliasSearch'
import { setAsyncCache } from '@renderer/hooks/useAsyncWithCache'
import { useBalanceVisibility } from '@renderer/hooks/useBalanceVisibility'
import { refreshDashPayAliases, useDashPayAliases } from '@renderer/hooks/useDashPayAliases'
import { useDebugMode } from '@renderer/hooks/useDebugMode'
import { refreshIdentities } from '@renderer/hooks/useIdentities'
import { useOperationFee } from '@renderer/hooks/useOperationFee'
import type { DashPayNavigationState } from '@renderer/types/DashPay'
import type { RegisterUsernameProps } from '@renderer/types/DashPayScreens'
import type { RegisterFeeSummaryProps, RegisterShortfallProps } from '@renderer/types/DashPayUsernames'
import type { SignedActionDoneView, SignedActionFailureView } from '@renderer/types/SignedActionModal'
import { creditsToDash } from '@renderer/utils/balance'
import { dashPayReadiness } from '@renderer/utils/dashPayReadiness'
import {
  balanceAfterFee,
  contestHref,
  feeShortfall,
  registerCanAdvance,
  registerDoneNote,
} from '@renderer/utils/dashPayUsernames'
import { exactAliasMatch, fullDpnsName, validateDpnsLabel } from '@renderer/utils/dpnsLabel'
import { identityLabel, shortIdentifier } from '@renderer/utils/identifierFormat'
import { returnHref, withParams } from '@renderer/utils/searchParams'
import { aliasPresentation, findResumableAlias, usernameAvailability } from '@renderer/utils/usernames'
import RegisterConfirmStep from './RegisterConfirmStep'
import UsernameCheck from './UsernameCheck'
import UsernameField from './UsernameField'

function RegisterShortfall({ identity, feeCredits, error, onRetry }: RegisterShortfallProps): React.JSX.Element | null {
  const navigate = useNavigate()
  const short = feeShortfall(identity.balance.amount, feeCredits)
  if (error) {
    return (
      <div className={"flex items-center gap-2 px-1"}>
        <Text size={12} weight={"medium"} color={"red"}>{REGISTER_USERNAME_COPY.feeError}</Text>
        <button type={"button"} className={CHIP_ACTION} onClick={onRetry}>{REGISTER_USERNAME_COPY.retry}</button>
      </div>
    )
  }
  if (short == null) return null
  return (
    <div className={"flex items-center gap-2 px-1"}>
      <Text size={12} weight={"medium"} color={"red"} className={"min-w-0"}>
        {`${identityLabel(identity)} ${REGISTER_USERNAME_COPY.needs} ${creditsToDash(short)} ${REGISTER_USERNAME_COPY.more}`}
      </Text>
      <button type={"button"} className={`${CHIP_ACTION} shrink-0`} onClick={() => navigate(IDENTITY_TOP_UP_HREF)}>
        {REGISTER_USERNAME_COPY.topUp}
      </button>
    </div>
  )
}

function RegisterFeeSummary({ feeLabel, feeCredits, balance }: RegisterFeeSummaryProps): React.JSX.Element {
  const { isBalanceVisible } = useBalanceVisibility()
  const after = balanceAfterFee(balance, feeCredits)
  return (
    <div className={`flex flex-col gap-3 ${SURFACE_SECTION}`}>
      <div className={"flex items-center justify-between gap-4"}>
        <Text size={12} weight={"medium"} color={"brand"} opacity={50}>{feeLabel}</Text>
        <Text size={14} weight={"medium"} color={"brand"}>
          {feeCredits == null ? TX_SUMMARY_PENDING_VALUE : <CreditsAmount credits={feeCredits} showFiat={false} align={"end"} />}
        </Text>
      </div>
      <div className={"flex items-center justify-between gap-4"}>
        <Text size={12} weight={"medium"} color={"brand"} opacity={50}>{REGISTER_USERNAME_COPY.identityBalance}</Text>
        <Text size={14} weight={"medium"} color={"brand"}>
          <SensitiveValue hidden={!isBalanceVisible} size={"compact"}>
            <CreditsAmount credits={balance} showFiat={false} align={"end"} />
          </SensitiveValue>
        </Text>
      </div>
      <div className={USERNAME_DIVIDER_CLASS} />
      <div className={"flex items-center justify-between gap-4"}>
        <Text size={12} weight={"medium"} color={"brand"} opacity={50}>{REGISTER_USERNAME_COPY.balanceAfter}</Text>
        <Text size={16} weight={"extrabold"} color={"brand"}>
          {after == null ? TX_SUMMARY_PENDING_VALUE : (
            <SensitiveValue hidden={!isBalanceVisible} size={"compact"}>
              <CreditsAmount credits={after} showFiat={false} align={"end"} />
            </SensitiveValue>
          )}
        </Text>
      </div>
    </div>
  )
}

export default function RegisterUsername({ walletId }: RegisterUsernameProps): React.JSX.Element {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { status } = useAuth()
  const network = status?.network ?? null
  const debugMode = useDebugMode()
  const [returnTo] = useState(() => (location.state as DashPayNavigationState | null)?.returnTo ?? null)
  const [raw, setRaw] = useState(() => searchParams.get(DASHPAY_PARAMS.label) ?? '')
  const [signOpen, setSignOpen] = useState(false)
  const { identities, identity, readiness, loading, err, retry, select } = useActiveIdentity()
  const { aliases } = useDashPayAliases(walletId)

  const identifier = identity?.identifier ?? null
  const check = useMemo(() => validateDpnsLabel(raw), [raw])
  const resumable = identifier != null && check.issue == null && findResumableAlias(aliases, identifier, check.normalized) != null
  const searchPrefix = identifier != null && check.issue == null && !resumable ? check.normalized : ''
  const search = useAliasSearch(walletId, searchPrefix)
  const walletIdentifiers = useMemo(() => new Set(identities.map(item => item.identifier)), [identities])
  const availability = usernameAvailability({
    normalized: searchPrefix,
    identifier: identifier ?? '',
    walletIdentifiers,
    results: search.results,
    loading: search.loading,
    error: search.err,
  })
  const owner = availability === UsernameAvailability.OwnedByWallet ? exactAliasMatch(search.results, searchPrefix) : null

  const fee = useOperationFee(walletId, TransferOperation.AliasRegister, {
    amountCredits: 0n,
    recipient: check.label,
    identityId: identifier,
    destinationValid: identifier != null && check.issue == null,
  })
  const feeReady = !fee.loading && fee.err == null && fee.feeCredits != null
  const feeCredits = feeReady ? fee.feeCredits : null
  const contested = check.kind === DpnsLabelKind.Contested
  const feeLabel = contested ? REGISTER_USERNAME_COPY.feeContested : REGISTER_USERNAME_COPY.fee
  const balance = identity?.balance.amount ?? 0n

  const exit = (): void => {
    navigate(returnHref(returnTo, USERNAMES_TAB_HREF, identifier))
  }
  const pageHeader = (
    <div className={"px-12"}>
      <PageHeader
        title={PAGE_HEADERS.registerUsername.title}
        subtitle={PAGE_HEADERS.registerUsername.subtitle}
        onBack={exit}
        backLabel={PAGE_HEADERS.registerUsername.back}
      />
    </div>
  )

  if (identity == null || readiness == null) {
    let placeholder: React.JSX.Element
    if (loading) {
      placeholder = <div className={"flex min-h-80 items-center justify-center"}><Spinner size={24} /></div>
    } else if (err != null) {
      placeholder = <NoResults tone={NoResultsTone.Error} noResults={err} action={<RetryButton onRetry={retry} />} />
    } else {
      placeholder = (
        <NoResults
          tone={NoResultsTone.Error}
          noResults={REGISTER_USERNAME_COPY.noIdentities}
          action={<Button type={"button"} size={"compact"} colorScheme={"primary"} onClick={exit}>{PAGE_HEADERS.registerUsername.back}</Button>}
        />
      )
    }
    return (
      <div className={"relative flex flex-col h-full pb-4"}>
        {pageHeader}
        <div className={"px-12"}>{placeholder}</div>
      </div>
    )
  }

  const canAdvance = registerCanAdvance({
    issue: check.issue,
    canRegister: readiness.canRegister,
    resumable,
    availability,
    feeCredits,
    feeReady,
    balance,
  })
  const hasShortfall = fee.err != null || feeShortfall(balance, feeCredits) != null
  const shortfall = hasShortfall
    ? <RegisterShortfall identity={identity} feeCredits={feeCredits} error={fee.err != null} onRetry={fee.retry} />
    : undefined
  const keysHref = `${DASHPAY_ROUTES.addKeys}?${withParams('', { [DASHPAY_PARAMS.identity]: identity.identifier })}`
  const keysState: DashPayNavigationState = { returnTo: location.pathname + location.search }
  const invalid = check.label !== '' && (check.issue != null || USERNAME_AVAILABILITY_BLOCKING.includes(availability))

  const classifyFailure = async (): Promise<SignedActionFailureView | null> => {
    const fresh = await API.getAliases(walletId)
    setAsyncCache(DASHPAY_CACHE_NAMESPACES.aliases, walletId, fresh)
    if (findResumableAlias(fresh, identity.identifier, check.normalized) == null) return null
    return {
      title: REGISTER_SIGN_COPY.failedTitle,
      description: REGISTER_SIGN_COPY.failedDescription,
      retryLabel: REGISTER_SIGN_COPY.retry,
    }
  }

  const run = async (password: string): Promise<AliasDto> => {
    const alias = await API.registerAlias(walletId, identity.identifier, check.label, password)
    void refreshDashPayAliases(walletId)
    void refreshIdentities(walletId)
    return alias
  }

  const renderDone = (alias: AliasDto): SignedActionDoneView => {
    const presentation = aliasPresentation(alias)
    const spec = ALIAS_PRESENTATION[presentation]
    return {
      headline: fullDpnsName(alias.label),
      note: registerDoneNote(alias, network, Date.now()),
      details: [
        { label: REGISTER_SIGN_COPY.identity, value: identityLabel(identity) },
        { label: REGISTER_SIGN_COPY.status, value: <StatusPill tone={spec.tone} loading={presentation === AliasPresentation.Pending}>{spec.label}</StatusPill> },
      ],
      hash: alias.documentId == null ? undefined : { value: alias.documentId, label: REGISTER_SIGN_COPY.documentId, explorerUrl: null },
      secondary: presentation === AliasPresentation.Voting && debugMode
        ? { label: REGISTER_SIGN_COPY.viewContest, onClick: () => navigate(contestHref(alias.normalizedLabel)) }
        : undefined,
    }
  }

  const usernameStep = (
    <>
      <div className={"flex flex-col gap-2.5"}>
        <Text size={14} weight={"medium"} color={"brand"} opacity={50}>{REGISTER_USERNAME_COPY.forIdentity}</Text>
        <IdentitySelect
          identities={identities}
          loading={loading}
          error={err}
          selected={identity}
          onSelect={select}
          onRetry={retry}
          searchable
          renderBadge={(item) => {
            const badge = DASHPAY_READINESS_BADGES[dashPayReadiness(item).readiness]
            return <CustomBadge variant={badge.variant} text={badge.text} />
          }}
        />
      </div>
      <div className={"flex flex-col gap-2.5"}>
        <Text size={14} weight={"medium"} color={"brand"} opacity={50}>{REGISTER_USERNAME_COPY.username}</Text>
        <UsernameField value={raw} onChange={setRaw} invalid={invalid} />
        <UsernameCheck
          check={check}
          network={network}
          availability={availability}
          resumable={resumable}
          ownerName={owner == null ? null : shortIdentifier(owner.identifier)}
          onRetry={search.retry}
        />
      </div>
      {!readiness.canRegister && (
        <Alert
          tone={AlertTone.Warning}
          icon={<KeyIcon size={16} color={"currentColor"} />}
          title={REGISTER_USERNAME_COPY.noKeyTitle}
          description={REGISTER_USERNAME_COPY.noKeyDescription}
          actions={
            <Button type={"button"} size={"compact"} colorScheme={"primary"} onClick={() => navigate(keysHref, { state: keysState })}>
              {REGISTER_USERNAME_COPY.addKeys}
            </Button>
          }
        />
      )}
      {check.label !== '' && check.issue == null && (
        <>
          <RegisterFeeSummary feeLabel={feeLabel} feeCredits={feeCredits} balance={balance} />
          {shortfall}
        </>
      )}
    </>
  )

  const confirmStep = (
    <RegisterConfirmStep check={check} identity={identity} network={network} feeLabel={feeLabel} feeCredits={feeCredits} />
  )

  return (
    <div className={"relative flex flex-col h-full pb-4"}>
      {pageHeader}
      <div className={"flex flex-1 min-h-0 flex-col px-12 pb-8"}>
        <TransferWizard
          steps={[
            { label: REGISTER_USERNAME_STEPS.username, content: usernameStep, canAdvance },
            { label: REGISTER_USERNAME_STEPS.confirm, content: confirmStep },
          ]}
          onSubmit={() => setSignOpen(true)}
          submitLabel={REGISTER_USERNAME_COPY.submit}
          submitDisabled={!canAdvance}
        />
      </div>
      <SignedActionModal<AliasDto>
        open={signOpen}
        onClose={() => setSignOpen(false)}
        title={REGISTER_SIGN_COPY.title}
        summary={
          <TxSummary
            unit={"credits"}
            from={{ value: identityLabel(identity), kind: TxEndpointKind.Label, paysFee: true }}
            to={[{ value: fullDpnsName(check.label), kind: TxEndpointKind.Label }]}
            toLabel={REGISTER_SIGN_COPY.toLabel}
            fees={[{ label: feeLabel, amount: feeCredits, unit: 'credits' }]}
            total={feeCredits}
            details={[
              { label: REGISTER_USERNAME_COPY.identityBalance, amount: balance, unit: 'credits' },
              { label: REGISTER_USERNAME_COPY.balanceAfter, amount: balanceAfterFee(balance, feeCredits), unit: 'credits' },
            ]}
          />
        }
        shortfall={shortfall}
        confirmLabel={REGISTER_SIGN_COPY.confirm}
        confirmDisabled={!feeReady}
        pendingLabel={`${REGISTER_SIGN_COPY.pending} ${fullDpnsName(check.label)}…`}
        run={run}
        renderDone={renderDone}
        classifyFailure={classifyFailure}
        onDone={exit}
      />
    </div>
  )
}
