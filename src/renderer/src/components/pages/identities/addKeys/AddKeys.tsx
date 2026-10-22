import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button, Text } from '@renderer/components/dash-ui-kit-enxtended'
import SignedActionModal from '@renderer/components/modal/SignedActionModal'
import ShortfallNotice from '@renderer/components/pages/dashpay/ShortfallNotice'
import TransferWizard from '@renderer/components/pages/transfer/TransferWizard'
import CreditsAmount from '@renderer/components/ui/CreditsAmount'
import CustomBadge from '@renderer/components/ui/CustomBadge'
import IdentitySelect from '@renderer/components/ui/IdentitySelect'
import NoResults from '@renderer/components/ui/NoResults'
import PageHeader from '@renderer/components/ui/PageHeader'
import RetryButton from '@renderer/components/ui/RetryButton'
import ListSkeleton from '@renderer/components/ui/Skeleton'
import TxSummary from '@renderer/components/ui/TxSummary'
import { API } from '@renderer/api'
import { IDENTITIES_ROUTES } from '@renderer/constants/identities'
import { ADD_KEYS_COPY, KEYS_FACT_DIVIDER_CLASS, KEYS_FACT_ROW_CLASS, KEYS_SIGNED_COPY } from '@renderer/constants/identityKeys'
import { PAGE_HEADERS } from '@renderer/constants/pageHeaders'
import { SURFACE_SECTION } from '@renderer/constants/surfaces'
import { TX_SUMMARY_PENDING_VALUE } from '@renderer/constants/txSummary'
import { useAuth } from '@renderer/contexts/AuthContext'
import type { IdentityKeyVariant } from '@renderer/enums/IdentityKeys'
import { NoResultsTone } from '@renderer/enums/NoResultsTone'
import { TransferOperation } from '@renderer/enums/TransferOperation'
import { TxEndpointKind } from '@renderer/enums/TxEndpointKind'
import { refreshIdentities, useIdentities } from '@renderer/hooks/useIdentities'
import { useOperationFee } from '@renderer/hooks/useOperationFee'
import type { DashPayNavigationState } from '@renderer/types/DashPay'
import type { AddKeysProps, AddKeysWizardProps, KeysAddedResult } from '@renderer/types/IdentityKeys'
import { feeShortfall } from '@renderer/utils/dashPayShortfall'
import { platformTransactionUrl } from '@renderer/utils/explorer'
import { identityLabel } from '@renderer/utils/identifierFormat'
import { identityAddKeysHref, identityHref } from '@renderer/utils/identities'
import { keyRequestLabel, validateKeySelection, variantRequest } from '@renderer/utils/identityKeyRequests'
import { identityKeysCountLabel, keysAddedLabel, keySelectionLabel, presetKeyVariants, toggleKeyVariant } from '@renderer/utils/identityKeySetup'
import AddKeysConfirmStep from './AddKeysConfirmStep'
import KeyVariantList from './KeyVariantList'

