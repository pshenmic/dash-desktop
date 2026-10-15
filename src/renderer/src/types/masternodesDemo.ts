export type MasternodesTab = 'nodes' | 'voting'
export type MasternodeSource = 'wallet' | 'core' | 'manual'
export type MasternodeRole = 'owner' | 'voter' | 'operator'
export type MasternodeAvailability = 'ready' | 'missing-key' | 'offline'
export type MasternodeImportPreview = 'success' | 'locked' | 'unavailable'
export type MasternodeVoteChoice = 'abstain' | 'lock' | string
export type MasternodeContestFilter = 'all' | 'open' | 'ended' | 'locked'

export interface DemoContestPage {
  items: DemoNameContest[]
  total: number
  page: number
  pageCount: number
}

export interface DemoMasternode {
  id: string
  label: string
  proTxHash: string
  address: string
  source: MasternodeSource
  roles: MasternodeRole[]
  availability: MasternodeAvailability
  collateralOwned: boolean
  failFirstVote?: boolean
}

export interface DemoNameContender {
  id: string
  label: string
  identity: string
  requested: string
  votes: number
}

export interface DemoNameContest {
  id: string
  name: string
  state: 'open' | 'ended' | 'locked'
  duration: string
  contenders: DemoNameContender[]
  abstain: number
  lock: number
}

export interface DemoNodeVote {
  contestId: string
  nodeId: string
  choice: MasternodeVoteChoice
}

export interface DemoVoteResult {
  nodeId: string
  success: boolean
  message: string
}

export interface DemoVoteSession {
  contestId: string
  choice: MasternodeVoteChoice
  nodeIds: string[]
  results: DemoVoteResult[]
}

export interface MasternodeImportProps {
  connectedIds: string[]
  onClose: () => void
  onImport: (nodes: DemoMasternode[]) => void
}

export interface ConnectedMasternodesProps {
  nodes: DemoMasternode[]
  votes: DemoNodeVote[]
  onConnect: () => void
  onRemove: (nodeId: string) => void
  onVoting: () => void
}

export interface MasternodeVotingProps {
  nodes: DemoMasternode[]
  votes: DemoNodeVote[]
  onVotes: (votes: DemoNodeVote[]) => void
  onConnect: () => void
}
