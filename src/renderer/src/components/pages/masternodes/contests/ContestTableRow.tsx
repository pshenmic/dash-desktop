import { ChevronIcon, Text } from '@renderer/components/dash-ui-kit-enxtended'
import CustomBadge from '@renderer/components/ui/CustomBadge'
import IdentityAvatar from '@renderer/components/ui/IdentityAvatar'
import StatusPill from '@renderer/components/ui/StatusPill'
import { CONTEST_STATUS_PILLS, CONTEST_TABLE_GRID } from '@renderer/constants/masternodes'
import {
  CONTEST_AVATAR_LIMIT,
  CONTEST_AVATAR_CLASS,
  CONTEST_ROW_CHEVRON_CLASS,
  CONTEST_ROW_COPY,
} from '@renderer/constants/nameContests'
import { SECTION_TABLE_ROW } from '@renderer/constants/sectionTable'
import { IdentityAvatarSize } from '@renderer/enums/IdentityAvatarSize'
import { ContestStatus } from '@renderer/enums/Masternodes'
import { StatusPillTone } from '@renderer/enums/StatusPillTone'
import type { ContestTableRowProps } from '@renderer/types/NameContests'
import { contestVoteBadge, formatShare, formatVoteCount, leaderLabel } from '@renderer/utils/contestVoting'
import { contestLeader, contestVoteSummary, isEndingSoon } from '@renderer/utils/nameContests'
import { formatTimeLeft } from '@renderer/utils/timeLeft'
import ShareBar from './ShareBar'

export default function ContestTableRow({ contest, now, network, hasNodes, votes, yourName, onOpen }: ContestTableRowProps): React.JSX.Element {
  const leader = contestLeader(contest)
  const avatars = contest.contenders.slice(0, CONTEST_AVATAR_LIMIT)
  const extra = contest.contenders.length - avatars.length
  const status = CONTEST_STATUS_PILLS[contest.status]
  const badge = contestVoteBadge(contestVoteSummary(contest, votes), contest)
  const timeLeft = formatTimeLeft(contest.endsAt, now)
  const hasLeader = leader.tie || leader.choice != null

  let ends: React.JSX.Element
  if (contest.status !== ContestStatus.Open) ends = <StatusPill tone={status.tone}>{status.label}</StatusPill>
  else if (isEndingSoon(contest, now, network)) ends = <StatusPill tone={StatusPillTone.Warning}>{timeLeft}</StatusPill>
  else ends = <Text size={12} weight={'medium'} color={'brand'} className={'tabular-nums'}>{timeLeft}</Text>

  let yourVote: React.JSX.Element
  if (badge != null) yourVote = <CustomBadge text={badge} className={'max-w-full truncate'} />
  else yourVote = (
    <Text size={12} weight={'medium'} color={'brand'} opacity={50}>
      {hasNodes ? CONTEST_ROW_COPY.notVoted : CONTEST_ROW_COPY.none}
    </Text>
  )

  return (
    <button type={'button'} onClick={() => onOpen(contest.normalizedLabel)} className={`${SECTION_TABLE_ROW} ${CONTEST_TABLE_GRID}`}>
      <span className={'flex min-w-0 flex-col items-start gap-1'}>
        <Text size={14} weight={'medium'} color={'brand'} className={'max-w-full truncate'}>{`${contest.label}.dash`}</Text>
        {yourName && <CustomBadge variant={'accent'} text={CONTEST_ROW_COPY.yourName} />}
      </span>
      <span className={'flex items-center'}>
        {avatars.map(contender => (
          <span key={contender.identifier} className={CONTEST_AVATAR_CLASS}>
            <IdentityAvatar identifier={contender.identifier} size={IdentityAvatarSize.Xs} />
          </span>
        ))}
        {extra > 0 && <Text size={10} weight={'medium'} color={'brand'} opacity={50} className={'ml-1'}>{`+${extra}`}</Text>}
      </span>
      <span className={'flex min-w-0 flex-col gap-1'}>
        <span className={'flex min-w-0 items-center gap-2'}>
          <Text size={12} weight={'medium'} color={'brand'} opacity={hasLeader ? 100 : 50} className={'min-w-0 truncate'}>{leaderLabel(leader)}</Text>
          {hasLeader && (
            <>
              <ShareBar share={leader.share} className={'w-20 shrink-0'} />
              <Text size={10} weight={'medium'} color={'brand'} opacity={50} className={'shrink-0 tabular-nums'}>{formatShare(leader.share)}</Text>
            </>
          )}
        </span>
        {hasLeader && <Text size={10} weight={'medium'} color={'brand'} opacity={50} className={'tabular-nums'}>{formatVoteCount(leader.votes)}</Text>}
      </span>
      <span className={'flex min-w-0 items-center'}>{ends}</span>
      <span className={'flex min-w-0 items-center'}>{yourVote}</span>
      <ChevronIcon size={12} color={'currentColor'} className={CONTEST_ROW_CHEVRON_CLASS} />
    </button>
  )
}