function AddKeysWizard({
  walletId,
  identity,
  identities,
  identitiesLoading,
  identitiesError,
  onSelectIdentity,
  onRetryIdentities,
  onDone,
}: AddKeysWizardProps): React.JSX.Element {
  const { status } = useAuth()
  const network = status?.network ?? null
  const recommended = useMemo(() => presetKeyVariants(identity.keys), [identity.keys])
  const [selected, setSelected] = useState<IdentityKeyVariant[]>([])
  const [submitOpen, setSubmitOpen] = useState(false)
  const requests = useMemo(() => selected.map(variantRequest), [selected])
  const check = validateKeySelection(selected)
  const balance = identity.balance.amount

  const fee = useOperationFee(walletId, TransferOperation.IdentityCreateKeys, {
    amountCredits: 0n,
    recipient: '',
    identityId: identity.identifier,
    keys: requests,
    destinationValid: requests.length > 0,
  })
  const feeCredits = fee.loading || fee.err != null ? null : fee.feeCredits
  const shortfall = check.empty ? null : feeShortfall(fee.err != null, balance, feeCredits)
  const ready = !check.empty && !check.overLimit && feeCredits != null && shortfall == null
  const name = identityLabel(identity)

  const run = async (password: string): Promise<KeysAddedResult> => {
    const stHash = await API.createIdentityKeys(walletId, identity.identifier, requests, password)
    void refreshIdentities(walletId)
    return { stHash, count: requests.length }
  }

  const shortfallView = shortfall && <ShortfallNotice shortfall={shortfall} identity={identity} onRetry={fee.retry} />

  const keysStep = (
    <>
      <div className={"flex flex-col gap-2.5"}>
        <Text size={14} weight={"medium"} color={"brand"} opacity={50}>{ADD_KEYS_COPY.identityLabel}</Text>
        <IdentitySelect
          identities={identities}
          loading={identitiesLoading}
          error={identitiesError}
          selected={identity}
          onSelect={onSelectIdentity}
          onRetry={onRetryIdentities}
          searchable
          renderBadge={entry => <CustomBadge variant={"muted"} text={identityKeysCountLabel(entry.keys.length)} className={"whitespace-nowrap"} />}
        />
      </div>
      <Text size={12} weight={"medium"} color={"brand"} opacity={check.atLimit ? 100 : 50} className={`px-1 ${check.atLimit ? 'text-dash-orange!' : ''}`}>
        {keySelectionLabel(check.count)}
      </Text>
      <KeyVariantList
        existing={identity.keys}
        selected={selected}
        recommended={recommended}
        check={check}
        onToggle={(variant, checked) => setSelected(current => toggleKeyVariant(current, variant, checked))}
      />
      {!check.empty && (
        <div className={`flex flex-col gap-2 ${SURFACE_SECTION}`}>
          <div className={KEYS_FACT_ROW_CLASS}>
            <Text size={12} weight={"medium"} color={"brand"} opacity={50}>{ADD_KEYS_COPY.fee}</Text>
            <Text size={12} weight={"medium"} color={"brand"}>
              {feeCredits == null ? TX_SUMMARY_PENDING_VALUE : <CreditsAmount credits={feeCredits} exact showFiat={false} align={"end"} />}
            </Text>
          </div>
          <div className={KEYS_FACT_ROW_CLASS}>
            <Text size={12} weight={"medium"} color={"brand"} opacity={50}>{KEYS_SIGNED_COPY.identityBalance}</Text>
            <Text size={12} weight={"medium"} color={"brand"}>
              <CreditsAmount credits={balance} exact showFiat={false} align={"end"} />
            </Text>
          </div>
          <div className={KEYS_FACT_DIVIDER_CLASS} />
          <div className={KEYS_FACT_ROW_CLASS}>
            <Text size={12} weight={"medium"} color={"brand"} opacity={50}>{KEYS_SIGNED_COPY.balanceAfter}</Text>
            <Text size={14} weight={"extrabold"} color={"brand"}>
              {feeCredits == null ? TX_SUMMARY_PENDING_VALUE : <CreditsAmount credits={balance - feeCredits} exact showFiat={false} align={"end"} />}
            </Text>
          </div>
        </div>
      )}
      {shortfallView}
    </>
  )

  return (
    <div className={"flex flex-1 min-h-0 flex-col px-12 pb-8"}>
      <TransferWizard
        steps={[
          { label: ADD_KEYS_COPY.keysStep, content: keysStep, canAdvance: ready },
          { label: ADD_KEYS_COPY.confirmStep, content: <AddKeysConfirmStep identity={identity} requests={requests} feeCredits={feeCredits} /> },
        ]}
        onSubmit={() => setSubmitOpen(true)}
        submitLabel={ADD_KEYS_COPY.submit}
        submitDisabled={!ready}
      />
      <SignedActionModal<KeysAddedResult>
        open={submitOpen}
        onClose={() => setSubmitOpen(false)}
        title={ADD_KEYS_COPY.modalTitle}
        summary={
          <TxSummary
            unit={"credits"}
            from={{ value: name, kind: TxEndpointKind.Label, paysFee: true }}
            to={requests.map(request => ({ value: keyRequestLabel(request), kind: TxEndpointKind.Label }))}
            toLabel={ADD_KEYS_COPY.keys}
            fees={[{ label: ADD_KEYS_COPY.fee, amount: feeCredits, unit: 'credits' }]}
            total={feeCredits}
            details={[
              { label: KEYS_SIGNED_COPY.identityBalance, amount: balance, unit: 'credits' },
              { label: KEYS_SIGNED_COPY.balanceAfter, amount: feeCredits == null ? null : balance - feeCredits, unit: 'credits' },
            ]}
          />
        }
        shortfall={shortfallView}
        confirmLabel={ADD_KEYS_COPY.submit}
        confirmDisabled={!ready}
        pendingLabel={KEYS_SIGNED_COPY.pending}
        run={run}
        renderDone={result => ({
          headline: keysAddedLabel(result.count),
          hash: {
            value: result.stHash,
            label: KEYS_SIGNED_COPY.hashLabel,
            explorerUrl: network ? platformTransactionUrl(result.stHash, network) : null,
          },
        })}
        onDone={onDone}
      />
    </div>
  )
}

export default function AddKeys({ walletId, identifier }: AddKeysProps): React.JSX.Element {
  const navigate = useNavigate()
  const location = useLocation()
  const { identities, loading, err } = useIdentities(walletId)
  const identity = identities.find(entry => entry.identifier === identifier) ?? null
  const navigationState = location.state as DashPayNavigationState | null
  const returnTo = navigationState?.returnTo ?? identityHref(identifier)
  const retry = (): void => { void refreshIdentities(walletId) }

  const pageHeader = (
    <div className={"px-12"}>
      <PageHeader
        title={PAGE_HEADERS.addIdentityKeys.title}
        subtitle={PAGE_HEADERS.addIdentityKeys.subtitle}
        onBack={() => navigate(returnTo)}
        backLabel={PAGE_HEADERS.addIdentityKeys.back}
      />
    </div>
  )

  if (identity == null) {
    let body: React.JSX.Element
    if (loading) {
      body = <ListSkeleton rows={3} rowClassName={"h-[3.25rem] rounded-2xl"} />
    } else if (err != null) {
      body = <NoResults tone={NoResultsTone.Error} noResults={err} action={<RetryButton onRetry={retry} />} />
    } else {
      body = (
        <NoResults
          tone={NoResultsTone.Error}
          title={ADD_KEYS_COPY.missingIdentity}
          action={
            <Button type={"button"} size={"compact"} colorScheme={"lightBlue-mint"} onClick={() => navigate(IDENTITIES_ROUTES.root)}>
              {ADD_KEYS_COPY.backToIdentities}
            </Button>
          }
        />
      )
    }
    return (
      <div className={"relative flex flex-col h-full pb-4"}>
        {pageHeader}
        <div className={"px-12"}>{body}</div>
      </div>
    )
  }

  return (
    <div className={"relative flex flex-col h-full pb-4"}>
      {pageHeader}
      <AddKeysWizard
        key={identity.identifier}
        walletId={walletId}
        identity={identity}
        identities={identities}
        identitiesLoading={loading}
        identitiesError={err}
        onSelectIdentity={next => navigate(identityAddKeysHref(next), { replace: true, state: navigationState })}
        onRetryIdentities={retry}
        onDone={() => navigate(returnTo)}
      />
    </div>
  )
}
