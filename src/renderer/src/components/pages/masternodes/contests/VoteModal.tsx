import { CheckIcon, ErrorIcon, Text } from '@renderer/components/dash-ui-kit-enxtended'
import SignedActionModal from '@renderer/components/modal/SignedActionModal'
import FadingScrollArea from '@renderer/components/ui/FadingScrollArea'
import { MasternodePreviewAPI } from '@renderer/api/preview/MasternodePreviewAPI'
import { VOTE_MODAL_COPY, VOTE_RESULTS_SCROLL_CLASS } from '@renderer/constants/nameContests'
import { SURFACE_ROW, SURFACE_SECTION } from '@renderer/constants/surfaces'
import { SignedActionDoneTone } from '@renderer/enums/SignedActionDoneTone'
import { refreshMasternodeVotes } from '@renderer/hooks/useMasternodeVotes'
import { refreshNameContests } from '@renderer/hooks/useNameContests'
import type { VoteModalProps, VoteOutcome } from '@renderer/types/NameContests'
import type { SignedActionControls, SignedActionDoneView } from '@renderer/types/SignedActionModal'
import {
  castVotesLabel,
  retryFailedLabel,
  rowsVotingPower,
  selectedNodesLine,
  voteChangeWarningText,
  voteChangeWarnings,
  voteChoiceSummary,
  voteOutcomes,
  votesRecordedHeadline,
} from '@renderer/utils/contestVoting'
import { fullDpnsName } from '@renderer/utils/dpnsLabel'

export default function VoteModal({ open, onClose, walletId, contest, choice, rows, onRetryWith }: VoteModalProps): React.JSX.Element {
  const nodes = rows.map(row => row.node)
  const facts = [
    { label: VOTE_MODAL_COPY.name, value: fullDpnsName(contest.label) },
    { label: VOTE_MODAL_COPY.choice, value: voteChoiceSummary(choice, contest) },
    { label: VOTE_MODAL_COPY.nodes, value: selectedNodesLine(nodes) },
    { label: VOTE_MODAL_COPY.votingPower, value: String(rowsVotingPower(rows)) },
    { label: VOTE_MODAL_COPY.fee, value: VOTE_MODAL_COPY.feeValue },
  ]
  const warnings = voteChangeWarnings(rows)

  const run = async (password: string): Promise<VoteOutcome[]> => {
    const results = await MasternodePreviewAPI.castMasternodeVotes(
      walletId,
      contest.normalizedLabel,
      choice,
      nodes.map(node => node.proTxHash),
      password,
    )
    await Promise.all([refreshMasternodeVotes(walletId), refreshNameContests(walletId)])
    return voteOutcomes(nodes, results)
  }

  const renderDone = (outcomes: VoteOutcome[], controls: SignedActionControls): SignedActionDoneView => {
    const failed = outcomes.filter(outcome => !outcome.ok)
    return {
      tone: failed.length === 0 ? SignedActionDoneTone.Success : SignedActionDoneTone.Partial,
      headline: votesRecordedHeadline(outcomes),
      body: (
        <FadingScrollArea className={VOTE_RESULTS_SCROLL_CLASS}>
          {outcomes.map(outcome => (
            <div key={outcome.proTxHash} className={`flex items-center gap-3 ${SURFACE_ROW}`}>
              {outcome.ok
                ? <CheckIcon size={14} color={'currentColor'} className={'shrink-0 text-dash-green'} />
                : <ErrorIcon size={14} color={'currentColor'} className={'shrink-0 text-dash-red'} />}
              <div className={'flex min-w-0 flex-col gap-0.5'}>
                <Text size={14} weight={'medium'} color={'brand'} className={'wrap-anywhere'}>{outcome.label}</Text>
                {outcome.error && <Text size={10} weight={'medium'} color={'brand'} opacity={50}>{outcome.error}</Text>}
              </div>
            </div>
          ))}
        </FadingScrollArea>
      ),
      secondary: failed.length === 0 ? undefined : {
        label: retryFailedLabel(failed.length),
        onClick: () => {
          onRetryWith(failed.map(outcome => outcome.proTxHash))
          controls.restart()
        },
      },
    }
  }

  return (
    <SignedActionModal<VoteOutcome[]>
      open={open}
      onClose={onClose}
      title={VOTE_MODAL_COPY.title}
      summary={(
        <div className={`flex flex-col gap-[.75rem] ${SURFACE_SECTION}`}>
          {facts.map(fact => (
            <div key={fact.label} className={'flex items-center justify-between gap-4'}>
              <Text size={12} weight={'medium'} color={'brand'} opacity={50} className={'shrink-0'}>{fact.label}</Text>
              <Text size={12} weight={'medium'} color={'brand'} className={'min-w-0 wrap-anywhere text-right'}>{fact.value}</Text>
            </div>
          ))}
          {warnings.map(warning => (
            <Text key={warning.proTxHash} size={12} weight={'medium'} className={'text-dash-orange!'}>{voteChangeWarningText(warning)}</Text>
          ))}
        </div>
      )}
      confirmLabel={castVotesLabel(rows.length)}
      confirmDisabled={rows.length === 0}
      pendingLabel={VOTE_MODAL_COPY.pending}
      run={run}
      renderDone={renderDone}
      previewNote
    />
  )
}
