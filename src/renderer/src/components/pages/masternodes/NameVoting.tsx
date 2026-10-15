import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button, Input, SearchIcon, Text } from '@renderer/components/dash-ui-kit-enxtended'
import Checkbox from '@renderer/components/ui/Checkbox'
import HashField from '@renderer/components/ui/HashField'
import SegmentedControl from '@renderer/components/ui/SegmentedControl'
import { DemoAvatar, DemoBadge, DemoCard, DemoEmptyState, DemoModal, DemoNotice } from '../dashpay/shared'
import { MASTERNODE_CANDIDATE_SEARCH_THRESHOLD, MASTERNODE_CONTEST_COLUMNS, MASTERNODE_CONTEST_FILTERS, MASTERNODE_CONTEST_PAGE_SIZE, MASTERNODE_DEMO_CONTESTS } from '@renderer/constants/masternodesDemo'
import type { DemoVoteSession, MasternodeContestFilter, MasternodeVoteChoice, MasternodeVotingProps } from '@renderer/types/masternodesDemo'
import { applySuccessfulDemoVotes, canMasternodeVote, demoContestVoteSummary, demoVoteChoiceLabel, getDemoContestPage, searchDemoContenders, simulateMasternodeVotes } from '@renderer/utils/masternodesDemo'

export default function NameVoting({ nodes, votes, onVotes, onConnect }: MasternodeVotingProps): React.JSX.Element {
  const [params, setParams] = useSearchParams()
  const contestId = params.get('contest')
  const [choice, setChoice] = useState<MasternodeVoteChoice>('')
  const [candidateQuery, setCandidateQuery] = useState('')
  const [session, setSession] = useState<DemoVoteSession | null>(null)
  const selectedContest = MASTERNODE_DEMO_CONTESTS.find((item) => item.id === contestId)
  const contest = selectedContest ?? MASTERNODE_DEMO_CONTESTS[0]
  const query = params.get('q') ?? ''
  const status: MasternodeContestFilter = MASTERNODE_CONTEST_FILTERS.find((filter) => filter.value === params.get('status'))?.value ?? 'all'
  const list = getDemoContestPage(MASTERNODE_DEMO_CONTESTS, query, status, Number(params.get('page') ?? 1), MASTERNODE_CONTEST_PAGE_SIZE)
  const eligibleNodes = nodes.filter(canMasternodeVote)
  const visibleContenders = searchDemoContenders(contest.contenders, candidateQuery)
  const contestVotes = votes.filter((vote) => vote.contestId === contest.id)
  const sessionContest = session ? MASTERNODE_DEMO_CONTESTS.find((item) => item.id === session.contestId) : undefined
  const sessionContender = sessionContest?.contenders.find((item) => item.id === session?.choice)
  const failedResults = session?.results.filter((result) => !result.success) ?? []

  useEffect(() => {
    setChoice('')
    setCandidateQuery('')
    setSession(null)
  }, [contestId])

  function updateList(key: string, value: string): void {
    setParams((current) => {
      const updated = new URLSearchParams(current)
      if (value) updated.set(key, value)
      else updated.delete(key)
      if (key !== 'page') updated.delete('page')
      return updated
    }, { replace: true })
  }

  function openContest(id: string | null): void {
    setParams((current) => {
      const updated = new URLSearchParams(current)
      if (id) updated.set('contest', id)
      else updated.delete('contest')
      return updated
    })
  }

  function submit(retry: boolean): void {
    if (!session || (!retry && session.nodeIds.length === 0)) return
    const nodeIds = retry ? failedResults.map((result) => result.nodeId) : session.nodeIds
    const results = simulateMasternodeVotes(nodes, nodeIds, retry)
    onVotes(applySuccessfulDemoVotes(votes, session.contestId, session.choice, results))
    setSession({ ...session, results: retry ? session.results.map((result) => results.find((next) => next.nodeId === result.nodeId) ?? result) : results })
  }

  return (
    <>
      {!selectedContest ? (
        <DemoCard>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Text as="h2" reset size={20} weight="bold" color="brand">Contested names</Text>
              <Text as="p" reset size={12} color="brand" opacity={50} className="mt-2 leading-relaxed">Browse name requests and vote with your masternodes. No personal DashPay name required.</Text>
            </div>
            <DemoBadge tone={eligibleNodes.length ? 'mint' : 'neutral'}>{eligibleNodes.length} voting nodes ready</DemoBadge>
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <div className="w-full sm:max-w-80">
              <Input
                type="search"
                aria-label="Search contested names"
                value={query}
                onChange={(event) => updateList('q', event.target.value)}
                placeholder="Search a name"
                prefix={<SearchIcon size={16} color="currentColor" />}
                colorScheme="light"
                variant="filled"
                size="md"
                className="h-11 rounded-xl!"
              />
            </div>
            <SegmentedControl options={MASTERNODE_CONTEST_FILTERS} value={status} onChange={(next) => updateList('status', next)} className="flex-wrap" />
          </div>
          {list.total === 0 ? <DemoEmptyState title="No matching names" description="Try another name or change the status filter." /> : (
            <>
              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-180 border-collapse text-left">
                  <caption className="sr-only">Contested DashPay names. Sample contests and illustrative vote counts.</caption>
                  <thead>
                    <tr className="border-b border-dash-primary-dark-blue/10 dark:border-white/10">
                      {MASTERNODE_CONTEST_COLUMNS.map((heading) => (
                        <th key={heading} scope="col" className="px-3 pb-3 text-xs font-medium dash-text-default opacity-50 first:pl-0 last:pr-0">{heading || <span className="sr-only">Actions</span>}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {list.items.map((item) => (
                      <tr key={item.id} className="border-b border-dash-primary-dark-blue/7 transition-colors hover:bg-dash-primary-dark-blue/3 dark:border-white/8 dark:hover:bg-white/3">
                        <th scope="row" className="py-5 pr-3 font-medium"><Text size={14} weight="bold" color="brand">{item.name}<span className="font-normal opacity-40">.dash</span></Text></th>
                        <td className="px-3 py-5"><DemoBadge tone={item.state === 'open' ? 'mint' : 'neutral'}>{item.state === 'open' ? 'Open' : item.state === 'locked' ? 'Locked' : 'Ended'}</DemoBadge></td>
                        <td className="px-3 py-5"><Text size={12} color="brand" opacity={60}>{item.contenders.length}</Text></td>
                        <td className="px-3 py-5"><Text size={12} color="brand" opacity={60}>{item.state === 'open' ? item.duration.replace('Illustrative: ', '') : 'Closed'}</Text></td>
                        <td className="px-3 py-5"><Text size={12} color="brand" opacity={60}>{demoContestVoteSummary(item, votes, nodes)}</Text></td>
                        <td className="py-5 pl-3 text-right"><Button size="xs" colorScheme="primary-light" aria-label={`View ${item.name}.dash contest`} onClick={() => openContest(item.id)}>View</Button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                <Text size={12} color="brand" opacity={50} aria-live="polite">{(list.page - 1) * MASTERNODE_CONTEST_PAGE_SIZE + 1}–{Math.min(list.page * MASTERNODE_CONTEST_PAGE_SIZE, list.total)} of {list.total} names</Text>
                <nav aria-label="Contested names pages" className="flex items-center gap-3">
                  <Button size="xs" colorScheme="primary-light" disabled={list.page === 1} onClick={() => updateList('page', String(list.page - 1))}>Previous</Button>
                  <Text size={12} color="brand" opacity={60}>Page {list.page} of {list.pageCount}</Text>
                  <Button size="xs" colorScheme="primary-light" disabled={list.page === list.pageCount} onClick={() => updateList('page', String(list.page + 1))}>Next</Button>
                </nav>
              </div>
            </>
          )}
          <Text as="p" reset size={10} color="brand" opacity={40} className="mt-5">Sample contests and illustrative deadlines. Votes are kept only for this visit.</Text>
        </DemoCard>
      ) : (
        <div className="space-y-5">
          <div><Button size="xs" colorScheme="primary-light" onClick={() => openContest(null)}>← All contested names</Button></div>
          <DemoCard>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <Text as="h2" reset size={24} weight="bold" color="brand" className="tracking-tight">{contest.name}<span className="font-normal opacity-35">.dash</span></Text>
                <Text as="p" reset size={12} color="brand" opacity={50} className="mt-2">{contest.duration} · {contest.contenders.length} contenders</Text>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <DemoBadge tone={contest.state === 'open' ? 'mint' : 'neutral'}>{contest.state === 'open' ? 'Voting open' : contest.state === 'locked' ? 'Name locked' : 'Contest ended'}</DemoBadge>
                {contest.state === 'open' && (eligibleNodes.length > 0 ? (
                  <Button size="sm" disabled={!choice} onClick={() => setSession({ contestId: contest.id, choice, nodeIds: eligibleNodes.map((node) => node.id), results: [] })}>Review vote</Button>
                ) : <Button size="sm" onClick={onConnect}>Connect voting nodes</Button>)}
              </div>
            </div>
            {contest.state !== 'open' && <div className="mt-5"><DemoNotice tone="neutral">{contest.state === 'locked' ? 'Voters locked this name. No further votes can be cast in this sample contest.' : 'Voting has ended. Results are available for review; votes can no longer be changed.'}</DemoNotice></div>}
            <fieldset className="mt-6 min-w-0">
              <legend><Text size={14} weight="bold" color="brand">{contest.state === 'open' ? 'Choose a candidate' : 'Final sample results'}</Text></legend>
              <Text as="p" reset size={12} color="brand" opacity={50} className="mt-2">Compare the identities requesting this name. Selecting a row does not cast a vote.</Text>
              {contest.contenders.length > MASTERNODE_CANDIDATE_SEARCH_THRESHOLD && (
                <div className="mt-4">
                  <Input type="search" aria-label="Search candidates" value={candidateQuery} onChange={(event) => setCandidateQuery(event.target.value)} placeholder="Search candidate or identity" prefix={<SearchIcon size={16} color="currentColor" />} colorScheme="light" variant="filled" size="md" className="h-11 rounded-xl!" />
                </div>
              )}
              <div className="mt-4 grid grid-cols-[minmax(0,1fr)_5rem] items-center gap-4 border-b border-dash-primary-dark-blue/10 px-3 pb-3 text-xs dash-text-default opacity-50 dark:border-white/10 md:grid-cols-[minmax(0,1fr)_7rem_5rem]">
                <span>Candidate · {visibleContenders.length}</span>
                <span className="hidden md:block">Request</span>
                <span className="text-right">Votes</span>
              </div>
              <div className="max-h-80 overflow-y-auto scrollbar-custom">
                {visibleContenders.map((contender) => (
                  <label key={contender.id} className={`grid grid-cols-[minmax(0,1fr)_5rem] items-center gap-4 rounded-xl px-3 py-3 transition-colors md:grid-cols-[minmax(0,1fr)_7rem_5rem] ${contest.state === 'open' ? 'cursor-pointer hover:dash-block-accent-5' : ''} ${choice === contender.id ? 'dash-block-accent-10' : ''}`}>
                    <span className="flex min-w-0 items-center gap-3">
                      {contest.state === 'open' && <input type="radio" name="name-vote-choice" value={contender.id} checked={choice === contender.id} onChange={() => setChoice(contender.id)} className="size-4 shrink-0 accent-dash-brand dark:accent-dash-mint" />}
                      <DemoAvatar label={contender.identity} />
                      <span className="min-w-0">
                        <Text as="span" reset size={14} weight="medium" color="brand" className="block">{contender.label}</Text>
                        <span title={contender.identity} className="mt-1 block truncate font-mono text-xs dash-text-default opacity-50">{contender.identity}</span>
                      </span>
                    </span>
                    <span className="hidden text-xs dash-text-default opacity-50 md:block">{contender.requested}</span>
                    <Text as="span" reset size={14} weight="medium" color="brand" className="text-right">{contender.votes + contestVotes.filter((vote) => vote.choice === contender.id).length}</Text>
                  </label>
                ))}
                {visibleContenders.length === 0 && <DemoEmptyState title="No matching candidates" description="Search another identity or clear the search field." />}
              </div>
            </fieldset>
            <div className="mt-5 border-t border-dash-primary-dark-blue/8 pt-4 dark:border-white/10">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Text size={12} color="brand" opacity={50}>Other voting options</Text>
                <Text size={12} color="brand" opacity={50}>{contest.abstain + contestVotes.filter((vote) => vote.choice === 'abstain').length} abstain · {contest.lock + contestVotes.filter((vote) => vote.choice === 'lock').length} lock</Text>
              </div>
              {contest.state === 'open' && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="xs" colorScheme={choice === 'abstain' ? 'primary' : 'primary-light'} aria-pressed={choice === 'abstain'} onClick={() => setChoice('abstain')}>Abstain</Button>
                  <Button size="xs" colorScheme={choice === 'lock' ? 'primary' : 'primary-light'} aria-pressed={choice === 'lock'} onClick={() => setChoice('lock')}>Lock name</Button>
                </div>
              )}
            </div>
            {contest.state === 'open' && choice && <Text as="p" reset size={12} color="blue-mint" className="mt-4">Selected: {demoVoteChoiceLabel(contest, choice)}. {choice === 'lock' ? 'Keep this name unassigned.' : choice === 'abstain' ? 'Participate without supporting a candidate.' : 'Review this identity and choose voting nodes before confirming.'}</Text>}
          </DemoCard>
        </div>
      )}
      {session && sessionContest && (
        <DemoModal title={session.results.length ? 'Voting results' : 'Review your vote'} description={`${sessionContest.name}.dash · ${demoVoteChoiceLabel(sessionContest, session.choice)}`} onClose={() => setSession(null)}>
          {session.results.length === 0 ? (
            <>
              <DemoCard>
                <Text as="p" reset size={12} color="brand" opacity={50}>Your choice</Text>
                <Text as="p" reset size={18} weight="medium" color="brand" className="mt-2">{demoVoteChoiceLabel(sessionContest, session.choice)}</Text>
                {sessionContender ? (
                  <div className="mt-4"><HashField hash={sessionContender.identity} label="Candidate identity" /></div>
                ) : <Text as="p" reset size={12} color="brand" opacity={50} className="mt-2">{session.choice === 'lock' ? 'Keep this name unassigned.' : 'Participate without supporting a candidate.'}</Text>}
              </DemoCard>
              <fieldset className="mt-5">
                <legend><Text size={14} weight="medium" color="brand">Voting nodes</Text></legend>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                  <Text size={12} color="brand" opacity={50}>Each selected node casts one vote.</Text>
                  {eligibleNodes.length > 1 && (
                    <Button size="xs" colorScheme="primary-light" onClick={() => setSession((current) => current ? { ...current, nodeIds: current.nodeIds.length === eligibleNodes.length ? [] : eligibleNodes.map((node) => node.id) } : current)}>
                      {session.nodeIds.length === eligibleNodes.length ? 'Deselect all' : 'Select all'}
                    </Button>
                  )}
                </div>
                <div className="mt-3 max-h-60 overflow-y-auto divide-y divide-dash-primary-dark-blue/8 dark:divide-white/10">
                  {eligibleNodes.map((node) => {
                    const previous = votes.find((vote) => vote.contestId === session.contestId && vote.nodeId === node.id)
                    return (
                      <Checkbox key={node.id} className="py-3" checked={session.nodeIds.includes(node.id)}
                        onChange={(checked) => setSession((current) => current ? { ...current, nodeIds: checked ? [...current.nodeIds, node.id] : current.nodeIds.filter((id) => id !== node.id) } : current)}
                        label={
                          <span className="min-w-0 flex-1">
                            <Text as="span" reset size={14} weight="medium" color="brand" className="block">{node.label}</Text>
                            <Text as="span" reset size={12} color="brand" opacity={50} className="mt-1 block">{previous ? `${demoVoteChoiceLabel(sessionContest, previous.choice)} → ${demoVoteChoiceLabel(sessionContest, session.choice)}` : 'No previous vote'}</Text>
                          </span>
                        }
                      />
                    )
                  })}
                </div>
              </fieldset>
              <div className="mt-4"><DemoNotice>Confirming replaces the selected nodes' previous votes for this name. This preview sends no network transaction.</DemoNotice></div>
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                <Text size={12} color="brand" opacity={50} className="shrink-0">{session.nodeIds.length} {session.nodeIds.length === 1 ? 'node' : 'nodes'} selected · No fee in demo</Text>
                <div className="flex items-center gap-2">
                  <Button size="xs" colorScheme="primary-light" onClick={() => setSession(null)}>Back</Button>
                  <Button size="sm" disabled={session.nodeIds.length === 0} onClick={() => submit(false)}>Cast demo {session.nodeIds.length === 1 ? 'vote' : 'votes'}</Button>
                </div>
              </div>
            </>
          ) : (
            <>
              <DemoNotice tone={failedResults.length ? 'amber' : 'mint'}>{session.results.filter((result) => result.success).length} of {session.results.length} votes recorded.{failedResults.length > 0 ? ' Successful votes are kept. Retry sends only the failed votes.' : ' You can change these votes while this sample contest is open.'}</DemoNotice>
              <div className="mt-5 space-y-3" aria-live="polite">
                {session.results.map((result) => (
                  <div key={result.nodeId} className="rounded-xl border border-dash-primary-dark-blue/10 p-3 dark:border-white/10">
                    <div className="flex items-center justify-between gap-3">
                      <Text size={14} weight="medium" color="brand">{nodes.find((node) => node.id === result.nodeId)?.label ?? 'Disconnected node'}</Text>
                      <DemoBadge tone={result.success ? 'mint' : 'red'}>{result.success ? 'Recorded' : 'Failed'}</DemoBadge>
                    </div>
                    <Text as="p" reset size={12} color="brand" opacity={50} className="mt-2">{result.message}</Text>
                  </div>
                ))}
              </div>
              <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
                <Button size={failedResults.length ? 'xs' : 'sm'} colorScheme={failedResults.length ? 'primary-light' : 'primary'} onClick={() => setSession(null)}>Done</Button>
                {failedResults.length > 0 && <Button size="sm" onClick={() => submit(true)}>Retry {failedResults.length} failed {failedResults.length === 1 ? 'vote' : 'votes'}</Button>}
              </div>
            </>
          )}
        </DemoModal>
      )}
    </>
  )
}
