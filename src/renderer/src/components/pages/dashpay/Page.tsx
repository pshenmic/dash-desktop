import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Tabs } from 'dash-ui-kit/react'
import { Button, PlusIcon, Text } from '@renderer/components/dash-ui-kit-enxtended'
import { ProgressStepBar } from '@renderer/components/dash-ui-kit-enxtended/progressStepBar'
import ListSkeleton from '@renderer/components/ui/Skeleton'
import DropdownField from '@renderer/components/ui/DropdownField'
import { useDashpayDemo } from '@renderer/contexts/DashpayDemoContext'
import { DASHPAY_SCENARIOS, DASHPAY_TABS, DEMO_TABS_TRIGGER_CLASS } from '@renderer/constants/dashpayDemo'
import { getDemoIdentityContacts } from '@renderer/utils/dashpayDemo'
import type { DashpayScenario, DashpayTab } from '@renderer/types/dashpayDemo'
import { DemoBadge, DemoCard, DemoEmptyState, DemoModal, DemoNotice } from './shared'
import Overview from './Overview'
import Names from './Names'
import Contacts from './Contacts'
import RegisterNameModal from './RegisterNameModal'

export default function Dashpay(): React.JSX.Element {
  const { state, identity, setScenario, selectIdentity, createIdentity } = useDashpayDemo()
  const [params, setParams] = useSearchParams()
  const [registerOpen, setRegisterOpen] = useState(false)
  const [joinOpen, setJoinOpen] = useState(false)
  const [previewRevision, setPreviewRevision] = useState(0)
  const requestedTab = params.get('tab')
  const tab: DashpayTab = requestedTab === 'names' || requestedTab === 'contacts' ? requestedTab : 'overview'
  const contactsCount = getDemoIdentityContacts(state).filter((contact) => contact.status === 'contact').length
  const unavailable = state.scenario === 'loading' || state.scenario === 'error'

  const changeTab = (next: DashpayTab): void => setParams({ tab: next })

  const changeScenario = (scenario: DashpayScenario): void => {
    setRegisterOpen(false)
    setJoinOpen(false)
    setPreviewRevision((revision) => revision + 1)
    setScenario(scenario)
  }

  const tabItems = DASHPAY_TABS.map((item) => ({
    value: item.value,
    label: item.value === 'contacts' && contactsCount > 0 ? `${item.label} (${contactsCount})` : item.label,
    content: state.scenario === 'loading' ? (
      <div>
        <div role="status" aria-live="polite">
          <Text reset as="p" size={14} weight="medium" color="brand" className="mb-6">Checking your DashPay status…</Text>
          <ListSkeleton rows={3} />
        </div>
        <Button size="xs" colorScheme="lightBlue-mint" className="mt-6" onClick={() => setScenario('ready')}>Check again</Button>
      </div>
    ) : state.scenario === 'error' ? (
      <DemoEmptyState title="We couldn't check your status" description="Your registration status is unknown. Try checking again to continue." action={<Button size="sm" onClick={() => setScenario('ready')}>Retry status check</Button>} />
    ) : (
      <div key={state.selectedIdentityId + ':' + previewRevision}>
        {item.value === 'overview' && (
          <Overview
            onRegister={() => setRegisterOpen(true)}
            onJoin={() => setJoinOpen(true)}
            onTab={changeTab}
            onSearch={(query) => setParams({ tab: 'names', q: query })}
          />
        )}
        {item.value === 'names' && <Names initialSearch={params.get('q') ?? undefined} onContact={() => changeTab('contacts')} />}
        {item.value === 'contacts' && <Contacts />}
      </div>
    ),
  }))

  return (
    <div className="space-y-6 px-12 pb-12">
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <div className="flex items-center gap-3">
            <Text reset as="h1" size={40} weight="medium" color="brand" className="leading-[125%] tracking-[-.03em]">DashPay</Text>
            <DemoBadge tone="blue">Preview</DemoBadge>
          </div>
          <Text reset as="p" size={12} weight="medium" color="brand" opacity={50} className="mt-3 leading-5">Manage your .dash names and DashPay contacts.</Text>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {state.identities.length > 0 && (
            <div className="flex min-w-48 flex-col gap-2">
              <label htmlFor="dashpay-demo-identity"><Text size={12} color="brand" opacity={50}>Active demo identity</Text></label>
              <DropdownField
                id="dashpay-demo-identity"
                ariaLabel="Active demo identity"
                value={state.selectedIdentityId}
                disabled={unavailable}
                onChange={selectIdentity}
                options={state.identities.map((item) => ({ value: item.id, label: item.label }))}
                triggerClassName="dash-block h-12 rounded-[.875rem] px-4"
              />
            </div>
          )}
          <Button
            size="sm"
            disabled={unavailable}
            onClick={() => identity ? setRegisterOpen(true) : setJoinOpen(true)}
            className="gap-2 self-end"
          >
            <PlusIcon size={12} color="currentColor" /> {identity ? 'Create username' : 'Join DashPay'}
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[.875rem] dash-block px-4 py-2.5">
        <div className="flex items-center gap-3">
          <DemoBadge tone="blue">Demo</DemoBadge>
          <Text reset as="p" size={12} color="brand" opacity={50}>Sample data. All actions stay in this preview.</Text>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="dashpay-preview-scenario"><Text size={12} color="brand" opacity={50}>Scenario</Text></label>
          <div className="min-w-44">
            <DropdownField
              id="dashpay-preview-scenario"
              ariaLabel="Preview scenario"
              value={state.scenario}
              onChange={(value) => changeScenario(value as DashpayScenario)}
              options={DASHPAY_SCENARIOS}
              textSize={12}
              triggerClassName="h-9 rounded-xl border border-dash-primary-dark-blue/10 bg-white/60 px-3 dark:border-white/12 dark:bg-white/5"
            />
          </div>
          <Button size="xs" colorScheme="primary-light" onClick={() => changeScenario('ready')}>Reset demo</Button>
        </div>
      </div>

      <section className="dash-card-base rounded-3xl p-[.9375rem] shadow-[8px_0_64px_0_rgba(12,28,51,0.08)]">
        <Tabs
          items={tabItems}
          value={tab}
          onValueChange={(value) => {
            if (value === 'overview' || value === 'names' || value === 'contacts') changeTab(value)
          }}
          size="xl"
          triggerClassName={DEMO_TABS_TRIGGER_CLASS}
        />
      </section>

      {joinOpen && <DemoModal title="Your DashPay starts here" description="First, give your names and contacts a home." onClose={() => setJoinOpen(false)}>
        <ProgressStepBar currentStep={1} totalSteps={2} color="blue-mint" className="mb-6" />
        <DemoCard>
          <Text reset as="h3" size={16} weight="medium" color="brand">Create your identity</Text>
          <Text reset as="p" size={14} color="brand" opacity={50} className="mt-2 leading-6">Your identity connects your .dash usernames and your DashPay contacts. You can manage more than one identity in your wallet.</Text>
        </DemoCard>
        <div className="mt-4"><DemoNotice>This preview creates a sample identity with demo credits. No funds are used.</DemoNotice></div>
        <Button size="sm" className="mt-6 w-full" onClick={() => {
          createIdentity()
          setJoinOpen(false)
          setRegisterOpen(true)
        }}>Continue to username</Button>
      </DemoModal>}
      {registerOpen && identity && <RegisterNameModal key={identity.id} onClose={() => setRegisterOpen(false)} onRegistered={() => changeTab('names')} />}
    </div>
  )
}
