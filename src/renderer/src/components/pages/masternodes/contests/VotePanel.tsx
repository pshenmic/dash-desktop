import { useMemo, useState } from 'react'
import { Button, Text } from '@renderer/components/dash-ui-kit-extended'
import DashboardHeading from '@renderer/components/pages/dashboard/DashboardHeading'
import CheckRow from '@renderer/components/ui/CheckRow'
import CustomBadge from '@renderer/components/ui/CustomBadge'
import FadingScrollArea from '@renderer/components/ui/FadingScrollArea'
import NoResults from '@renderer/components/ui/NoResults'
import SearchField from '@renderer/components/ui/SearchField'
import { LIST_GROUP_LABEL_CLASS } from '@renderer/constants/listToolbar'
import { MASTERNODE_TYPE_BADGES, NODE_ELIGIBILITY_LABELS, VOTE_NODE_SEARCH_MIN } from '@renderer/constants/masternodes'
import {
  CONTESTS_TAB_COPY,
  PANEL_DIVIDER_CLASS,
  VOTE_NODE_LIST_CLASS,
  VOTE_NODE_SCROLL_CLASS,
  VOTE_PANEL_CLASS,
  VOTE_PANEL_COPY,
} from '@renderer/constants/nameContests'
import { CHIP_ACTION } from '@renderer/constants/surfaces'
import { NodeVoteEligibility } from '@renderer/enums/Masternodes'
import type { VoteNodeRow, VotePanelProps } from '@renderer/types/NameContests'
import {
  currentVoteLine,
  eligibleNodeHashes,
  filterVoteRows,
  hasVotingNode,
  rowsVotingPower,
  selectedVoteRows,
  voteChangeWarningText,
  voteChangeWarnings,
  voteNodeRows,
} from '@renderer/utils/contestVoting'
import { toggledSet } from '@renderer/utils/masternodes'
import { contestVoteSummary } from '@renderer/utils/nameContests'

export default function VotePanel({
  contest,
  now,
  nodes,
  votes,
  choice,
  selected,
  onSelectedChange,
  onReview,
  onAddNode,
}: VotePanelProps): React.JSX.Element {
  const [query, setQuery] = useState('')
  const rows = useMemo(() => voteNodeRows(nodes, votes, contest, choice, now), [nodes, votes, contest, choice, now])
  const chosen = selectedVoteRows(rows, selected)
  const warnings = voteChangeWarnings(chosen)
  const eligible = eligibleNodeHashes(rows)
  const searchable = rows.length > VOTE_NODE_SEARCH_MIN
  const visible = searchable ? filterVoteRows(rows, query) : rows

  if (!hasVotingNode(nodes)) {
    return (
      <div className={VOTE_PANEL_CLASS}>
        <NoResults
          title={VOTE_PANEL_COPY.noVotingTitle}
          description={VOTE_PANEL_COPY.noVotingDescription}
          action={(
            <Button type={'button'} size={'compact'} colorScheme={'primary'} onClick={onAddNode}>
              {CONTESTS_TAB_COPY.addNode}
            </Button>
          )}
        />
      </div>
    )
  }

  const renderRow = (row: VoteNodeRow): React.JSX.Element => {
    const disabled = row.eligibility !== NodeVoteEligibility.Eligible
    const badge = MASTERNODE_TYPE_BADGES[row.node.type]
    return (
      <CheckRow
        key={row.node.proTxHash}
        label={row.node.label}
        checked={!disabled && selected.has(row.node.proTxHash)}
        disabled={disabled}
        onChange={checked => onSelectedChange(toggledSet(selected, row.node.proTxHash, checked))}
      >
        <span className={'flex min-w-0 items-center gap-2'}>
          <Text size={14} weight={'medium'} color={'brand'} className={'min-w-0 truncate'}>{row.node.label}</Text>
          <CustomBadge variant={badge.variant} text={badge.text} className={'shrink-0'} />
          <span className={'ml-auto flex shrink-0 items-center gap-2'}>
            {disabled ? (
              <Text size={10} weight={'medium'} color={'brand'} opacity={50}>{NODE_ELIGIBILITY_LABELS[row.eligibility]}</Text>
            ) : (
              <>
                <Text size={12} weight={'medium'} color={'brand'} className={'tabular-nums'}>{`×${row.weight}`}</Text>
                <Text size={10} weight={'medium'} color={'brand'} opacity={50} className={'tabular-nums'}>{`${row.left} ${VOTE_PANEL_COPY.left}`}</Text>
              </>
            )}
          </span>
        </span>
      </CheckRow>
    )
  }

  const list = visible.map(renderRow)

  return (
    <div className={VOTE_PANEL_CLASS}>
      <DashboardHeading className={'px-1'}>{VOTE_PANEL_COPY.title}</DashboardHeading>
      <div className={'flex items-center justify-between gap-3'}>
        <Text size={10} weight={'medium'} color={'brand'} opacity={40} className={LIST_GROUP_LABEL_CLASS}>{VOTE_PANEL_COPY.voteWith}</Text>
        <button
          type={'button'}
          disabled={eligible.length === 0}
          onClick={() => onSelectedChange(new Set(eligible))}
          className={`${CHIP_ACTION} font-medium disabled:cursor-default disabled:opacity-50`}
        >
          {VOTE_PANEL_COPY.selectAll}
        </button>
      </div>
      {searchable && (
        <SearchField value={query} onChange={setQuery} placeholder={VOTE_PANEL_COPY.searchNodes} ariaLabel={VOTE_PANEL_COPY.searchNodes} />
      )}
      {searchable
        ? <FadingScrollArea className={VOTE_NODE_SCROLL_CLASS}>{list}</FadingScrollArea>
        : <div className={VOTE_NODE_LIST_CLASS}>{list}</div>}
      {visible.length === 0 && (
        <Text size={12} weight={'medium'} color={'brand'} opacity={50} className={'py-2 text-center'}>
          {`${VOTE_PANEL_COPY.noNodeMatch} “${query.trim()}”`}
        </Text>
      )}
      <div className={PANEL_DIVIDER_CLASS} />
      <div className={'flex flex-col gap-1.5 px-1'}>
        <div className={'flex items-baseline justify-between gap-3'}>
          <Text size={12} weight={'medium'} color={'brand'} opacity={50}>{VOTE_PANEL_COPY.votingPower}</Text>
          <Text size={14} weight={'bold'} color={'brand'} className={'tabular-nums'}>{rowsVotingPower(chosen)}</Text>
        </div>
        <Text size={12} weight={'medium'} color={'brand'} opacity={50} className={'min-w-0 wrap-anywhere'}>
          {`${VOTE_PANEL_COPY.currently}: ${currentVoteLine(contestVoteSummary(contest, votes), contest)}`}
        </Text>
        {warnings.map(warning => (
          <Text key={warning.proTxHash} size={12} weight={'medium'} className={'text-dash-orange!'}>{voteChangeWarningText(warning)}</Text>
        ))}
      </div>
      <Button
        type={'button'}
        size={'sm'}
        colorScheme={'primary'}
        className={'w-full rounded-[.9375rem]'}
        disabled={choice == null || chosen.length === 0}
        onClick={onReview}
      >
        {VOTE_PANEL_COPY.review}
      </Button>
    </div>
  )
}
