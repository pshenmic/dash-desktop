import { useMemo } from 'react'
import { Text } from '@renderer/components/dash-ui-kit-extended'
import {
  COUNT_NOUNS,
  SUMMARY_CELL_CLASS,
  SUMMARY_COPY,
  SUMMARY_LINK_CLASS,
  SUMMARY_SKELETON_CLASS,
  SUMMARY_STRIP_CLASS,
  MASTERNODES_PAGE_COPY,
  NO_WALLET_IDENTIFIERS,
} from '@renderer/constants/masternodeNodes'
import { ContestSegment, NodeSegment } from '@renderer/enums/Masternodes'
import { countLabel } from '@renderer/utils/countLabel'
import { countNodeSegments, votingPower } from '@renderer/utils/masternodes'
import { votingPowerBreakdown } from '@renderer/utils/masternodeNodes'
import { countContestSegments } from '@renderer/utils/nameContests'
import type { SummaryCellProps, SummaryLinkProps, SummaryStripProps } from '@renderer/types/MasternodeNodes'

function SummaryCell({ label, value, children }: SummaryCellProps): React.JSX.Element {
  return (
    <div className={SUMMARY_CELL_CLASS}>
      <Text size={12} weight={'medium'} color={'brand'} opacity={50}>{label}</Text>
      <Text size={20} weight={'extrabold'} color={'brand'} className={'leading-[140%] tabular-nums'}>{value}</Text>
      <Text reset as={'div'} size={12} weight={'medium'} color={'brand'} className={'flex min-w-0 flex-wrap items-center gap-x-1'}>
        {children}
      </Text>
    </div>
  )
}

function SummaryLink({ onClick, children }: SummaryLinkProps): React.JSX.Element {
  return (
    <button type={'button'} onClick={onClick} className={SUMMARY_LINK_CLASS}>
      <Text size={12} weight={'medium'} color={'blue-mint'}>{children}</Text>
    </button>
  )
}

function Separator(): React.JSX.Element {
  return <span className={'opacity-50'}>{SUMMARY_COPY.dot}</span>
}

export default function SummaryStrip({
  nodes,
  contests,
  votes,
  loading,
  network,
  now,
  onSelectNodes,
  onSelectContests,
  onAddNode,
}: SummaryStripProps): React.JSX.Element {
  const nodeCounts = useMemo(() => countNodeSegments(nodes, ''), [nodes])
  const power = useMemo(() => votingPower(nodes), [nodes])
  const contestCounts = useMemo(
    () => countContestSegments(contests, { query: '', yourNamesOnly: false }, { nodes, votes, walletIdentifiers: NO_WALLET_IDENTIFIERS, now, network }),
    [contests, nodes, votes, now, network],
  )

  if (loading) {
    return (
      <div className={SUMMARY_STRIP_CLASS} aria-busy={true}>
        <div className={SUMMARY_SKELETON_CLASS} />
        <div className={SUMMARY_SKELETON_CLASS} />
        <div className={SUMMARY_SKELETON_CLASS} />
      </div>
    )
  }

  const hasNodes = nodes.length > 0
  const notVoted = contestCounts.segments[ContestSegment.NotVoted]
  const endingSoon = contestCounts.segments[ContestSegment.EndingSoon]
  const breakdown = votingPowerBreakdown(power)

  return (
    <div className={SUMMARY_STRIP_CLASS}>
      <SummaryCell label={SUMMARY_COPY.nodes} value={nodes.length}>
        {hasNodes ? (
          <>
            <SummaryLink onClick={() => onSelectNodes(NodeSegment.CanVote)}>
              {`${nodeCounts[NodeSegment.CanVote]} ${SUMMARY_COPY.canVote}`}
            </SummaryLink>
            <Separator />
            <SummaryLink onClick={() => onSelectNodes(NodeSegment.WatchOnly)}>
              {`${nodeCounts[NodeSegment.WatchOnly]} ${SUMMARY_COPY.watchOnly}`}
            </SummaryLink>
          </>
        ) : (
          <SummaryLink onClick={onAddNode}>{MASTERNODES_PAGE_COPY.addNode}</SummaryLink>
        )}
      </SummaryCell>
      <SummaryCell label={SUMMARY_COPY.votingPower} value={countLabel(power.votes, COUNT_NOUNS.vote)}>
        <span className={'truncate opacity-50'}>{breakdown === '' ? SUMMARY_COPY.addVotingKey : breakdown}</span>
      </SummaryCell>
      <SummaryCell label={SUMMARY_COPY.openContests} value={contestCounts.segments[ContestSegment.Open]}>
        {hasNodes && (
          <>
            <SummaryLink onClick={() => onSelectContests(ContestSegment.NotVoted)}>
              {`${notVoted} ${SUMMARY_COPY.notVoted}`}
            </SummaryLink>
            <Separator />
          </>
        )}
        <SummaryLink onClick={() => onSelectContests(ContestSegment.EndingSoon)}>
          {`${endingSoon} ${SUMMARY_COPY.endingSoon}`}
        </SummaryLink>
      </SummaryCell>
    </div>
  )
}
