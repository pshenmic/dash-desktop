import { useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '@renderer/components/dash-ui-kit-enxtended'
import SignedActionModal from '@renderer/components/modal/SignedActionModal'
import AcceptRequestModal from '@renderer/components/pages/dashpay/contacts/AcceptRequestModal'
import EnableDashPayModal from '@renderer/components/pages/dashpay/keys/EnableDashPayModal'
import ShortfallNotice from '@renderer/components/pages/dashpay/ShortfallNotice'
import TransferWizard from '@renderer/components/pages/transfer/TransferWizard'
import NoResults from '@renderer/components/ui/NoResults'
import PageHeader from '@renderer/components/ui/PageHeader'
import RetryButton from '@renderer/components/ui/RetryButton'
import ListSkeleton from '@renderer/components/ui/Skeleton'
import TxSummary from '@renderer/components/ui/TxSummary'
import { API } from '@renderer/api'
import { DASHPAY_PARAMS, DASHPAY_ROUTES } from '@renderer/constants/dashPay'
import {
  ADD_CONTACT_COPY,
  ADD_CONTACT_FALLBACK_RETURN,
  ADD_CONTACT_IDENTITY_SKELETON_CLASS,
  ADD_CONTACT_IDENTITY_SKELETON_ROWS,
} from '@renderer/constants/dashPayAddContact'
import { DASHPAY_BACK_LABEL, PAGE_HEADERS } from '@renderer/constants/pageHeaders'
import { ContactSegment, DashPayTab } from '@renderer/enums/DashPay'
import { NoResultsTone } from '@renderer/enums/NoResultsTone'
import { TransferOperation } from '@renderer/enums/TransferOperation'
import { TxEndpointKind } from '@renderer/enums/TxEndpointKind'
import { useActiveIdentity } from '@renderer/hooks/useActiveIdentity'
import { useAliasSearch } from '@renderer/hooks/useAliasSearch'
import { setDashPayContactsCache, useDashPayContacts } from '@renderer/hooks/useDashPayContacts'
import { refreshIdentities } from '@renderer/hooks/useIdentities'
import { useOperationFee } from '@renderer/hooks/useOperationFee'
import { useWalletIdentifiers } from '@renderer/hooks/useWalletIdentifiers'
import type { AddContactProps } from '@renderer/types/DashPayScreens'
import type { AddContactFee, AddContactResultRow, AddContactSearchPanel } from '@renderer/types/DashPayAddContact'
import type { DashPayNavigationState } from '@renderer/types/DashPay'
import type { IdentitySelectHandle } from '@renderer/types/IdentitySelect'
import {
  addContactRows,
  aliasSearchPrefix,
  identifierResultRow,
  isAliasSearchCapped,
  isSelectableResult,
  resultRowLabel,
} from '@renderer/utils/dashPayAddContact'
import { dashPayHref } from '@renderer/utils/dashPayIdentity'
import { feeShortfall } from '@renderer/utils/dashPayShortfall'
import { identityLabel, isIdentifierLike } from '@renderer/utils/identifierFormat'
import { returnHref } from '@renderer/utils/searchParams'
import ConfirmStep from './ConfirmStep'
import FindStep from './FindStep'

export default function AddContact({ walletId }: AddContactProps): React.JSX.Element {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { identities, identity, readiness, loading, err, retry, select } = useActiveIdentity()
  const { contacts, loading: contactsLoading } = useDashPayContacts(walletId)
  const selectRef = useRef<IdentitySelectHandle>(null)
  const [query, setQuery] = useState(() => searchParams.get(DASHPAY_PARAMS.query) ?? '')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [target, setTarget] = useState<AddContactResultRow | null>(null)
  const [requestOpen, setRequestOpen] = useState(false)
  const [enableOpen, setEnableOpen] = useState(false)
  const [acceptId, setAcceptId] = useState<string | null>(null)
  const [returnTo] = useState(() => (location.state as DashPayNavigationState | null)?.returnTo ?? null)

  const identifierQuery = isIdentifierLike(query)
  const aliasSearch = useAliasSearch(walletId, identifierQuery ? '' : aliasSearchPrefix(query))
  const actingIdentifier = identity?.identifier ?? null
  const walletIdentifiers = useWalletIdentifiers(identities)
  const rows = useMemo(() => {
    const context = { actingIdentifier: actingIdentifier ?? '', contacts, walletIdentifiers }
    return identifierQuery ? [identifierResultRow(query, context)] : addContactRows(aliasSearch.results, context)
  }, [actingIdentifier, contacts, walletIdentifiers, identifierQuery, query, aliasSearch.results])
  const selected = rows.find(row => row.identifier === selectedId && isSelectableResult(row.state)) ?? null

  const quote = useOperationFee(walletId, TransferOperation.DashPayContactRequest, {
    amountCredits: 0n,
    recipient: selected?.identifier ?? '',
    identityId: actingIdentifier,
    destinationValid: selected != null,
  })
  const fee: AddContactFee = {
    credits: quote.loading || quote.err != null ? null : quote.feeCredits,
    err: quote.err,
    retry: quote.retry,
  }
  const balance = identity?.balance.amount ?? 0n
  const shortfall = feeShortfall(fee.err != null, balance, fee.credits)
  const blocked = shortfall != null
  const canSend = readiness?.canSend === true

  const search: AddContactSearchPanel = {
    rows,
    capped: !identifierQuery && isAliasSearchCapped(aliasSearch.results),
    loading: contactsLoading || (!identifierQuery && aliasSearch.loading),
    err: identifierQuery ? null : aliasSearch.err,
    retry: aliasSearch.retry,
  }

  const backHref = returnHref(returnTo, ADD_CONTACT_FALLBACK_RETURN, actingIdentifier)

  const acceptContact = acceptId == null || actingIdentifier == null
    ? null
    : contacts.find(contact => contact.identifier === actingIdentifier && contact.contactId === acceptId) ?? null

  const pageHeader = (
    <div className={"px-12"}>
      <PageHeader
        title={PAGE_HEADERS.addContact.title}
        subtitle={PAGE_HEADERS.addContact.subtitle}
        onBack={() => navigate(backHref)}
        backLabel={PAGE_HEADERS.addContact.back}
      />
    </div>
  )

  if (identity == null || readiness == null) {
    let body: React.JSX.Element
    if (loading) {
      body = <ListSkeleton rows={ADD_CONTACT_IDENTITY_SKELETON_ROWS} rowClassName={ADD_CONTACT_IDENTITY_SKELETON_CLASS} />
    } else if (err != null) {
      body = <NoResults tone={NoResultsTone.Error} noResults={err} action={<RetryButton onRetry={retry} />} />
    } else {
      body = (
        <NoResults
          noResults={ADD_CONTACT_COPY.noIdentities}
          action={
            <Button type={"button"} size={"compact"} colorScheme={"lightBlue-mint"} onClick={() => navigate(DASHPAY_ROUTES.root)}>
              {DASHPAY_BACK_LABEL}
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

  const openRequest = (): void => {
    if (selected == null) return
    setTarget(selected)
    setRequestOpen(true)
  }

  const findStep = (
    <FindStep
      identities={identities}
      identity={identity}
      readiness={readiness}
      identitiesLoading={loading}
      identitiesError={err}
      onRetryIdentities={retry}
      onSelectIdentity={select}
      selectRef={selectRef}
      onEnable={() => setEnableOpen(true)}
      onSwitchIdentity={() => selectRef.current?.open()}
      query={query}
      onQueryChange={setQuery}
      search={search}
      selectedId={selected?.identifier ?? null}
      onSelectRow={setSelectedId}
      onOpenContact={contactId => navigate(dashPayHref(DASHPAY_ROUTES.root, actingIdentifier, { [DASHPAY_PARAMS.tab]: DashPayTab.Contacts, [DASHPAY_PARAMS.contact]: contactId }))}
      onAccept={setAcceptId}
    />
  )

  const confirmStep = selected == null ? null : (
    <ConfirmStep identity={identity} target={selected} fee={fee} shortfall={shortfall} />
  )

  return (
    <div className={"relative flex flex-col h-full pb-4"}>
      {pageHeader}
      <div className={"flex flex-1 min-h-0 flex-col px-12 pb-8"}>
        <TransferWizard
          steps={[
            { label: ADD_CONTACT_COPY.find, content: findStep, canAdvance: selected != null && canSend },
            { label: ADD_CONTACT_COPY.confirm, content: confirmStep },
          ]}
          onSubmit={openRequest}
          submitLabel={ADD_CONTACT_COPY.submit}
          submitDisabled={selected == null || !canSend || fee.credits == null || blocked}
        />
      </div>
      {target != null && (
        <SignedActionModal<AddContactResultRow>
          open={requestOpen}
          onClose={() => setRequestOpen(false)}
          title={ADD_CONTACT_COPY.modalTitle}
          summary={
            <TxSummary
              unit={"credits"}
              from={{ value: identityLabel(identity), kind: TxEndpointKind.Label, paysFee: true }}
              to={[{ value: resultRowLabel(target), kind: TxEndpointKind.Label }]}
              fees={[{ label: ADD_CONTACT_COPY.fee, amount: fee.credits, unit: 'credits' }]}
              total={fee.credits}
              details={[
                { label: ADD_CONTACT_COPY.identityBalance, amount: balance, unit: 'credits' },
                { label: ADD_CONTACT_COPY.balanceAfter, amount: fee.credits == null || shortfall != null ? null : balance - fee.credits, unit: 'credits' },
              ]}
            />
          }
          shortfall={shortfall && <ShortfallNotice shortfall={shortfall} identity={identity} onRetry={fee.retry} />}
          confirmLabel={ADD_CONTACT_COPY.submit}
          confirmDisabled={fee.credits == null}
          pendingLabel={ADD_CONTACT_COPY.pending}
          run={async password => {
            const list = await API.sendDashPayContactRequest(walletId, identity.identifier, target.identifier, password)
            setDashPayContactsCache(walletId, list)
            void refreshIdentities(walletId)
            return target
          }}
          renderDone={sent => {
            const name = resultRowLabel(sent)
            return {
              headline: `${ADD_CONTACT_COPY.doneHeadline} ${name}`,
              note: `${ADD_CONTACT_COPY.doneNoteLead} ${name} ${ADD_CONTACT_COPY.doneNoteTail}`,
            }
          }}
          onDone={() => navigate(dashPayHref(DASHPAY_ROUTES.root, actingIdentifier, { [DASHPAY_PARAMS.tab]: DashPayTab.Contacts, [DASHPAY_PARAMS.segment]: ContactSegment.Sent }))}
        />
      )}
      <EnableDashPayModal open={enableOpen} onClose={() => setEnableOpen(false)} identity={identity} />
      {acceptContact != null && (
        <AcceptRequestModal open onClose={() => setAcceptId(null)} contact={acceptContact} identity={identity} />
      )}
    </div>
  )
}
