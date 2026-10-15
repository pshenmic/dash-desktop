import { describe, expect, it } from 'vitest'
import { MASTERNODE_DEMO_CONTESTS, MASTERNODE_DEMO_FIXTURES } from '@renderer/constants/masternodesDemo'
import { applySuccessfulDemoVotes, canMasternodeVote, demoContestVoteSummary, demoVoteChoiceLabel, getDemoContestPage, mergeDemoMasternodes, searchDemoContenders, simulateMasternodeVotes } from '@renderer/utils/masternodesDemo'

describe('candidate comparisons', () => {
  it('finds a candidate by label or identity in a large contest without changing the order', () => {
    const candidates = MASTERNODE_DEMO_CONTESTS.find((contest) => contest.id === 'contest-atlas')!.contenders
    expect(candidates.length).toBeGreaterThan(10)
    expect(searchDemoContenders(candidates, '  IDENTITY-ATLAS-16 ')).toEqual([candidates.find((candidate) => candidate.label === 'Contender 16')])
    expect(searchDemoContenders(candidates, 'contender 1').map((candidate) => candidate.label)).toEqual(['Contender 1', 'Contender 10', 'Contender 11', 'Contender 12', 'Contender 13', 'Contender 14', 'Contender 15', 'Contender 16'])
    expect(searchDemoContenders(candidates, '')).toEqual(candidates)
    expect(searchDemoContenders(candidates, 'missing identity')).toEqual([])
  })
})

describe('contested name browsing', () => {
  it('combines normalized name searches with status filters', () => {
    expect(getDemoContestPage(MASTERNODE_DEMO_CONTESTS, ' COFFEE.dash ', 'open', 1, 8).items.map((contest) => contest.name)).toEqual(['coffee'])
    expect(getDemoContestPage(MASTERNODE_DEMO_CONTESTS, 'coffee', 'ended', 1, 8).total).toBe(0)
    const open = getDemoContestPage(MASTERNODE_DEMO_CONTESTS, '', 'open', 1, 100)
    expect(open.items.every((contest) => contest.state === 'open')).toBe(true)
  })

  it('returns stable alphabetical pages without mutating the source', () => {
    const sourceOrder = MASTERNODE_DEMO_CONTESTS.map((contest) => contest.id)
    const first = getDemoContestPage(MASTERNODE_DEMO_CONTESTS, '', 'all', 1, 8)
    const second = getDemoContestPage(MASTERNODE_DEMO_CONTESTS, '', 'all', 2, 8)
    expect(first.total).toBeGreaterThan(30)
    expect(first.items).toHaveLength(8)
    expect(second.items).toHaveLength(8)
    expect(first.items[0].name).toBe('acorn')
    expect(new Set([...first.items, ...second.items].map((contest) => contest.id)).size).toBe(16)
    expect([...first.items, ...second.items].map((contest) => contest.name)).toEqual(MASTERNODE_DEMO_CONTESTS.map((contest) => contest.name).sort().slice(0, 16))
    expect(MASTERNODE_DEMO_CONTESTS.map((contest) => contest.id)).toEqual(sourceOrder)
  })

  it('clamps invalid and stale pages, including empty filtered results', () => {
    const last = getDemoContestPage(MASTERNODE_DEMO_CONTESTS, '', 'all', 999, 8)
    expect(last.page).toBe(last.pageCount)
    expect(last.items.length).toBeGreaterThan(0)
    expect(getDemoContestPage(MASTERNODE_DEMO_CONTESTS, '', 'all', -2, 8).page).toBe(1)
    expect(getDemoContestPage(MASTERNODE_DEMO_CONTESTS, '', 'all', Number.NaN, 8).page).toBe(1)
    expect(getDemoContestPage(MASTERNODE_DEMO_CONTESTS, 'not-a-name', 'all', 3, 8)).toEqual({ items: [], total: 0, page: 1, pageCount: 1 })
  })

  it('summarizes only connected nodes and distinguishes mixed choices', () => {
    const contest = MASTERNODE_DEMO_CONTESTS[0]
    const votes = [
      { contestId: contest.id, nodeId: 'mn-atlas', choice: 'abstain' },
      { contestId: contest.id, nodeId: 'mn-orbit', choice: 'lock' },
      { contestId: 'another-contest', nodeId: 'mn-atlas', choice: 'lock' },
    ]
    expect(demoContestVoteSummary(contest, votes, [])).toBe('No vote')
    expect(demoContestVoteSummary(contest, votes, [MASTERNODE_DEMO_FIXTURES[0]])).toBe('Abstain · 1')
    expect(demoContestVoteSummary(contest, votes, MASTERNODE_DEMO_FIXTURES)).toBe('Mixed choices · 2')
  })
})

