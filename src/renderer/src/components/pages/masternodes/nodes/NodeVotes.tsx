import { useMemo, useState } from 'react'
import { Text } from '@renderer/components/dash-ui-kit-extended'
import { ChevronIcon } from '@renderer/components/dash-ui-kit-extended/icons'
import CustomBadge from '@renderer/components/ui/CustomBadge'
import NoResults from '@renderer/components/ui/NoResults'
import ShowMoreButton from '@renderer/components/ui/ShowMoreButton'
import DashboardHeading from '@renderer/components/pages/dashboard/DashboardHeading'
import { NODE_VOTE_ROW_CLASS, NODE_VOTE_ROW_GRID, NODE_VOTES_COPY } from '@renderer/constants/masternodeNodes'
import { NODE_VOTES_PAGE_SIZE, VOTE_CHOICE_LABELS, VOTES_PER_NODE_PER_POLL } from '@renderer/constants/masternodes'
import { SURFACE_PANEL } from '@renderer/constants/surfaces'
import { DPNS_NAME_SUFFIX } from '@renderer/constants/dpns'
import { useScrollEndSentinel } from '@renderer/hooks/useScrollEndSentinel'
import { formatCreationDate } from '@renderer/utils/date'
import { windowList } from '@renderer/utils/listWindow'
import { voteChoiceLabel } from '@renderer/utils/nameContests'
import type { NodeVoteRowProps, NodeVotesProps } from '@renderer/types/MasternodeNodes'

function NodeVoteRow({ vote, contest, onOpen }: NodeVoteRowProps): React.JSX.Element {
  const choice = contest == null ? VOTE_CHOICE_LABELS[vote.choice.kind] : voteChoiceLabel(vote.choice, contest)
  return (
    <button type={'button'} onClick={() => onOpen(vote.normalizedLabel)} className={`${NODE_VOTE_ROW_CLASS} ${NODE_VOTE_ROW_GRID}`}>
      <Text size={14} weight={'medium'} color={'brand'} className={'truncate'}>
        {`${contest?.label ?? vote.normalizedLabel}${DPNS_NAME_SUFFIX}`}
      </Text>
      <div className={'flex min-w-0'}>
        <CustomBadge text={choice} className={'max-w-full wrap-anywhere'} />
      </div>
      <Text size={12} weight={'medium'} color={'brand'} opacity={50} className={'truncate'}>
        {`${vote.votesUsed} ${NODE_VOTES_COPY.of} ${VOTES_PER_NODE_PER_POLL} ${NODE_VOTES_COPY.votesUsed}`}
      </Text>
      <Text size={12} weight={'medium'} color={'brand'} opacity={50} className={'justify-self-end whitespace-nowrap'}>
        {formatCreationDate(new Date(vote.castAt))}
      </Text>
      <ChevronIcon size={12} color={'currentColor'} className={'-rotate-90 justify-self-end dash-text-default opacity-50'} />
    </button>
  )
}

export default function NodeVotes({ votes, contests, onOpenContest }: NodeVotesProps): React.JSX.Element {
  const [visibleCount, setVisibleCount] = useState(NODE_VOTES_PAGE_SIZE)
  const contestsByLabel = useMemo(() => new Map(contests.map(contest => [contest.normalizedLabel, contest])), [contests])
  const view = useMemo(() => windowList(votes, visibleCount), [votes, visibleCount])
  const showMore = (): void => setVisibleCount(count => count + NODE_VOTES_PAGE_SIZE)
  const sentinelRef = useScrollEndSentinel(view.hasMore, showMore, visibleCount)

  return (
    <section className={`flex flex-col gap-4 ${SURFACE_PANEL}`} aria-label={NODE_VOTES_COPY.title}>
      <div className={'flex items-center gap-2 px-1 pt-1'}>
        <DashboardHeading>{NODE_VOTES_COPY.title}</DashboardHeading>
        <CustomBadge variant={'muted'} text={String(votes.length)} />
      </div>
      {votes.length === 0 ? (
        <NoResults noResults={NODE_VOTES_COPY.empty} />
      ) : (
        <div className={'flex flex-col gap-[.625rem]'}>
          {view.items.map(vote => (
            <NodeVoteRow
              key={vote.normalizedLabel}
              vote={vote}
              contest={contestsByLabel.get(vote.normalizedLabel)}
              onOpen={onOpenContest}
            />
          ))}
          {view.hasMore && <ShowMoreButton ref={sentinelRef} remaining={view.remaining} onClick={showMore} />}
        </div>
      )}
    </section>
  )
}
