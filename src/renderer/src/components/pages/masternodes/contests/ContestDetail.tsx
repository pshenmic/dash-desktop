import { Fragment, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, CircleProcessIcon, InfoCircleIcon, LockIcon, Text } from '@renderer/components/dash-ui-kit-enxtended'
import DashboardHeading from '@renderer/components/pages/dashboard/DashboardHeading'
import Alert from '@renderer/components/ui/Alert'
import CustomBadge from '@renderer/components/ui/CustomBadge'
import IdentityAvatar from '@renderer/components/ui/IdentityAvatar'
import NoResults from '@renderer/components/ui/NoResults'
import PageHeader from '@renderer/components/ui/PageHeader'
import RetryButton from '@renderer/components/ui/RetryButton'
import SearchField from '@renderer/components/ui/SearchField'
import ListSkeleton from '@renderer/components/ui/Skeleton'
import StatusPill from '@renderer/components/ui/StatusPill'
import { LIST_GROUP_LABEL_CLASS } from '@renderer/constants/listToolbar'
import { CONTENDER_SEARCH_MIN, CONTEST_STATUS_PILLS } from '@renderer/constants/masternodes'
import {
  CONTEST_DETAIL_COPY,
  CONTEST_DETAIL_GRID,
  CONTEST_LIST_SEPARATOR,
  ABSTAIN_CHOICE,
  LOCK_CHOICE,
  RADIO_NAVIGATION_KEYS,
  VOTE_PANEL_CLASS,
  VOTE_NODE_LIST_CLASS,
} from '@renderer/constants/nameContests'
import { PAGE_HEADERS } from '@renderer/constants/pageHeaders'
import { CHIP_ACTION, ICON_CHIP, SURFACE_PANEL, SURFACE_ROW } from '@renderer/constants/surfaces'
import { AlertTone } from '@renderer/enums/AlertTone'
import { IdentityAvatarSize } from '@renderer/enums/IdentityAvatarSize'
import { ContestStatus } from '@renderer/enums/Masternodes'
import { NoResultsTone } from '@renderer/enums/NoResultsTone'
import { useIdentities } from '@renderer/hooks/useIdentities'
import { useMasternodeVotes } from '@renderer/hooks/useMasternodeVotes'
import { useMasternodes } from '@renderer/hooks/useMasternodes'
import { refreshNameContests, useNameContests } from '@renderer/hooks/useNameContests'
import { useWalletIdentifiers } from '@renderer/hooks/useWalletIdentifiers'
import type { VoteChoiceDto, VoteShare } from '@renderer/types/Masternodes'
import type { ContestDetailProps } from '@renderer/types/MasternodeScreens'
import type { ContenderOptionControls, ContestOutcomeProps } from '@renderer/types/NameContests'
import {
  contenderCaption,
  contestOutcomeTitle,
  dashPayUsernamesHref,
  eligibleNodeHashes,
  filterContenderShares,
  formatVoteCount,
  selectedVoteRows,
  voteNodeRows,
} from '@renderer/utils/contestVoting'
import { writeStoredIdentity } from '@renderer/utils/dashPayIdentityStorage'
import { fullDpnsName } from '@renderer/utils/dpnsLabel'
import { nextListIndex } from '@renderer/utils/listNavigation'
import { contenderName, contenderShares, contestTiming, towardsContender, voteChoiceLabel } from '@renderer/utils/nameContests'
import { formatTimeLeft } from '@renderer/utils/timeLeft'
import { voteChoiceEquals } from '@renderer/utils/masternodes'
import ContenderOption from './ContenderOption'
import VoteModal from './VoteModal'
import VotePanel from './VotePanel'

