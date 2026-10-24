import { useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '@renderer/components/dash-ui-kit-enxtended'
import { CheckCirclePartialIcon, ContactsIcon } from '@renderer/components/dash-ui-kit-enxtended/icons'
import EnableDashPayModal from '@renderer/components/pages/dashpay/keys/EnableDashPayModal'
import { DASHPAY_PARAMS, DASHPAY_ROUTES, DASHPAY_TOP_UP_HREF, OVERVIEW_PREVIEW_LIMIT } from '@renderer/constants/dashPay'
import {
  DASHPAY_REGISTER_IDENTITY_HREF,
  OVERVIEW_ACTION_LABELS,
  OVERVIEW_CONTESTS_HREF,
  OVERVIEW_COPY,
  OVERVIEW_ENTRY_GRID_CLASS,
  OVERVIEW_ORBIT_COUNT,
  OVERVIEW_ROW_CLASS,
  OVERVIEW_SKELETON_CLASS,
} from '@renderer/constants/dashPayOverview'
import { DashPayReadiness, DashPayTab, ContactSegment, OverviewAction, OverviewBand } from '@renderer/enums/DashPay'
import { useDashPayAliases } from '@renderer/hooks/useDashPayAliases'
import { useDashPayContacts } from '@renderer/hooks/useDashPayContacts'
import { useDebugMode } from '@renderer/hooks/useDebugMode'
import { useWalletIdentifiers } from '@renderer/hooks/useWalletIdentifiers'
import type { DashPayNavigationState } from '@renderer/types/DashPay'
import type { OverviewTabProps } from '@renderer/types/DashPayScreens'
import { contactsForIdentity, countContactSegments } from '@renderer/utils/dashPayContactList'
import { orbitIdentifiers, overviewActions, overviewBand, usernameSummary } from '@renderer/utils/dashPayOverview'
import { identityHref } from '@renderer/utils/identities'
import { withParams } from '@renderer/utils/searchParams'
import { mergeIdentityUsernames } from '@renderer/utils/usernames'
import ContactsSummary from './ContactsSummary'
import EntryCard from './EntryCard'
import OverviewHero from './OverviewHero'
import PreviewList from './PreviewList'
import SetupChecklist from './SetupChecklist'

export default function OverviewTab({
  walletId,
  identity,
  identities,
  readiness,
  loading,
  now,
  onSwitchIdentity,
  onOpenSection,
}: OverviewTabProps): React.JSX.Element {
  const navigate = useNavigate()
  const location = useLocation()
  const debugMode = useDebugMode()
  const [, setSearchParams] = useSearchParams()
  const { contacts, loading: contactsLoading } = useDashPayContacts(walletId)
  const { aliases } = useDashPayAliases(walletId)
  const [enabling, setEnabling] = useState(false)
  const walletIdentifiers = useWalletIdentifiers(identities)

  if (loading) {
    return (
      <div className={OVERVIEW_ROW_CLASS} role={'status'}>
        <div className={OVERVIEW_SKELETON_CLASS} />
        <div className={OVERVIEW_SKELETON_CLASS} />
      </div>
    )
  }

  const openWizard = (path: string): void => {
    const state: DashPayNavigationState = { returnTo: `${location.pathname}${location.search}` }
    navigate(path, { state })
  }

  const openContact = (contactId: string): void => {
    setSearchParams(prev => withParams(prev, { [DASHPAY_PARAMS.contact]: contactId }))
  }

  const runAction = (action: OverviewAction): void => {
    if (action === OverviewAction.CreateIdentity) navigate(DASHPAY_REGISTER_IDENTITY_HREF)
    else if (action === OverviewAction.EnableDashPay) setEnabling(true)
    else if (action === OverviewAction.RegisterUsername) openWizard(DASHPAY_ROUTES.registerUsername)
    else openWizard(DASHPAY_ROUTES.addContact)
  }

  const canSend = readiness?.canSend ?? false
  const canRegister = readiness?.canRegister ?? false
  const ready = identity != null && readiness?.readiness === DashPayReadiness.Ready
  const orbit = identity == null ? [] : orbitIdentifiers(contacts, identity.identifier, OVERVIEW_ORBIT_COUNT)

  const actionDisabled = (action: OverviewAction): boolean =>
    (action === OverviewAction.FindPeople && !canSend) || (action === OverviewAction.RegisterUsername && !canRegister)

  const heroActions = ready ? (
    <>
      <Button type={'button'} size={'compact'} colorScheme={'primary'} onClick={() => openWizard(DASHPAY_ROUTES.addContact)}>
        {OVERVIEW_COPY.addContact}
      </Button>
      <Button type={'button'} size={'compact'} colorScheme={'primary-light'} onClick={() => openWizard(DASHPAY_ROUTES.registerUsername)}>
        {OVERVIEW_COPY.registerUsername}
      </Button>
    </>
  ) : overviewActions(identity, readiness).map((action, index) => (
    <Button
      key={action}
      type={'button'}
      size={'compact'}
      colorScheme={index === 0 ? 'primary' : 'primary-light'}
      disabled={actionDisabled(action)}
      onClick={() => runAction(action)}
    >
      {OVERVIEW_ACTION_LABELS[action]}
    </Button>
  ))

  const hero = (
    <OverviewHero
      identity={identity}
      ready={ready}
      orbit={orbit}
      body={identity == null ? OVERVIEW_COPY.noIdentityBody : OVERVIEW_COPY.onboardingBody}
      actions={heroActions}
    />
  )

  const own = identity == null ? [] : contactsForIdentity(contacts, identity.identifier)
  const band = ready && identity != null ? overviewBand(contacts, identity.identifier, OVERVIEW_PREVIEW_LIMIT) : null
  const usernames = usernameSummary(identity == null ? [] : mergeIdentityUsernames(identity.aliasesList, aliases, identity.identifier))

  return (
    <div className={'flex flex-col'}>
      <div className={OVERVIEW_ROW_CLASS}>
        {hero}
        {ready ? (
          <ContactsSummary
            counts={countContactSegments(own, '')}
            usernames={usernames}
            keys={identity?.keys.length ?? 0}
            loading={contactsLoading}
            onOpenSection={onOpenSection}
            onOpenKeys={() => { if (identity != null) navigate(identityHref(identity.identifier)) }}
          />
        ) : (
          <SetupChecklist
            identity={identity}
            readiness={readiness}
            canSwitch={identities.length > 1}
            onAction={runAction}
            onTopUp={() => navigate(DASHPAY_TOP_UP_HREF)}
            onSwitchIdentity={onSwitchIdentity}
          />
        )}
      </div>
      {band != null && identity != null && readiness != null && (
        <PreviewList
          band={band}
          identity={identity}
          walletIdentifiers={walletIdentifiers}
          canSend={readiness.canSend}
          now={now}
          onViewAll={() => onOpenSection(
            DashPayTab.Contacts,
            band.kind === OverviewBand.Requests ? ContactSegment.Requests : ContactSegment.Contacts,
          )}
          onOpenContact={openContact}
        />
      )}
      <div className={OVERVIEW_ENTRY_GRID_CLASS}>
        {identity != null && (
          <EntryCard
            icon={<ContactsIcon size={14} color={'currentColor'} />}
            title={OVERVIEW_COPY.findPeople}
            caption={canSend ? OVERVIEW_COPY.findPeopleCaption : OVERVIEW_COPY.findPeopleDisabled}
            disabled={!canSend}
            onClick={() => openWizard(DASHPAY_ROUTES.addContact)}
          />
        )}
        {debugMode && (
          <EntryCard
            icon={<CheckCirclePartialIcon size={14} color={'currentColor'} />}
            title={OVERVIEW_COPY.nameContests}
            caption={OVERVIEW_COPY.nameContestsCaption}
            onClick={() => navigate(OVERVIEW_CONTESTS_HREF)}
          />
        )}
      </div>
      {enabling && identity != null && <EnableDashPayModal open onClose={() => setEnabling(false)} identity={identity} />}
    </div>
  )
}
