import { useDeferredValue, useMemo } from 'react'
import { Button, InfoCircleIcon, Text } from '@renderer/components/dash-ui-kit-enxtended'
import Alert from '@renderer/components/ui/Alert'
import DropdownField from '@renderer/components/ui/DropdownField'
import NoResults from '@renderer/components/ui/NoResults'
import RetryButton from '@renderer/components/ui/RetryButton'
import SearchField from '@renderer/components/ui/SearchField'
import SegmentedControl from '@renderer/components/ui/SegmentedControl'
import ShowMoreButton from '@renderer/components/ui/ShowMoreButton'
import ListSkeleton from '@renderer/components/ui/Skeleton'
import { TOOLBAR_DROPDOWN_CLASS } from '@renderer/constants/listToolbar'
import { CONTEST_SORT_OPTIONS, CONTEST_TABLE_GRID, ENDED_CONTEST_SORT_OPTIONS } from '@renderer/constants/masternodes'
import {
  CONTEST_LIST_SEPARATOR,
  CONTEST_SEGMENT_EMPTY,
  CONTEST_TABLE_HEADINGS,
  CONTESTS_TAB_COPY,
  YOUR_NAMES_CHIP_CLASS,
  YOUR_NAMES_CHIP_PRESSED_CLASS,
} from '@renderer/constants/nameContests'
import { SECTION_TABLE_HEADER, SECTION_TABLE_WRAPPER } from '@renderer/constants/sectionTable'
import { AlertTone } from '@renderer/enums/AlertTone'
import { ContestSegment, ContestSort } from '@renderer/enums/Masternodes'
import { NoResultsTone } from '@renderer/enums/NoResultsTone'
import { SegmentedControlAppearance } from '@renderer/enums/SegmentedControlAppearance'
import { useIdentities } from '@renderer/hooks/useIdentities'
import { refreshMasternodeVotes, useMasternodeVotes } from '@renderer/hooks/useMasternodeVotes'
import { refreshMasternodes, useMasternodes } from '@renderer/hooks/useMasternodes'
import { refreshNameContests, useNameContests } from '@renderer/hooks/useNameContests'
import { useScrollEndSentinel } from '@renderer/hooks/useScrollEndSentinel'
import { useWalletIdentifiers } from '@renderer/hooks/useWalletIdentifiers'
import type { ContestContext } from '@renderer/types/Masternodes'
import type { ContestsTabProps } from '@renderer/types/MasternodeScreens'
import { contestSegmentFor, contestSegmentOptions, contestSortFor } from '@renderer/utils/contestVoting'
import { windowList } from '@renderer/utils/listWindow'
import { countContestSegments, filterContests, hasWalletContender, sortContests } from '@renderer/utils/nameContests'
import { enumParam } from '@renderer/utils/searchParams'
import ContestTableRow from './ContestTableRow'