export default function ContestDetail({ walletId, now, normalizedLabel, onBack, onAddNode }: ContestDetailProps): React.JSX.Element {
  const navigate = useNavigate()
  const { contests, loading, err } = useNameContests(walletId)
  const { nodes } = useMasternodes(walletId)
  const { votes } = useMasternodeVotes(walletId)
  const { identities } = useIdentities(walletId)
  const [choice, setChoice] = useState<VoteChoiceDto | null>(null)
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [reviewing, setReviewing] = useState(false)
  const [query, setQuery] = useState('')
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([])
  const walletIdentifiers = useWalletIdentifiers(identities)
  const contest = contests.find(candidate => candidate.normalizedLabel === normalizedLabel)

  if (contest == null) {
    if (loading) return <ListSkeleton rows={4} rowClassName={'h-[3.75rem] rounded-[.875rem]'} />
    if (err != null) {
      return <NoResults tone={NoResultsTone.Error} noResults={err} action={<RetryButton onRetry={() => refreshNameContests(walletId)} />} />
    }
    return (
      <NoResults
        tone={NoResultsTone.Error}
        noResults={CONTEST_DETAIL_COPY.unknown}
        action={(
          <Button type={'button'} size={'compact'} colorScheme={'primary-light'} onClick={onBack}>
            {CONTEST_DETAIL_COPY.backShort}
          </Button>
        )}
      />
    )
  }

  const ended = contest.status !== ContestStatus.Open
  const closed = ended || contest.endsAt <= now
  const shares = contenderShares(contest)
  const searchable = contest.contenders.length > CONTENDER_SEARCH_MIN
  const visibleShares = searchable ? filterContenderShares(shares.contenders, query) : shares.contenders
  const entries: VoteChoiceDto[] = [...visibleShares.map(share => towardsContender(share.contender)), LOCK_CHOICE, ABSTAIN_CHOICE]
  const selectedIndex = choice == null ? -1 : entries.findIndex(entry => voteChoiceEquals(entry, choice))
  const focusIndex = selectedIndex < 0 ? 0 : selectedIndex
  const status = CONTEST_STATUS_PILLS[contest.status]
  const chosenRows = choice == null ? [] : selectedVoteRows(voteNodeRows(nodes, votes, contest, choice, now), selected)

  const choose = (next: VoteChoiceDto): void => {
    setChoice(next)
    setSelected(new Set(eligibleNodeHashes(voteNodeRows(nodes, votes, contest, next, now))))
  }

  const moveFocus = (index: number) => (event: React.KeyboardEvent<HTMLButtonElement>): void => {
    const key = RADIO_NAVIGATION_KEYS[event.key]
    if (key == null) return
    event.preventDefault()
    optionRefs.current[nextListIndex(index, key, entries.length)]?.focus()
  }

  const openInDashPay = (identifier: string): void => {
    writeStoredIdentity(walletId, identifier)
    navigate(dashPayUsernamesHref(identifier))
  }

  const optionProps = (index: number, entryChoice: VoteChoiceDto): ContenderOptionControls => ({
    ref: (element: HTMLButtonElement | null) => { optionRefs.current[index] = element },
    selected: choice != null && voteChoiceEquals(choice, entryChoice),
    disabled: closed,
    focusable: index === focusIndex,
    onSelect: () => choose(entryChoice),
    onKeyDown: moveFocus(index),
  })

  const otherOption = (index: number, entryChoice: VoteChoiceDto, icon: React.JSX.Element, title: string, tally: VoteShare): React.JSX.Element => (
    <ContenderOption
      {...optionProps(index, entryChoice)}
      icon={<span className={ICON_CHIP}>{icon}</span>}
      title={title}
      votes={tally.votes}
      share={tally.share}
    />
  )

  return (
    <div className={'flex flex-col'}>
      <PageHeader
        onBack={onBack}
        backLabel={PAGE_HEADERS.nameContest.back}
        title={fullDpnsName(contest.label)}
        titleAddon={<StatusPill tone={status.tone}>{status.label}</StatusPill>}
        subtitle={contestTiming(contest, now)}
        actions={closed ? undefined : (
          <Text size={12} weight={'medium'} color={'brand'} opacity={50}>
            {`${CONTEST_DETAIL_COPY.endsIn} `}
            <strong className={'tabular-nums'}>{formatTimeLeft(contest.endsAt, now)}</strong>
          </Text>
        )}
      />
      <div className={CONTEST_DETAIL_GRID}>
        <section className={`flex min-w-0 flex-col gap-3 ${SURFACE_PANEL}`}>
          <div className={'flex items-center justify-between gap-3 px-1'}>
            <DashboardHeading>{`${CONTEST_DETAIL_COPY.contenders}${CONTEST_LIST_SEPARATOR}${contest.contenders.length}`}</DashboardHeading>
            <Text size={12} weight={'medium'} color={'brand'} opacity={50} className={'tabular-nums'}>{formatVoteCount(shares.total)}</Text>
          </div>
          {searchable && (
            <SearchField
              value={query}
              onChange={setQuery}
              placeholder={CONTEST_DETAIL_COPY.searchContenders}
              ariaLabel={CONTEST_DETAIL_COPY.searchContenders}
            />
          )}
          <div role={'radiogroup'} aria-label={CONTEST_DETAIL_COPY.choiceLabel} className={'flex flex-col gap-1.5'}>
            {visibleShares.map((share, index) => {
              const { contender } = share
              const ours = walletIdentifiers.has(contender.identifier)
              const caption = contenderCaption(contender, contest.label)
              return (
                <Fragment key={contender.identifier}>
                  <ContenderOption
                    {...optionProps(index, towardsContender(contender))}
                    icon={<IdentityAvatar identifier={contender.identifier} size={IdentityAvatarSize.Sm} />}
                    title={contenderName(contender)}
                    badge={(
                      <>
                        {share.leading && <CustomBadge variant={'muted'} text={CONTEST_DETAIL_COPY.leading} className={'shrink-0'} />}
                        {ours && <CustomBadge variant={'accent'} text={CONTEST_DETAIL_COPY.yourIdentity} className={'shrink-0'} />}
                      </>
                    )}
                    caption={caption === '' ? undefined : (
                      <Text size={10} weight={'medium'} color={'brand'} opacity={50} className={'wrap-anywhere'}>{caption}</Text>
                    )}
                    votes={contender.votes}
                    share={share.share}
                  />
                  {ours && (
                    <button
                      type={'button'}
                      onClick={() => openInDashPay(contender.identifier)}
                      className={`${CHIP_ACTION} ml-[3.75rem] self-start font-medium`}
                    >
                      {CONTEST_DETAIL_COPY.openInDashPay}
                    </button>
                  )}
                </Fragment>
              )
            })}
            {visibleShares.length === 0 && (
              <Text size={12} weight={'medium'} color={'brand'} opacity={50} className={'py-4 text-center'}>
                {`${CONTEST_DETAIL_COPY.noContenderMatch} “${query.trim()}”`}
              </Text>
            )}
            <Text size={10} weight={'medium'} color={'brand'} opacity={40} className={`${LIST_GROUP_LABEL_CLASS} pt-3!`}>
              {CONTEST_DETAIL_COPY.otherChoices}
            </Text>
            {otherOption(visibleShares.length, LOCK_CHOICE, <LockIcon size={14} color={'currentColor'} />, CONTEST_DETAIL_COPY.lock, shares.lock)}
            {otherOption(visibleShares.length + 1, ABSTAIN_CHOICE, <CircleProcessIcon size={14} color={'currentColor'} />, CONTEST_DETAIL_COPY.abstain, shares.abstain)}
          </div>
        </section>
        {ended
          ? <ContestOutcome contest={contest} nodes={nodes} votes={votes} />
          : (
            <VotePanel
              contest={contest}
              now={now}
              nodes={nodes}
              votes={votes}
              choice={choice}
              selected={selected}
              onSelectedChange={setSelected}
              onReview={() => setReviewing(true)}
              onAddNode={onAddNode}
            />
          )}
      </div>
      {choice != null && (
        <VoteModal
          open={reviewing}
          onClose={() => setReviewing(false)}
          walletId={walletId}
          contest={contest}
          choice={choice}
          rows={chosenRows}
          onRetryWith={proTxHashes => setSelected(new Set(proTxHashes))}
        />
      )}
    </div>
  )
}

