import type { DemoMasternode, DemoNameContest, MasternodeContestFilter, MasternodeRole, MasternodeSource } from '@renderer/types/masternodesDemo'

export const MASTERNODE_CONTEST_PAGE_SIZE = 8
export const MASTERNODE_CANDIDATE_SEARCH_THRESHOLD = 6
export const MASTERNODE_CONTEST_COLUMNS = ['Name', 'Status', 'Contenders', 'Deadline', 'Your votes', '']
export const MASTERNODE_CONTEST_FILTERS: { value: MasternodeContestFilter; label: string }[] = [
  { value: 'all', label: 'All names' },
  { value: 'open', label: 'Open' },
  { value: 'ended', label: 'Ended' },
  { value: 'locked', label: 'Locked' },
]

export const MASTERNODE_CONTEST_NAMES = [
  'acorn', 'amber', 'atlas', 'bloom', 'bridge', 'cedar', 'cloud', 'coral',
  'delta', 'ember', 'fern', 'garden', 'harbor', 'indigo', 'juniper', 'kite',
  'lantern', 'maple', 'meadow', 'north', 'ocean', 'olive', 'orbit', 'pearl',
  'quartz', 'river', 'solar', 'spruce', 'summit', 'terra', 'violet', 'willow',
]

export const MASTERNODE_CORE_PREVIEWS = [
  { value: 'success', label: 'Connected · voting keys available' },
  { value: 'locked', label: 'Core wallet locked' },
  { value: 'unavailable', label: 'Core unavailable' },
]

export const MASTERNODE_SOURCE_LABELS: Record<MasternodeSource, string> = {
  wallet: 'Wallet discovery', core: 'Dash Core preview', manual: 'Sample voting key',
}

export const MASTERNODE_ROLE_LABELS: Record<MasternodeRole, string> = {
  owner: 'Owner', voter: 'Voting delegate', operator: 'Operator',
}

export const MASTERNODE_DEMO_FIXTURES: DemoMasternode[] = [
  { id: 'mn-atlas', label: 'Atlas', proTxHash: 'demo-protx-atlas-7bd3…0fe1', address: '192.0.2.24:9999', source: 'wallet', roles: ['owner', 'voter'], availability: 'ready', collateralOwned: true },
  { id: 'mn-cedar', label: 'Cedar', proTxHash: 'demo-protx-cedar-9fa1…2bc7', address: '192.0.2.88:9999', source: 'wallet', roles: ['owner'], availability: 'missing-key', collateralOwned: true },
  { id: 'mn-orbit', label: 'Orbit', proTxHash: 'demo-protx-orbit-4ce9…81a0', address: '198.51.100.12:9999', source: 'core', roles: ['voter'], availability: 'ready', collateralOwned: false, failFirstVote: true },
  { id: 'mn-north', label: 'North', proTxHash: 'demo-protx-north-1dc2…f931', address: '198.51.100.41:9999', source: 'core', roles: ['operator'], availability: 'missing-key', collateralOwned: false },
  { id: 'mn-lumen', label: 'Lumen', proTxHash: 'demo-protx-lumen-6ab2…9dd0', address: '203.0.113.19:9999', source: 'manual', roles: ['voter'], availability: 'ready', collateralOwned: false },
  { id: 'mn-vale', label: 'Vale', proTxHash: 'demo-protx-vale-8ef0…71c4', address: '203.0.113.72:9999', source: 'manual', roles: ['voter'], availability: 'offline', collateralOwned: false },
]

export const MASTERNODE_DEMO_CONTESTS: DemoNameContest[] = [
  { id: 'contest-satoshi', name: 'satoshi', state: 'open', duration: 'Illustrative: 3 days left', abstain: 18, lock: 6, contenders: [
    { id: 'identity-satoshi-a', label: 'Contender 1', identity: 'demo-identity-7nQ4…kR2m', requested: 'First request', votes: 142 },
    { id: 'identity-satoshi-b', label: 'Contender 2', identity: 'demo-identity-3pW8…tL6a', requested: 'Second request', votes: 96 },
  ] },
  { id: 'contest-coffee', name: 'coffee', state: 'open', duration: 'Illustrative: 1 day left', abstain: 11, lock: 3, contenders: [
    { id: 'identity-coffee-a', label: 'Contender 1', identity: 'demo-identity-9cD2…vB5x', requested: 'First request', votes: 83 },
    { id: 'identity-coffee-b', label: 'Contender 2', identity: 'demo-identity-2hF6…aN8z', requested: 'Second request', votes: 72 },
  ] },
  { id: 'contest-dash', name: 'dash', state: 'locked', duration: 'Voting closed · name locked', abstain: 24, lock: 312, contenders: [
    { id: 'identity-dash-a', label: 'Contender 1', identity: 'demo-identity-4aJ8…wC3r', requested: 'First request', votes: 39 },
  ] },
  { id: 'contest-studio', name: 'studio', state: 'ended', duration: 'Voting ended · Contender 1 won', abstain: 8, lock: 2, contenders: [
    { id: 'identity-studio-a', label: 'Contender 1', identity: 'demo-identity-5mP3…bT9q', requested: 'First request', votes: 208 },
    { id: 'identity-studio-b', label: 'Contender 2', identity: 'demo-identity-8rS1…dG4u', requested: 'Second request', votes: 57 },
  ] },
  ...MASTERNODE_CONTEST_NAMES.map((name, index): DemoNameContest => ({
    id: `contest-${name}`,
    name,
    state: index % 7 === 0 ? 'locked' : index % 5 === 0 ? 'ended' : 'open',
    duration: index % 7 === 0 ? 'Voting closed · name locked' : index % 5 === 0 ? 'Voting ended · Contender 1 won' : `Illustrative: ${index % 6 + 1} days left`,
    abstain: 4 + index,
    lock: index % 7 === 0 ? 210 + index : 2 + index,
    contenders: [
      { id: `identity-${name}-a`, label: 'Contender 1', identity: `demo-identity-${name}-a`, requested: 'First request', votes: 65 + index * 3 },
      { id: `identity-${name}-b`, label: 'Contender 2', identity: `demo-identity-${name}-b`, requested: 'Second request', votes: 38 + index * 2 },
      ...(index % 4 === 0 ? [{ id: `identity-${name}-c`, label: 'Contender 3', identity: `demo-identity-${name}-c`, requested: 'Third request', votes: 19 + index }] : []),
      ...(name === 'atlas' ? Array.from({ length: 14 }, (_, candidateIndex) => ({
        id: `identity-atlas-${candidateIndex + 3}`,
        label: `Contender ${candidateIndex + 3}`,
        identity: `demo-identity-atlas-${candidateIndex + 3}`,
        requested: `Request ${candidateIndex + 3}`,
        votes: 12 + candidateIndex * 2,
      })) : []),
    ],
  })),
]

export const MASTERNODE_IMPORT_SOURCES: { value: MasternodeSource; label: string; detail: string }[] = [
  { value: 'wallet', label: 'Discover from wallet', detail: 'Preview nodes linked to sample wallet keys.' },
  { value: 'core', label: 'Connect Dash Core', detail: 'Explore a simulated Core connection.' },
  { value: 'manual', label: 'Import voting key', detail: 'Use a masked synthetic sample.' },
]

export const MASTERNODE_MASKED_SAMPLE = 'demo-only · •••• •••• •••• ••••'
