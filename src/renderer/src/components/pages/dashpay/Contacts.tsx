import { useState } from 'react'
import { ValueCard } from 'dash-ui-kit/react'
import { Button, Input, PlusIcon, SearchIcon, Text } from '@renderer/components/dash-ui-kit-enxtended'
import SegmentedControl from '@renderer/components/ui/SegmentedControl'
import { DASHPAY_IDENTITIES } from '@renderer/constants/dashpayDemo'
import { DASHPAY_CONTACT_PRESENTATION, DASHPAY_CONTACT_TABS } from '@renderer/constants/dashpayContacts'
import { useDashpayDemo } from '@renderer/contexts/DashpayDemoContext'
import type { DashpayContactRowProps } from '@renderer/types/dashpayContacts'
import type { DashpayContactStatus, DashpayPerson } from '@renderer/types/dashpayDemo'
import { getDemoContactStatus, getDemoIdentityContacts, searchDemoPeople } from '@renderer/utils/dashpayDemo'
import PersonModal from './PersonModal'
import { DemoAvatar, DemoBadge, DemoCard, DemoEmptyState, DemoModal, DemoNotice } from './shared'

function ContactRow({ person, status, owned, onOpen, onAccept, onIgnore }: DashpayContactRowProps): React.JSX.Element {
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-2xl bg-dash-primary-dark-blue/4 p-2 dark:bg-white/4 sm:gap-4">
      <ValueCard
        as="button" type="button" clickable border={false} colorScheme="transparent" size="sm"
        onClick={onOpen}
        aria-label={`View ${person.displayName}'s profile`}
        className="min-w-0 flex-1 gap-3 !bg-transparent hover:!bg-dash-primary-dark-blue/6 dark:!bg-transparent dark:hover:!bg-white/8 text-left sm:gap-4"
      >
        <DemoAvatar label={person.displayName} />
        <span className="min-w-0 flex-1">
          <Text as="span" reset size={14} weight="medium" color="brand" className="block truncate">{person.displayName}</Text>
          <Text as="span" reset size={12} color="brand" opacity={50} className="mt-1 block truncate">@{person.username}</Text>
        </span>
        <Text size={14} color="brand" opacity={40} aria-hidden="true">↗</Text>
      </ValueCard>
      <div className="flex flex-wrap items-center gap-2">
        {owned ? <DemoBadge>Your identity</DemoBadge> : status && <DemoBadge tone={DASHPAY_CONTACT_PRESENTATION[status].tone}>{DASHPAY_CONTACT_PRESENTATION[status].label}</DemoBadge>}
        {onAccept && <Button type="button" size="xs" colorScheme="lightBlue-mint" aria-label={`Accept request from ${person.displayName}`} onClick={onAccept}>Accept</Button>}
        {onIgnore && <Button type="button" size="xs" colorScheme="primary-light" aria-label={`Ignore request from ${person.displayName}`} onClick={onIgnore}>Ignore</Button>}
      </div>
    </li>
  )
}