describe('masternode demo voting authority', () => {
  it('requires an available voting key, not collateral ownership or an operator role', () => {
    expect(MASTERNODE_DEMO_FIXTURES.filter(canMasternodeVote).map((node) => node.id)).toEqual(['mn-atlas', 'mn-orbit', 'mn-lumen'])
    expect(canMasternodeVote({ ...MASTERNODE_DEMO_FIXTURES[1], availability: 'ready' })).toBe(false)
    expect(canMasternodeVote(MASTERNODE_DEMO_FIXTURES[3])).toBe(false)
  })

  it('deduplicates connections even when an incoming batch repeats a node', () => {
    const node = MASTERNODE_DEMO_FIXTURES[0]
    const other = MASTERNODE_DEMO_FIXTURES[2]
    expect(mergeDemoMasternodes([node], [node, other, other])).toEqual([node, other])
  })
})

describe('masternode demo vote results', () => {
  it('keeps successful votes, retries only failed nodes, and does not duplicate votes', () => {
    const results = simulateMasternodeVotes(MASTERNODE_DEMO_FIXTURES, ['mn-atlas', 'mn-orbit'])
    expect(results.map((result) => result.success)).toEqual([true, false])
    const firstVotes = applySuccessfulDemoVotes([], 'contest-satoshi', 'abstain', results)
    expect(firstVotes).toEqual([{ contestId: 'contest-satoshi', nodeId: 'mn-atlas', choice: 'abstain' }])
    const retried = simulateMasternodeVotes(MASTERNODE_DEMO_FIXTURES, results.filter((result) => !result.success).map((result) => result.nodeId), true)
    expect(retried.map((result) => result.nodeId)).toEqual(['mn-orbit'])
    const allVotes = applySuccessfulDemoVotes(firstVotes, 'contest-satoshi', 'abstain', retried)
    expect(allVotes).toHaveLength(2)
    expect(applySuccessfulDemoVotes(allVotes, 'contest-satoshi', 'abstain', retried)).toEqual(allVotes)
  })

  it('replaces a selected node vote without changing other nodes or contests', () => {
    const votes = [
      { contestId: 'contest-satoshi', nodeId: 'mn-atlas', choice: 'abstain' },
      { contestId: 'contest-satoshi', nodeId: 'mn-orbit', choice: 'abstain' },
      { contestId: 'contest-coffee', nodeId: 'mn-atlas', choice: 'lock' },
    ]
    const results = simulateMasternodeVotes(MASTERNODE_DEMO_FIXTURES, ['mn-atlas'])
    const next = applySuccessfulDemoVotes(votes, 'contest-satoshi', 'lock', results)
    expect(next).toHaveLength(3)
    expect(next).toContainEqual({ contestId: 'contest-satoshi', nodeId: 'mn-atlas', choice: 'lock' })
    expect(next).toContainEqual(votes[1])
    expect(next).toContainEqual(votes[2])
  })

  it('cannot make an unavailable node eligible by retrying', () => {
    expect(simulateMasternodeVotes(MASTERNODE_DEMO_FIXTURES, ['mn-vale', 'missing'], true).every((result) => !result.success)).toBe(true)
  })

  it('labels contender, abstain, and lock choices', () => {
    const contest = MASTERNODE_DEMO_CONTESTS[0]
    expect(demoVoteChoiceLabel(contest, contest.contenders[0].id)).toBe('Contender 1')
    expect(demoVoteChoiceLabel(contest, 'abstain')).toBe('Abstain')
    expect(demoVoteChoiceLabel(contest, 'lock')).toBe('Lock name')
  })
})
