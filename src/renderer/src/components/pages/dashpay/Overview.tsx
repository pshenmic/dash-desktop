import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Identifier, ValueCard } from 'dash-ui-kit/react'
import { Button, Input, SearchIcon, Text } from '@renderer/components/dash-ui-kit-enxtended'
import CopyButton from '@renderer/components/ui/CopyButton'
import { formatCompactCredits } from '@renderer/utils/balance'
import { useDashpayDemo } from '@renderer/contexts/DashpayDemoContext'
import { getDemoIdentityContacts, getDemoIdentityNames, searchDemoPeople } from '@renderer/utils/dashpayDemo'
import type { DashpayOverviewProps, DashpayPerson } from '@renderer/types/dashpayDemo'
import { DemoAvatar, DemoBadge, DemoCard, DemoEmptyState, DemoNotice } from './shared'
import PersonModal from './PersonModal'

export default function Overview({ onRegister, onJoin, onTab, onSearch }: DashpayOverviewProps): React.JSX.Element {
  const { state, identity } = useDashpayDemo()
  const [query, setQuery] = useState('')
  const [person, setPerson] = useState<DashpayPerson | null>(null)
  const names = getDemoIdentityNames(state)
  const registered = names.filter((name) => name.status === 'registered')
  const pending = names.find((name) => name.status === 'voting')
  const contacts = getDemoIdentityContacts(state)
  const established = contacts.filter((contact) => contact.status === 'contact')
  const incoming = contacts.filter((contact) => contact.status === 'incoming')
  const visiblePeople = searchDemoPeople(query, state).filter((item) => established.some((contact) => contact.personId === item.id))

  if (!identity) return (
    <DemoCard>
      <DemoEmptyState
        title="Get started with DashPay"
        description="Create an identity, choose a .dash username, and connect with your contacts."
        action={<Button size="sm" onClick={onJoin}>Join DashPay</Button>}
      />
    </DemoCard>
  )

  return (
    <div className="space-y-5">
      <div className="grid items-stretch gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <DemoCard>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <Text reset as="h2" size={14} weight="medium" color="brand" opacity={50}>Your identity</Text>
            <DemoBadge tone={registered.length ? 'mint' : pending ? 'amber' : 'blue'}>
              {registered.length ? 'Username registered' : pending ? 'Awaiting votes' : 'Choose a username'}
            </DemoBadge>
          </div>
          <div className="flex items-center gap-4">
            <DemoAvatar label={registered[0]?.label ?? identity.label} large />
            <div className="min-w-0">
              <Text reset as="h3" size={24} weight="medium" color="brand" className="break-all tracking-[-.03em]">
                {registered[0] ? `${registered[0].label}.dash` : pending ? `${pending.label}.dash` : 'Choose your username'}
              </Text>
              <Text reset as="p" size={12} color="brand" opacity={50} className="mt-1">{identity.label}</Text>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap items-end justify-between gap-4 border-t border-dash-primary-dark-blue/8 pt-5 dark:border-white/8">
            <div className="min-w-0">
              <Text reset as="p" size={12} color="brand" opacity={50}>Identity ID</Text>
              <div className="mt-2 flex items-center gap-2">
                <Identifier highlight="default" className="font-mono text-xs!">{identity.id}</Identifier>
                <CopyButton text={identity.id} />
              </div>
            </div>
            <div>
              <Text reset as="p" size={12} color="brand" opacity={50}>Demo credit balance</Text>
              <Text reset as="p" size={14} weight="medium" color="brand" className="mt-2">
                {formatCompactCredits(identity.credits)} <span className="font-normal opacity-50">credits</span>
              </Text>
            </div>
          </div>
        </DemoCard>

        <DemoCard className="flex flex-col items-start justify-between gap-6">
          <div>
            <Text reset as="h2" size={18} weight="medium" color="brand">
              {registered.length ? 'Make a connection' : pending ? 'Your name request' : 'Create a username'}
            </Text>
            <Text reset as="p" size={14} color="brand" opacity={50} className="mt-3 leading-6">
              {registered.length ? 'Find someone by their .dash username and send a contact request.' : pending ? 'Your request is in a name contest. Follow its progress while the community votes.' : 'A .dash username makes your identity easier to find. Choose an available name to get started.'}
            </Text>
          </div>
          <Button size="xs" colorScheme="lightBlue-mint" onClick={() => registered.length ? onSearch('') : pending ? onTab('names') : onRegister()}>
            {registered.length ? 'Find people' : pending ? 'View name request' : 'Create username'}
          </Button>
        </DemoCard>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <ValueCard
          as="button" type="button" clickable border={false} colorScheme="transparent" size="xl"
          onClick={() => onTab('names')}
          className="flex-col items-stretch! !bg-dash-control-background hover:!bg-dash-primary-dark-blue/8 dark:!bg-white/4 dark:hover:!bg-white/8 text-left"
        >
          <Text reset as="p" size={12} color="brand" opacity={50}>My names</Text>
          <div className="mt-3 flex items-end justify-between gap-3">
            <Text size={32} weight="medium" color="brand">{names.length}</Text>
            <Text size={12} color="blue-mint">Manage ↗</Text>
          </div>
        </ValueCard>
        <ValueCard
          as="button" type="button" clickable border={false} colorScheme="transparent" size="xl"
          onClick={() => onTab('contacts')}
          className="flex-col items-stretch! !bg-dash-control-background hover:!bg-dash-primary-dark-blue/8 dark:!bg-white/4 dark:hover:!bg-white/8 text-left"
        >
          <Text reset as="p" size={12} color="brand" opacity={50}>Contacts</Text>
          <div className="mt-3 flex items-end justify-between gap-3">
            <Text size={32} weight="medium" color="brand">{established.length}</Text>
            <Text size={12} color="blue-mint">View all ↗</Text>
          </div>
        </ValueCard>
        <ValueCard
          as="button" type="button" clickable border={false} colorScheme="transparent" size="xl"
          onClick={() => onTab('contacts')}
          className="flex-col items-stretch! !bg-dash-control-background hover:!bg-dash-primary-dark-blue/8 dark:!bg-white/4 dark:hover:!bg-white/8 text-left"
        >
          <Text reset as="p" size={12} color="brand" opacity={50}>Incoming requests</Text>
          <div className="mt-3 flex items-end justify-between gap-3">
            <Text size={32} weight="medium" color="brand">{incoming.length}</Text>
            <Text size={12} color={incoming.length ? 'blue-mint' : 'brand'} opacity={incoming.length ? 100 : 50}>
              {incoming.length ? 'Review ↗' : 'All caught up'}
            </Text>
          </div>
        </ValueCard>
      </div>

      {pending && (
        <DemoNotice tone="amber">
          <Text reset as="p" size={12} color="brand">{pending.label}.dash is awaiting a vote. The name becomes yours only if it is awarded to your identity.</Text>
        </DemoNotice>
      )}

      <DemoCard>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Text reset as="h2" size={18} weight="medium" color="brand">Your contacts</Text>
            <Text reset as="p" size={12} color="brand" opacity={50} className="mt-1">Search your contacts, or press Enter to search the directory.</Text>
          </div>
          <Button size="xs" colorScheme="primary-light" onClick={() => onTab('contacts')}>View all contacts</Button>
        </div>
        <form className="mt-5" onSubmit={(event) => { event.preventDefault(); onSearch(query) }}>
          <Input
            aria-label="Search your DashPay contacts"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search a name or username"
            prefix={<SearchIcon size={16} color="currentColor" className="dash-text-default" />}
            colorScheme="light"
            variant="filled"
            size="md"
            className="h-11 rounded-xl!"
          />
        </form>
        {visiblePeople.length ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {visiblePeople.slice(0, 3).map((contactPerson) => (
              <ValueCard
                as="button" type="button" clickable border={false} colorScheme="transparent" size="md"
                key={contactPerson.id}
                onClick={() => setPerson(contactPerson)}
                className="gap-3 !bg-dash-primary-dark-blue/4 hover:!bg-dash-primary-dark-blue/8 dark:!bg-white/4 dark:hover:!bg-white/8 text-left"
              >
                <DemoAvatar label={contactPerson.displayName} />
                <div className="min-w-0 flex-1">
                  <Text reset as="p" size={14} weight="medium" color="brand" className="truncate">{contactPerson.displayName}</Text>
                  <Text reset as="p" size={12} color="brand" opacity={50} className="mt-1 truncate">{contactPerson.username}.dash</Text>
                </div>
                <Text size={14} color="brand" opacity={50}>↗</Text>
              </ValueCard>
            ))}
          </div>
        ) : (
          <DemoEmptyState
            title={query ? 'No matching contacts' : 'Your people, right here'}
            description={query ? 'Try another name, or search the directory to find someone new.' : 'Find a username and send a request to start building your DashPay contacts.'}
            action={<Button size="xs" colorScheme="lightBlue-mint" onClick={() => onSearch(query)}>Find people</Button>}
          />
        )}
      </DemoCard>
      <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-xs dash-text-default">
        <span className="opacity-50">Own a masternode or have delegated voting access?</span>
        <Link to="/masternodes?tab=voting" className="font-medium text-dash-brand hover:underline dark:text-dash-mint">Explore name voting ↗</Link>
      </div>
      {person && <PersonModal person={person} onClose={() => setPerson(null)} />}
    </div>
  )
}
