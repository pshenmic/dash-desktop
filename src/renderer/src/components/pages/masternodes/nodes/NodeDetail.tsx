import { useMemo, useState } from 'react'
import { Button, HighlightedIdentifier, Text } from '@renderer/components/dash-ui-kit-enxtended'
import {
  BoxIcon,
  CalendarIconHighlighted,
  CheckIcon,
  DocumentIcon,
  KeyIcon,
  ServerIcon,
  WalletIcon,
  WebIcon,
} from '@renderer/components/dash-ui-kit-enxtended/icons'
import DetailToken from '@renderer/components/pages/transactions/TransactionDetailToken'
import CopyButton from '@renderer/components/ui/CopyButton'
import CustomBadge from '@renderer/components/ui/CustomBadge'
import ListSkeleton from '@renderer/components/ui/Skeleton'
import NoResults from '@renderer/components/ui/NoResults'
import PageHeader from '@renderer/components/ui/PageHeader'
import StatusPill from '@renderer/components/ui/StatusPill'
import { NODE_DETAIL_COPY, NODE_DETAIL_ICON_CLASS, NODE_DETAIL_ROW_CLASS, NODE_WEIGHT_PREFIX } from '@renderer/constants/masternodeNodes'
import { MASTERNODE_STATUS_PILLS, MASTERNODE_TYPE_BADGES, MASTERNODE_VOTE_WEIGHT } from '@renderer/constants/masternodes'
import { PAGE_HEADERS } from '@renderer/constants/pageHeaders'
import { ICON_CHIP, SURFACE_PANEL } from '@renderer/constants/surfaces'
import { TRANSACTION_DETAIL_CARD_CLASS } from '@renderer/constants/transactionsPage'
import { AddNodeSource, MasternodeAccess } from '@renderer/enums/Masternodes'
import { useMasternodes } from '@renderer/hooks/useMasternodes'
import { useMasternodeVotes } from '@renderer/hooks/useMasternodeVotes'
import { useNameContests } from '@renderer/hooks/useNameContests'
import { formatBlockHeight, nodeVotes } from '@renderer/utils/masternodeNodes'
import type { NodeDetailProps } from '@renderer/types/MasternodeScreens'
import AddNodeModal from './AddNodeModal'
import NodeVotes from './NodeVotes'
import RemoveNodeModal from './RemoveNodeModal'

