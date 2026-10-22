import type { ReactNode } from 'react'
import type { Network } from '@renderer/api/types'
import type { ContestSegment, NodeSegment } from '@renderer/enums/Masternodes'
import type { MasternodeDto, MasternodeVoteDto, NameContestDto } from './Masternodes'

export interface MasternodesNavigationState {
  fromList?: boolean
}

export interface SummaryStripProps {
  nodes: MasternodeDto[]
  contests: NameContestDto[]
  votes: MasternodeVoteDto[]
  loading: boolean
  network: Network
  now: number
  onSelectNodes: (segment: NodeSegment) => void
  onSelectContests: (segment: ContestSegment) => void
  onAddNode: () => void
}

export interface SummaryCellProps {
  label: string
  value: ReactNode
  children: ReactNode
}

export interface SummaryLinkProps {
  onClick: () => void
  children: ReactNode
}

export interface NodeTableRowProps {
  node: MasternodeDto
  onOpen: (proTxHash: string) => void
  onRemove: (node: MasternodeDto) => void
}

export interface NodeVotesProps {
  votes: MasternodeVoteDto[]
  contests: NameContestDto[]
  onOpenContest: (normalizedLabel: string) => void
}

export interface NodeVoteRowProps {
  vote: MasternodeVoteDto
  contest: NameContestDto | undefined
  onOpen: (normalizedLabel: string) => void
}

export interface RemoveNodeModalProps {
  open: boolean
  onClose: () => void
  walletId: string
  node: MasternodeDto | null
  onRemoved?: () => void
}

export interface AddNodeCandidateProps {
  node: MasternodeDto
  checked: boolean
  alreadyAdded: boolean
  meta: string
  onChange: (checked: boolean) => void
}