export default function ContestsTab({
  walletId,
  network,
  now,
  segment,
  onSegmentChange,
  query,
  onQueryChange,
  sort,
  onSortChange,
  yourNamesOnly,
  onYourNamesOnlyChange,
  visibleCount,
  onShowMore,
  onOpenContest,
  onAddNode,
}: ContestsTabProps): React.JSX.Element {
  const { contests, loading, err } = useNameContests(walletId)
  const { nodes, loading: nodesLoading, err: nodesErr } = useMasternodes(walletId)
  const { votes, err: votesErr } = useMasternodeVotes(walletId)
  const { identities } = useIdentities(walletId)
  const appliedQuery = useDeferredValue(query)
  const hasNodes = nodes.length > 0
  const activeSegment = contestSegmentFor(segment, hasNodes)
  const activeSort = contestSortFor(activeSegment, sort)
  const walletIdentifiers = useWalletIdentifiers(identities)
  const context = useMemo<ContestContext>(
    () => ({ nodes, votes, walletIdentifiers, now, network }),
    [nodes, votes, walletIdentifiers, now, network],
  )
  const counts = useMemo(
    () => countContestSegments(contests, { query: appliedQuery, yourNamesOnly }, context),
    [contests, appliedQuery, yourNamesOnly, context],
  )
  const filtered = useMemo(
    () => sortContests(filterContests(contests, { query: appliedQuery, segment: activeSegment, yourNamesOnly }, context), activeSort),
    [contests, appliedQuery, activeSegment, yourNamesOnly, context, activeSort],
  )
  const view = windowList(filtered, visibleCount)
  const showSkeleton = (loading && contests.length === 0) || appliedQuery !== query
  const loadError = err ?? nodesErr ?? votesErr
  const showMoreVisible = view.hasMore && !showSkeleton
  const sentinelRef = useScrollEndSentinel(showMoreVisible, onShowMore, visibleCount)
  const sortOptions = activeSegment === ContestSegment.Ended ? ENDED_CONTEST_SORT_OPTIONS : CONTEST_SORT_OPTIONS
  const showYourNames = counts.yourNames > 0 || yourNamesOnly

  const retry = (): Promise<unknown> => Promise.all([
    refreshNameContests(walletId),
    refreshMasternodes(walletId),
    refreshMasternodeVotes(walletId),
  ])

  if (loadError != null && !loading) {
    return <NoResults tone={NoResultsTone.Error} noResults={loadError} action={<RetryButton onRetry={retry} />} />
  }

  let empty: React.JSX.Element | null = null
  if (!showSkeleton && filtered.length === 0) {
    empty = query.trim() === ''
      ? <NoResults noResults={CONTEST_SEGMENT_EMPTY[activeSegment]} />
      : (
        <NoResults
          noResults={`${CONTESTS_TAB_COPY.noMatch} “${query.trim()}”`}
          action={(
            <Button type={'button'} size={'compact'} colorScheme={'primary-light'} onClick={() => onQueryChange('')}>
              {CONTESTS_TAB_COPY.clearSearch}
            </Button>
          )}
        />
      )
  }

  return (
    <div className={'flex flex-col gap-4'}>
      {!nodesLoading && !hasNodes && (
        <Alert
          tone={AlertTone.Info}
          icon={<InfoCircleIcon size={16} color={'currentColor'} />}
          title={CONTESTS_TAB_COPY.noNodesTitle}
          description={CONTESTS_TAB_COPY.noNodesDescription}
          actions={(
            <Button type={'button'} size={'compact'} colorScheme={'primary'} onClick={onAddNode}>
              {CONTESTS_TAB_COPY.addNode}
            </Button>
          )}
        />
      )}
      <div className={'flex flex-wrap items-center gap-3'}>
        <SearchField
          value={query}
          onChange={onQueryChange}
          placeholder={CONTESTS_TAB_COPY.searchPlaceholder}
          ariaLabel={CONTESTS_TAB_COPY.searchLabel}
          className={'w-full max-w-[22rem]'}
        />
        <DropdownField
          options={sortOptions}
          value={activeSort}
          onChange={value => onSortChange(enumParam(ContestSort, value, ContestSort.EndingSoon))}
          ariaLabel={CONTESTS_TAB_COPY.sortLabel}
          triggerClassName={TOOLBAR_DROPDOWN_CLASS}
          textSize={12}
        />
        {showYourNames && (
          <button
            type={'button'}
            aria-pressed={yourNamesOnly}
            onClick={() => onYourNamesOnlyChange(!yourNamesOnly)}
            className={`${YOUR_NAMES_CHIP_CLASS} ${yourNamesOnly ? YOUR_NAMES_CHIP_PRESSED_CLASS : ''}`}
          >
            {`${CONTESTS_TAB_COPY.yourNames}${CONTEST_LIST_SEPARATOR}${counts.yourNames}`}
          </button>
        )}
      </div>
      <SegmentedControl
        appearance={SegmentedControlAppearance.Pill}
        ariaLabel={CONTESTS_TAB_COPY.segmentsLabel}
        options={contestSegmentOptions(counts, hasNodes)}
        value={activeSegment}
        onChange={onSegmentChange}
        className={'self-start'}
      />
      <div className={'flex flex-col gap-4'} aria-busy={showSkeleton}>
        {showSkeleton && <ListSkeleton rows={6} rowClassName={'h-[3.625rem] rounded-[.875rem]'} />}
        {empty}
        {!showSkeleton && view.items.length > 0 && (
          <div className={SECTION_TABLE_WRAPPER}>
            <div className={'min-w-[40rem]'}>
              <div className={`${SECTION_TABLE_HEADER} ${CONTEST_TABLE_GRID}`}>
                {CONTEST_TABLE_HEADINGS.map(heading => (
                  <Text key={heading} size={12} weight={'medium'} color={'brand'} opacity={50}>{heading}</Text>
                ))}
                <span />
              </div>
              {view.items.map(contest => (
                <ContestTableRow
                  key={contest.normalizedLabel}
                  contest={contest}
                  now={now}
                  network={network}
                  hasNodes={hasNodes}
                  votes={votes}
                  yourName={hasWalletContender(contest, walletIdentifiers)}
                  onOpen={onOpenContest}
                />
              ))}
            </div>
          </div>
        )}
        {showMoreVisible && <ShowMoreButton ref={sentinelRef} remaining={view.remaining} onClick={onShowMore} />}
      </div>
    </div>
  )
}