export default function Contacts(): React.JSX.Element {
  const { state, identity, acceptRequest, ignoreRequest } = useDashpayDemo()
  const [tab, setTab] = useState<DashpayContactStatus>('contact')
  const [query, setQuery] = useState('')
  const [directoryQuery, setDirectoryQuery] = useState('')
  const [directoryOpen, setDirectoryOpen] = useState(false)
  const [selectedPerson, setSelectedPerson] = useState<DashpayPerson | null>(null)
  const [feedback, setFeedback] = useState('')
  const contacts = getDemoIdentityContacts(state)
  const activeTab = DASHPAY_CONTACT_TABS.find((item) => item.status === tab)!
  const people = searchDemoPeople(query, state).filter((person) => contacts.some((contact) => contact.personId === person.id && contact.status === tab))
  const directoryPeople = searchDemoPeople(directoryQuery, state)

  return (
    <div className="space-y-5">
      <DemoCard>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <Text as="h2" reset size={18} weight="medium" color="brand">Your DashPay contacts</Text>
            <Text as="p" reset size={12} color="brand" opacity={50} className="mt-1 leading-relaxed">Manage connections and requests for this identity.</Text>
          </div>
          <Button type="button" size="xs" colorScheme="lightBlue-mint" className="gap-2" onClick={() => setDirectoryOpen(true)}>
            <PlusIcon size={12} color="currentColor" /> Find people
          </Button>
        </div>

        <div className="overflow-x-auto border-t border-dash-primary-dark-blue/8 pt-5 dark:border-white/8" aria-label="Contact lists">
          <SegmentedControl
            options={DASHPAY_CONTACT_TABS.map((item) => ({ value: item.status, label: `${item.label} (${contacts.filter((contact) => contact.status === item.status).length})` }))}
            value={tab}
            onChange={(value) => { setTab(value); setFeedback('') }}
          />
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <Text as="h3" reset size={16} weight="medium" color="brand">{activeTab.title}</Text>
            <Text as="p" reset size={12} color="brand" opacity={50} className="mt-1 leading-relaxed">{activeTab.description}</Text>
          </div>
          <div className="w-full sm:max-w-64">
            <label className="sr-only" htmlFor="dashpay-contact-search">Search your contacts</label>
            <Input
              id="dashpay-contact-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search contacts"
              prefix={<SearchIcon size={16} color="currentColor" className="dash-text-default" />}
              colorScheme="light"
              variant="filled"
              size="md"
              className="h-11 rounded-xl!"
            />
          </div>
        </div>

        <div role="status" aria-live="polite">
          {feedback && <Text reset as="p" size={12} weight="medium" color="brand" className="mt-4">{feedback}</Text>}
        </div>
        {!identity ? (
          <DemoEmptyState
            title="An identity brings your people together"
            description="Choose or create a demo identity from the overview to start building your DashPay contacts."
            action={<Button type="button" size="xs" colorScheme="primary-light" onClick={() => setDirectoryOpen(true)}>Explore sample profiles</Button>}
          />
        ) : people.length === 0 ? (
          <DemoEmptyState
            title={query ? 'No matching contacts' : activeTab.emptyTitle}
            description={query ? 'Try a different name, clear the search field, or find someone new in the demo directory.' : activeTab.emptyDescription}
            action={<Button type="button" size="xs" colorScheme="lightBlue-mint" onClick={() => setDirectoryOpen(true)}>Find people</Button>}
          />
        ) : (
          <ul className="mt-5 space-y-3">
            {people.map((person) => (
              <ContactRow
                key={person.id}
                person={person}
                status={tab}
                owned={false}
                onOpen={() => setSelectedPerson(person)}
                onAccept={tab === 'incoming' ? () => {
                  acceptRequest(person.id)
                  setFeedback(`${person.displayName} moved to Established.`)
                } : undefined}
                onIgnore={tab === 'incoming' ? () => {
                  ignoreRequest(person.id)
                  setFeedback(`Request from ${person.displayName} ignored.`)
                } : undefined}
              />
            ))}
          </ul>
        )}
      </DemoCard>

      <DemoNotice tone="neutral">Contacts belong to the selected identity and are separate from your wallet address book. All requests stay in this preview.</DemoNotice>

      {directoryOpen && !selectedPerson && <DemoModal title="Find your people" description="Explore sample DashPay profiles and start a connection." onClose={() => setDirectoryOpen(false)} wide>
        <label htmlFor="dashpay-directory-search" className="mb-2 block"><Text size={12} weight="medium" color="brand" opacity={50}>Search by name or username</Text></label>
        <div>
          <Input
            id="dashpay-directory-search"
            type="search"
            autoFocus
            value={directoryQuery}
            onChange={(event) => setDirectoryQuery(event.target.value)}
            placeholder="Try bob2026 or Carol"
            prefix={<SearchIcon size={16} color="currentColor" className="dash-text-default" />}
            colorScheme="light"
            variant="filled"
            size="md"
            className="h-11 rounded-xl!"
          />
        </div>
        <Text as="p" reset size={12} color="brand" opacity={50} className="mt-3 leading-relaxed">Sample people only. Open a profile to send a request or respond to one.</Text>
        {directoryPeople.length > 0 ? (
          <ul className="mt-5 space-y-3">
            {directoryPeople.map((person) => (
              <ContactRow
                key={person.id}
                person={person}
                status={getDemoContactStatus(state, person.id)}
                owned={DASHPAY_IDENTITIES.some((item) => item.id === person.id)}
                onOpen={() => setSelectedPerson(person)}
              />
            ))}
          </ul>
        ) : (
          <DemoEmptyState title="No one by that name yet" description="Try another name or clear the search field to explore the sample directory." />
        )}
      </DemoModal>}
      {selectedPerson && <PersonModal key={`${state.selectedIdentityId}-${selectedPerson.id}`} person={selectedPerson} onClose={() => setSelectedPerson(null)} />}
    </div>
  )
}
