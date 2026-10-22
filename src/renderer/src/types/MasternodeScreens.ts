import type { Network } from '@renderer/api/types'
import type { AddNodeSource, ContestSegment, ContestSort, NodeSegment } from '@renderer/enums/Masternodes'

export interface MasternodesPageProps {
  walletId: string
}

export interface NodesTabProps {
  walletId: string
  segment: NodeSegment
  onSegmentChange: (segment: NodeSegment) => void
  query: string
  onQueryChange: (query: string) => void
  visibleCount: number
  onShowMore: () => void
  onOpenNode: (proTxHash: string) => void
  onAddNode: () => void
}

export interface NodeDetailProps {
  walletId: string
  proTxHash: string
  onBack: () => void
  onOpenContest: (normalizedLabel: string) => void
}

export interface AddNodeModalProps {
  open: boolean
  onClose: () => void
  initialSource?: AddNodeSource
  expectedProTxHash?: string
}

export interface ContestsTabProps {
  walletId: string
  network: Network
  now: number
  segment: ContestSegment
  onSegmentChange: (segment: ContestSegment) => void
  query: string
  onQueryChange: (query: string) => void
  sort: ContestSort
  onSortChange: (sort: ContestSort) => void
  yourNamesOnly: boolean
  onYourNamesOnlyChange: (yourNamesOnly: boolean) => void
  visibleCount: number
  onShowMore: () => void
  onOpenContest: (normalizedLabel: string) => void
  onAddNode: () => void
}

export interface ContestDetailProps {
  walletId: string
  network: Network
  now: number
  normalizedLabel: string
  onBack: () => void
  onAddNode: () => void
}