function ContestOutcome({ contest, nodes, votes }: ContestOutcomeProps): React.JSX.Element {
  const labels = new Map(nodes.map(node => [node.proTxHash, node.label]))
  const ours = votes.filter(vote => vote.normalizedLabel === contest.normalizedLabel)
  return (
    <div className={VOTE_PANEL_CLASS}>
      <Alert tone={AlertTone.Info} icon={<InfoCircleIcon size={16} color={'currentColor'} />} title={contestOutcomeTitle(contest)} />
      {ours.length > 0 && (
        <>
          <Text size={10} weight={'medium'} color={'brand'} opacity={40} className={LIST_GROUP_LABEL_CLASS}>{CONTEST_DETAIL_COPY.yourVotes}</Text>
          <div className={VOTE_NODE_LIST_CLASS}>
            {ours.map(vote => (
              <div key={vote.proTxHash} className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-1 ${SURFACE_ROW}`}>
                <Text size={14} weight={'medium'} color={'brand'} className={'min-w-0 wrap-anywhere'}>{labels.get(vote.proTxHash) ?? vote.proTxHash}</Text>
                <Text size={12} weight={'medium'} color={'brand'} opacity={50} className={'ml-auto min-w-0 wrap-anywhere text-right'}>{voteChoiceLabel(vote.choice, contest)}</Text>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
