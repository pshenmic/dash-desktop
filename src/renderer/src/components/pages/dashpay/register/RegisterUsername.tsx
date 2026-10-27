import { useMemo, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Button, KeyIcon, Text } from '@renderer/components/dash-ui-kit-extended'
import SignedActionModal from '@renderer/components/modal/SignedActionModal'
import ShortfallNotice from '@renderer/components/pages/dashpay/ShortfallNotice'
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
import type { UsernameDto } from '@renderer/api/types'
import { DASHPAY_PARAMS, DASHPAY_READINESS_BADGES } from '@renderer/constants/dashPay'
import {
  REGISTER_SIGN_COPY,
  REGISTER_USERNAME_COPY,
  REGISTER_USERNAME_STEPS,
  USERNAME_AVAILABILITY_BLOCKING,
  USERNAME_DIVIDER_CLASS,
  USERNAMES_TAB_HREF,
} from '@renderer/constants/dashPayUsernames'
import { USERNAME_PRESENTATION } from '@renderer/constants/dpns'
import { PAGE_HEADERS } from '@renderer/constants/pageHeaders'
import { SURFACE_SECTION } from '@renderer/constants/surfaces'
import { TX_SUMMARY_PENDING_VALUE } from '@renderer/constants/txSummary'
import { useAuth } from '@renderer/contexts/AuthContext'
import { AlertTone } from '@renderer/enums/AlertTone'
import { DpnsLabelKind, UsernameAvailability } from '@renderer/enums/DashPay'
import { NoResultsTone } from '@renderer/enums/NoResultsTone'
import { TransferOperation } from '@renderer/enums/TransferOperation'
import { TxEndpointKind } from '@renderer/enums/TxEndpointKind'
import { useActiveIdentity } from '@renderer/hooks/useActiveIdentity'
import { useUsernameSearch } from '@renderer/hooks/useUsernameSearch'
import { useBalanceVisibility } from '@renderer/hooks/useBalanceVisibility'
import { refreshDashPayUsernames, useDashPayUsernames } from '@renderer/hooks/useDashPayUsernames'
import { refreshIdentities } from '@renderer/hooks/useIdentities'
import { useOperationFee } from '@renderer/hooks/useOperationFee'
import { useWalletIdentifiers } from '@renderer/hooks/useWalletIdentifiers'
import type { DashPayNavigationState } from '@renderer/types/DashPay'
import type { RegisterUsernameProps } from '@renderer/types/DashPayScreens'
import type { RegisterFeeSummaryProps } from '@renderer/types/DashPayUsernames'
import type { SignedActionDoneView } from '@renderer/types/SignedActionModal'
import { identityAddKeysHref } from '@renderer/utils/identities'
import { dashPayReadiness } from '@renderer/utils/dashPayReadiness'
import { feeShortfall } from '@renderer/utils/dashPayShortfall'
import {
  balanceAfterFee,
  registerCanAdvance,
  registerDoneNote,
} from '@renderer/utils/dashPayUsernames'
import { exactUsernameMatch, fullDpnsName, validateDpnsLabel } from '@renderer/utils/dpnsLabel'
import { identityLabel } from '@renderer/utils/identifierFormat'
import { returnHref } from '@renderer/utils/searchParams'
import { usernamePresentation, usernameAvailability, walletUsernameClaim } from '@renderer/utils/usernames'
import RegisterConfirmStep from './RegisterConfirmStep'
import UsernameCheck from './UsernameCheck'
import UsernameField from './UsernameField'

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
  const [returnTo] = useState(() => (location.state as DashPayNavigationState | null)?.returnTo ?? null)
  const [raw, setRaw] = useState(() => searchParams.get(DASHPAY_PARAMS.label) ?? '')
  const [signOpen, setSignOpen] = useState(false)
  const { identities, identity, readiness, loading, err, retry, select } = useActiveIdentity()
  const { usernames: walletUsernames } = useDashPayUsernames(walletId)

  const identifier = identity?.identifier ?? null
  const check = useMemo(() => validateDpnsLabel(raw), [raw])
  const searchPrefix = identifier != null && check.issue == null ? check.normalized : ''
  const search = useUsernameSearch(walletId, searchPrefix)
  const walletIdentifiers = useWalletIdentifiers(identities)
  const availability = usernameAvailability({
    normalized: searchPrefix,
    identifier: identifier ?? '',
    walletIdentifiers,
    walletUsernames,
    results: search.results,
    loading: search.loading,
    error: search.err,
  })
  const owner = availability === UsernameAvailability.OwnedByWallet || availability === UsernameAvailability.InWalletContest
    ? walletUsernameClaim(walletUsernames, searchPrefix) ?? exactUsernameMatch(search.results, searchPrefix)
    : null

  const fee = useOperationFee(walletId, TransferOperation.UsernameRegister, {
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
    availability,
    feeCredits,
    feeReady,
    balance,
  })
  const shortfall = feeShortfall(fee.err != null, balance, feeCredits)
  const shortfallView = shortfall && <ShortfallNotice shortfall={shortfall} identity={identity} onRetry={fee.retry} />
  const keysHref = identityAddKeysHref(identity.identifier)
  const keysState: DashPayNavigationState = { returnTo: location.pathname + location.search }
  const invalid = check.label !== '' && (check.issue != null || USERNAME_AVAILABILITY_BLOCKING.includes(availability))

  const run = async (password: string): Promise<UsernameDto> => {
    const username = await API.registerUsername(walletId, identity.identifier, check.label, password)
    void refreshDashPayUsernames(walletId)
    void refreshIdentities(walletId)
    return username
  }

  const renderDone = (username: UsernameDto): SignedActionDoneView => {
    const presentation = usernamePresentation(username)
    const spec = USERNAME_PRESENTATION[presentation]
    return {
      headline: fullDpnsName(username.label),
      note: registerDoneNote(username, network, Date.now()),
      details: [
        { label: REGISTER_SIGN_COPY.identity, value: identityLabel(identity) },
        { label: REGISTER_SIGN_COPY.status, value: <StatusPill tone={spec.tone}>{spec.label}</StatusPill> },
      ],
      hash: username.documentId == null ? undefined : { value: username.documentId, label: REGISTER_SIGN_COPY.documentId, explorerUrl: null },
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
          ownerName={owner?.identifier ?? null}
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
          {shortfallView}
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
      <SignedActionModal<UsernameDto>
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
        shortfall={shortfallView}
        confirmLabel={REGISTER_SIGN_COPY.confirm}
        confirmDisabled={!feeReady}
        pendingLabel={`${REGISTER_SIGN_COPY.pending} ${fullDpnsName(check.label)}…`}
        run={run}
        renderDone={renderDone}
        onDone={exit}
      />
    </div>
  )
}
