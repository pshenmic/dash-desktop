import type { DemoContestPage, DemoMasternode, DemoNameContender, DemoNameContest, DemoNodeVote, DemoVoteResult, MasternodeContestFilter, MasternodeVoteChoice } from '@renderer/types/masternodesDemo'

export function searchDemoContenders(contenders: DemoNameContender[], query: string): DemoNameContender[] {
  const search = query.trim().toLowerCase()
  return contenders.filter((contender) => `${contender.label} ${contender.identity}`.toLowerCase().includes(search))
}

export function getDemoContestPage(contests: DemoNameContest[], query: string, status: MasternodeContestFilter, requestedPage: number, pageSize: number): DemoContestPage {
  const search = query.trim().toLowerCase().replace(/\.dash$/, '')
  const matches = contests.filter((contest) => (status === 'all' || contest.state === status) && contest.name.includes(search))
    .sort((left, right) => left.name.localeCompare(right.name))
  const size = Number.isFinite(pageSize) ? Math.max(1, Math.floor(pageSize)) : 1
  const pageCount = Math.max(1, Math.ceil(matches.length / size))
  const page = Number.isFinite(requestedPage) ? Math.max(1, Math.min(pageCount, Math.floor(requestedPage))) : 1
  return { items: matches.slice((page - 1) * size, page * size), total: matches.length, page, pageCount }
}

export function demoContestVoteSummary(contest: DemoNameContest, votes: DemoNodeVote[], nodes: DemoMasternode[]): string {
  const connectedIds = new Set(nodes.map((node) => node.id))
  const ownVotes = votes.filter((vote) => vote.contestId === contest.id && connectedIds.has(vote.nodeId))
  if (ownVotes.length === 0) return 'No vote'
  const choices = new Set(ownVotes.map((vote) => vote.choice))
  return choices.size === 1 ? `${demoVoteChoiceLabel(contest, ownVotes[0].choice)} · ${ownVotes.length}` : `Mixed choices · ${ownVotes.length}`
}

export function canMasternodeVote(node: DemoMasternode): boolean {
  return node.roles.includes('voter') && node.availability === 'ready'
}

export function mergeDemoMasternodes(current: DemoMasternode[], incoming: DemoMasternode[]): DemoMasternode[] {
  const ids = new Set(current.map((node) => node.id))
  return [...current, ...incoming.filter((node) => {
    if (ids.has(node.id)) return false
    ids.add(node.id)
    return true
  })]
}

export function demoVoteChoiceLabel(contest: DemoNameContest, choice: MasternodeVoteChoice): string {
  if (choice === 'abstain') return 'Abstain'
  if (choice === 'lock') return 'Lock name'
  return contest.contenders.find((contender) => contender.id === choice)?.label ?? 'Unknown contender'
}

export function simulateMasternodeVotes(nodes: DemoMasternode[], nodeIds: string[], retry = false): DemoVoteResult[] {
  return [...new Set(nodeIds)].map((nodeId) => {
    const node = nodes.find((candidate) => candidate.id === nodeId)
    const eligible = node && canMasternodeVote(node)
    const success = Boolean(eligible && (retry || !node.failFirstVote))
    return {
      nodeId,
      success,
      message: success ? 'Vote recorded in demo' : eligible ? 'Simulated connection timeout. Retry this node.' : 'Voting key is unavailable.',
    }
  })
}

export function applySuccessfulDemoVotes(votes: DemoNodeVote[], contestId: string, choice: MasternodeVoteChoice, results: DemoVoteResult[]): DemoNodeVote[] {
  const successfulIds = new Set(results.filter((result) => result.success).map((result) => result.nodeId))
  return [
    ...votes.filter((vote) => vote.contestId !== contestId || !successfulIds.has(vote.nodeId)),
    ...[...successfulIds].map((nodeId) => ({ contestId, nodeId, choice })),
  ]
}