export default function NodeDetail({ walletId, proTxHash, onBack, onOpenContest }: NodeDetailProps): React.JSX.Element {
  const { nodes, loading } = useMasternodes(walletId)
  const { votes } = useMasternodeVotes(walletId)
  const { contests } = useNameContests(walletId)
  const [removeOpen, setRemoveOpen] = useState(false)
  const [addKeyOpen, setAddKeyOpen] = useState(false)
  const node = nodes.find(candidate => candidate.proTxHash === proTxHash) ?? null
  const ownVotes = useMemo(() => nodeVotes(votes, proTxHash), [votes, proTxHash])

  if (node === null) {
    return (
      <div className={'pt-2'}>
        {loading ? (
          <ListSkeleton rows={3} rowClassName={'h-[4.25rem] rounded-[.875rem]'} />
        ) : (
          <div className={SURFACE_PANEL}>
            <NoResults
              noResults={NODE_DETAIL_COPY.unknownNode}
              action={<Button type={'button'} size={'compact'} colorScheme={'primary-light'} onClick={onBack}>{NODE_DETAIL_COPY.back}</Button>}
            />
          </div>
        )}
      </div>
    )
  }

  const status = MASTERNODE_STATUS_PILLS[node.status]
  const typeBadge = MASTERNODE_TYPE_BADGES[node.type]
  const weight = `${NODE_WEIGHT_PREFIX}${MASTERNODE_VOTE_WEIGHT[node.type]}`
  const watchOnly = node.access === MasternodeAccess.WatchOnly

  return (
    <>
      <PageHeader
        title={node.label}
        onBack={onBack}
        backLabel={PAGE_HEADERS.masternodeDetail.back}
        titleAddon={(
          <>
            <CustomBadge {...typeBadge} className={'shrink-0'} />
            <StatusPill tone={status.tone}>{status.label}</StatusPill>
          </>
        )}
        subtitle={watchOnly
          ? NODE_DETAIL_COPY.subtitleWatchOnly
          : `${NODE_DETAIL_COPY.subtitleVotesPrefix} ${weight} ${NODE_DETAIL_COPY.subtitleVoting}`}
        actions={(
          <>
            {watchOnly && (
              <Button type={'button'} size={'compact'} colorScheme={'primary'} onClick={() => setAddKeyOpen(true)}>
                {NODE_DETAIL_COPY.addVotingKey}
              </Button>
            )}
            <Button type={'button'} size={'compact'} colorScheme={'danger-light'} onClick={() => setRemoveOpen(true)}>
              {NODE_DETAIL_COPY.remove}
            </Button>
          </>
        )}
      />

      <div className={'flex flex-col gap-4'}>
        <div className={TRANSACTION_DETAIL_CARD_CLASS}>
          <div className={'flex flex-col gap-3'}>
            <div className={NODE_DETAIL_ROW_CLASS}>
              <span className={ICON_CHIP}><DocumentIcon size={14} color={'currentColor'} /></span>
              <Text size={14} weight={'medium'} color={'brand'} className={'shrink-0'}>{NODE_DETAIL_COPY.proTxHash}</Text>
              <HighlightedIdentifier className={'min-w-0 font-medium!'}>{node.proTxHash}</HighlightedIdentifier>
              <CopyButton text={node.proTxHash} className={'shrink-0'} />
            </div>
            <div className={NODE_DETAIL_ROW_CLASS}>
              <span className={ICON_CHIP}><WalletIcon size={14} color={'currentColor'} /></span>
              <Text size={14} weight={'medium'} color={'brand'} className={'shrink-0'}>{NODE_DETAIL_COPY.payoutAddress}</Text>
              <HighlightedIdentifier className={'min-w-0 font-medium!'}>{node.payoutAddress}</HighlightedIdentifier>
              <CopyButton text={node.payoutAddress} className={'shrink-0'} />
            </div>
          </div>
          <div className={'grid grid-cols-1 lg:grid-cols-2 gap-3'}>
            <DetailToken
              icon={<ServerIcon size={14} color={'currentColor'} className={NODE_DETAIL_ICON_CLASS} />}
              label={NODE_DETAIL_COPY.type}
              value={<Text size={14} weight={'extrabold'} color={'brand'}>{`${typeBadge.text} ${weight}`}</Text>}
            />
            <DetailToken
              icon={<CheckIcon size={14} color={'currentColor'} className={NODE_DETAIL_ICON_CLASS} />}
              label={NODE_DETAIL_COPY.status}
              value={<Text size={14} weight={'extrabold'} color={'brand'}>{status.label}</Text>}
              subValue={`${NODE_DETAIL_COPY.pose} ${node.posePenalty}`}
            />
            <DetailToken
              icon={<WebIcon size={14} color={'currentColor'} className={NODE_DETAIL_ICON_CLASS} />}
              label={NODE_DETAIL_COPY.service}
              value={<Text size={14} weight={'medium'} color={'brand'} className={'tabular-nums'}>{node.service}</Text>}
            />
            <DetailToken
              icon={<KeyIcon size={14} color={'currentColor'} className={NODE_DETAIL_ICON_CLASS} />}
              label={NODE_DETAIL_COPY.votingKey}
              value={<Text size={14} weight={'medium'} color={'brand'}>{watchOnly ? NODE_DETAIL_COPY.votingKeyMissing : NODE_DETAIL_COPY.votingKeyStored}</Text>}
            />
            <DetailToken
              icon={<BoxIcon size={14} color={'currentColor'} className={NODE_DETAIL_ICON_CLASS} />}
              label={NODE_DETAIL_COPY.registered}
              value={<Text size={14} weight={'medium'} color={'brand'} className={'tabular-nums'}>{formatBlockHeight(node.registeredHeight)}</Text>}
            />
            <DetailToken
              icon={<CalendarIconHighlighted size={14} color={'currentColor'} className={NODE_DETAIL_ICON_CLASS} />}
              label={NODE_DETAIL_COPY.lastPaid}
              value={(
                <Text size={14} weight={'medium'} color={'brand'} className={'tabular-nums'}>
                  {node.lastPaidHeight === null ? NODE_DETAIL_COPY.neverPaid : formatBlockHeight(node.lastPaidHeight)}
                </Text>
              )}
            />
          </div>
        </div>

        <NodeVotes votes={ownVotes} contests={contests} onOpenContest={onOpenContest} />
      </div>

      <RemoveNodeModal open={removeOpen} onClose={() => setRemoveOpen(false)} walletId={walletId} node={node} onRemoved={onBack} />
      <AddNodeModal
        open={addKeyOpen}
        onClose={() => setAddKeyOpen(false)}
        initialSource={AddNodeSource.VotingKey}
        expectedProTxHash={node.proTxHash}
      />
    </>
  )
}
