import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ValueCard } from 'dash-ui-kit/react'
import { Button, Input, SearchIcon, Text } from '@renderer/components/dash-ui-kit-enxtended'
import { DASHPAY_IDENTITIES } from '@renderer/constants/dashpayDemo'
import { DASHPAY_NAME_CONTACT_LABELS, DASHPAY_NAME_STATUS_LABELS, DASHPAY_NAME_STATUS_TONES, DASHPAY_TEXT_BUTTON_CLASS } from '@renderer/constants/dashpayNames'
import { useDashpayDemo } from '@renderer/contexts/DashpayDemoContext'
import type { DashpayNamesProps, DashpayPerson } from '@renderer/types/dashpayDemo'
import { getDemoContactStatus, getDemoIdentityNames, searchDemoPeople } from '@renderer/utils/dashpayDemo'
import PersonModal from './PersonModal'
import RegisterNameModal from './RegisterNameModal'
import { DemoAvatar, DemoBadge, DemoCard, DemoEmptyState, DemoNotice } from './shared'

export default function Names({ initialSearch = '', onContact }: DashpayNamesProps): React.JSX.Element {
  const { state, identity } = useDashpayDemo()
  const [search, setSearch] = useState(initialSearch)
  const [registering, setRegistering] = useState(false)
  const [person, setPerson] = useState<DashpayPerson | null>(null)
  const names = getDemoIdentityNames(state)
  const results = searchDemoPeople(search, state)

  useEffect(() => { setSearch(initialSearch) }, [initialSearch])

  return (
    <div className="grid items-stretch gap-5 xl:grid-cols-2">
      <DemoCard className="flex flex-col">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Text as="h2" reset size={18} weight="medium" color="brand">Your names</Text>
            <Text as="p" reset size={12} color="brand" opacity={50} className="mt-1">A familiar way for people to find you.</Text>
          </div>
          <Button type="button" size="xs" colorScheme="lightBlue-mint" onClick={() => setRegistering(true)}>Register a name</Button>
        </div>
        {names.length > 0 ? (
          <div className="mt-6 flex flex-col divide-y divide-dash-primary-dark-blue/7 dark:divide-white/8">
            {names.map((name) => (
              <div key={name.id} className="py-5 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Text as="p" reset size={16} weight="medium" color="brand" className="min-w-0 break-all">{name.label}<span className="font-normal opacity-35">.dash</span></Text>
                  <DemoBadge tone={DASHPAY_NAME_STATUS_TONES[name.status]}>{DASHPAY_NAME_STATUS_LABELS[name.status]}</DemoBadge>
                </div>
                <Text as="p" reset size={12} color="brand" opacity={50} className="mt-2 leading-relaxed">
                  {name.status === 'registered' && 'Connected to this identity and ready to share.'}
                  {name.status === 'voting' && 'This short name is in a simulated masternode voting period.'}
                  {name.status === 'locked' && 'This name is locked and cannot be registered.'}
                  {name.status === 'lost' && 'This identity was not awarded the name. You can choose another.'}
                </Text>
                {name.status === 'voting' && <Link to="/masternodes?tab=voting" className={`mt-3 inline-block ${DASHPAY_TEXT_BUTTON_CLASS}`}>View masternode voting <span aria-hidden="true">↗</span></Link>}
              </div>
            ))}
          </div>
        ) : (
          <DemoEmptyState title={identity ? 'Make this identity easy to find' : 'Start with an identity'} description={identity ? 'Register your first .dash name, then share it with people you know.' : 'Create a demo identity from the Overview to register your first name.'} />
        )}
        <div className="mt-auto pt-6">
          <DemoNotice tone="neutral">Names belong to the selected identity. Short, alphabetic names may require masternode voting; a submission does not guarantee ownership.</DemoNotice>
        </div>
      </DemoCard>

      <DemoCard className="flex flex-col">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Text as="h2" reset size={18} weight="medium" color="brand">Find people</Text>
            <Text as="p" reset size={12} color="brand" opacity={50} className="mt-1">Search the demo DPNS directory.</Text>
          </div>
          <Button type="button" size="xs" colorScheme="primary-light" onClick={onContact}>Your contacts</Button>
        </div>
        <label htmlFor="dashpay-name-search" className="sr-only">Search people by name</label>
        <div className="mt-5">
          <Input
            id="dashpay-name-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search a name or username"
            prefix={<SearchIcon size={16} color="currentColor" className="dash-text-default" />}
            colorScheme="light"
            variant="filled"
            size="md"
            className="h-11 rounded-xl!"
            autoComplete="off"
          />
        </div>
        <div aria-live="polite" className="mt-4 flex items-center justify-between gap-3">
          <Text size={12} color="brand" opacity={50}>{search.trim() ? `${results.length} ${results.length === 1 ? 'result' : 'results'}` : 'People in the demo directory'}</Text>
        </div>
        {results.length > 0 ? (
          <div className="mt-3 flex flex-col gap-2">
            {results.map((result) => {
              const ownIdentity = DASHPAY_IDENTITIES.some((item) => item.id === result.id)
              const contactStatus = getDemoContactStatus(state, result.id)
              return (
                <ValueCard
                  as="button" type="button" clickable border={false} colorScheme="transparent" size="md"
                  key={result.id}
                  onClick={() => setPerson(result)}
                  className="w-full gap-3 !bg-dash-primary-dark-blue/4 hover:!bg-dash-primary-dark-blue/8 dark:!bg-white/4 dark:hover:!bg-white/8 text-left"
                >
                  <DemoAvatar label={result.displayName} />
                  <span className="min-w-0 flex-1">
                    <Text as="span" reset size={14} weight="medium" color="brand" className="block truncate">{result.displayName}</Text>
                    <Text as="span" reset size={12} color="brand" opacity={50} className="mt-1 block truncate">{result.username}.dash</Text>
                  </span>
                  {ownIdentity ? <DemoBadge>You</DemoBadge> : contactStatus ? <DemoBadge tone={contactStatus === 'contact' ? 'mint' : 'neutral'}>{DASHPAY_NAME_CONTACT_LABELS[contactStatus]}</DemoBadge> : <span aria-hidden="true" className="pr-1 dash-text-default opacity-40">↗</span>}
                </ValueCard>
              )
            })}
          </div>
        ) : (
          <DemoEmptyState title="No people found" description="Try a different name, or clear the search field to browse the demo directory." />
        )}
      </DemoCard>
      {registering && <RegisterNameModal onClose={() => setRegistering(false)} />}
      {person && <PersonModal person={person} onClose={() => setPerson(null)} />}
    </div>
  )
}
