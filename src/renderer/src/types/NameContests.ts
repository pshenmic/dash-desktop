import type { KeyboardEventHandler, ReactNode, Ref } from 'react'
import type { Network } from '@renderer/api/types'
import type { NodeVoteEligibility } from '@renderer/enums/Masternodes'
import type {
  MasternodeDto,
  MasternodeVoteDto,
  NameContestDto,
  VoteChoiceDto,
} from '@renderer/types/Masternodes'

export interface ContestTableRowProps {
  contest: NameContestDto
  now: number
  network: Network
  hasNodes: boolean
  votes: MasternodeVoteDto[]
  yourName: boolean
  onOpen: (normalizedLabel: string) => void
}

export interface ShareBarProps {
  share: number
  className?: string
}

export interface ContenderOptionProps {
  selected: boolean
  disabled: boolean
  focusable: boolean
  onSelect: () => void
  onKeyDown: KeyboardEventHandler<HTMLButtonElement>
  icon: ReactNode
  title: ReactNode
  badge?: ReactNode
  caption?: ReactNode
  votes: number
  share: number
  ref?: Ref<HTMLButtonElement>
}

export type ContenderOptionControls = Pick<ContenderOptionProps, 'ref' | 'selected' | 'disabled' | 'focusable' | 'onSelect' | 'onKeyDown'>

export interface VoteNodeRow {
  node: MasternodeDto
  vote: MasternodeVoteDto | null
  eligibility: NodeVoteEligibility
  weight: number
  left: number
}

export interface VoteChangeWarning {
  proTxHash: string
  label: string
  leftAfter: number
}

export interface VotePanelProps {
  contest: NameContestDto
  now: number
  nodes: MasternodeDto[]
  votes: MasternodeVoteDto[]
  choice: VoteChoiceDto | null
  selected: ReadonlySet<string>
  onSelectedChange: (selected: Set<string>) => void
  onReview: () => void
  onAddNode: () => void
}

export interface VoteModalProps {
  open: boolean
  onClose: () => void
  walletId: string
  contest: NameContestDto
  choice: VoteChoiceDto
  rows: VoteNodeRow[]
  onRetryWith: (proTxHashes: string[]) => void
}

export interface VoteOutcome {
  proTxHash: string
  label: string
  ok: boolean
  error: string | null
}

export interface ContestOutcomeProps {
  contest: NameContestDto
  nodes: MasternodeDto[]
  votes: MasternodeVoteDto[]
}
