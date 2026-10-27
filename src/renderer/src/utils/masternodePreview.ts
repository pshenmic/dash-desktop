import type { Network } from '@renderer/api/types'
import { CONTEST_JOIN_WINDOW_MS, VOTE_POLL_DURATION_MS } from '@renderer/constants/dpns'
import { ADDRESS_RULES, ENDING_SOON_MS, MASTERNODE_VOTE_WEIGHT, NODE_ELIGIBILITY_LABELS } from '@renderer/constants/masternodes'
import { PREVIEW_BACKEND_ERRORS, PREVIEW_FNV, PREVIEW_LCG } from '@renderer/constants/masternodePreview'
import {
  MASTERNODE_PREVIEW_PRESETS,
  PREVIEW_ABSTAIN_VOTES,
  PREVIEW_BANNED_POSE_PENALTY,
  PREVIEW_BASE58_ALPHABET,
  PREVIEW_CAPITALIZED_LABEL_RATE,
  PREVIEW_CHAIN_HEIGHT,
  PREVIEW_CONTENDER_NAMES,
  PREVIEW_CONTENDER_VOTES,
  PREVIEW_CONTEST_MIX,
  PREVIEW_CONTEST_PHASE_STATUS,
  PREVIEW_CONTEST_SUFFIXES,
  PREVIEW_CONTEST_WORDS,
  PREVIEW_ENDED_AGE_MS,
  PREVIEW_ENDED_CONTEST_VOTERS,
  PREVIEW_FALLBACK_STEM,
  PREVIEW_FIND_BY_KEY_NODES,
  PREVIEW_HEX_ALPHABET,
  PREVIEW_IDENTIFIER_LENGTH,
  PREVIEW_IPV4_OCTETS,
  PREVIEW_IPV4_SEPARATOR,
  PREVIEW_LAST_PAID_AGE_BLOCKS,
  PREVIEW_LOCK_VOTES,
  PREVIEW_NAMED_CONTESTS,
  PREVIEW_NAMED_OPEN_PROGRESS,
  PREVIEW_NO_MATCH_PROTX_SUFFIX,
  PREVIEW_NO_MATCH_WIF_SUFFIX,
  PREVIEW_NODE_ADDED_AGE_MS,
  PREVIEW_NODE_COPY_SEPARATOR,
  PREVIEW_NODE_PORTS,
  PREVIEW_NODE_VOTES,
  PREVIEW_OPEN_CONTEST_VOTERS,
  PREVIEW_OUR_VOTE_MIX,
  PREVIEW_PROGRESS_MARGIN,
  PREVIEW_PROTX_HASH_LENGTH,
  PREVIEW_REGISTERED_AGE_BLOCKS,
  PREVIEW_SEED_SALTS,
  PREVIEW_STEM_TOKEN,
  PREVIEW_UNNAMED_CONTENDER_RATE,
  PREVIEW_WATCHED_NODE,
} from '@renderer/constants/masternodePreviewData'
import {
  ContestStatus,
  MasternodeAccess,
  MasternodePreviewPreset,
  MasternodeStatus,
  NodeVoteEligibility,
  PreviewContestPhase,
  VoteChoiceKind,
  VotingKeyInputKind,
} from '@renderer/enums/Masternodes'
import type {
  ContestContenderDto,
  MasternodeDto,
  MasternodeVoteDto,
  MasternodeVoteResultDto,
  NameContestDto,
  VoteChoiceDto,
} from '@renderer/types/Masternodes'
import type {
  PreviewContestTiming,
  PreviewIdentity,
  PreviewNamedContestSpec,
  PreviewNodeSpec,
  PreviewRandom,
  PreviewRange,
  PreviewUpdate,
  PreviewWalletInput,
  PreviewWalletState,
} from '@renderer/types/Preview'
import { normalizeDpnsLabel, stripDpnsInput } from './dpnsLabel'
import { applyVoteResults, canVote, nodeVoteEligibility, nodeVoteOn } from './masternodes'
import { applyChoiceToContest, isEndingSoon, rankContenders } from './nameContests'
import { classifyVotingKeyInput, isProTxHash } from './votingKey'

export function hashSeed(text: string): number {
  let hash = PREVIEW_FNV.offsetBasis
  for (const char of text) hash = Math.imul(hash ^ char.charCodeAt(0), PREVIEW_FNV.prime) >>> 0
  return hash
}

export function previewSeed(walletId: string, salt: string): number {
  return hashSeed(`${walletId}:${salt}`)
}

export function seededRandom(seed: number): PreviewRandom {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, PREVIEW_LCG.multiplier) + PREVIEW_LCG.increment) >>> 0
    return state / PREVIEW_LCG.modulus
  }
}

function randomInt(random: PreviewRandom, range: PreviewRange): number {
  return range.min + Math.floor(random() * (range.max - range.min + 1))
}

function randomBetween(random: PreviewRandom, min: number, max: number): number {
  return min + random() * (max - min)
}

function randomString(random: PreviewRandom, alphabet: string, length: number): string {
  return Array.from({ length }, () => alphabet[Math.floor(random() * alphabet.length)]).join('')
}

function shuffled<T>(random: PreviewRandom, items: readonly T[]): T[] {
  const copy = [...items]
  for (let index = copy.length - 1; index > 0; index--) {
    const swap = Math.floor(random() * (index + 1))
    const held = copy[index]
    copy[index] = copy[swap]
    copy[swap] = held
  }
  return copy
}

function repeated<T>(value: T, count: number): T[] {
  return Array.from({ length: Math.max(0, count) }, () => value)
}

function rotation<T>(items: T[], start: number, count: number): T[] {
  return Array.from({ length: Math.min(count, items.length) }, (_, offset) => items[(start + offset) % items.length])
}

function byIdentityIndex(identities: PreviewIdentity[]): PreviewIdentity[] {
  return [...identities].sort((a, b) => a.identityIndex - b.identityIndex)
}

function copyLabel(label: string, copy: number): string {
  return copy === 0 ? label : `${label}${PREVIEW_NODE_COPY_SEPARATOR}${copy + 1}`
}

function previewNode(spec: PreviewNodeSpec, label: string, random: PreviewRandom, network: Network, now: number): MasternodeDto {
  const height = PREVIEW_CHAIN_HEIGHT[network]
  const payout = ADDRESS_RULES[network]
  return {
    proTxHash: randomString(random, PREVIEW_HEX_ALPHABET, PREVIEW_PROTX_HASH_LENGTH),
    label,
    type: spec.type,
    status: spec.status,
    posePenalty: spec.status === MasternodeStatus.PoseBanned ? randomInt(random, PREVIEW_BANNED_POSE_PENALTY) : 0,
    service: `${PREVIEW_IPV4_OCTETS.map(range => randomInt(random, range)).join(PREVIEW_IPV4_SEPARATOR)}:${PREVIEW_NODE_PORTS[network]}`,
    registeredHeight: height - randomInt(random, PREVIEW_REGISTERED_AGE_BLOCKS),
    lastPaidHeight: spec.status === MasternodeStatus.Active ? height - randomInt(random, PREVIEW_LAST_PAID_AGE_BLOCKS) : null,
    payoutAddress: `${payout.prefixes[0]}${randomString(random, PREVIEW_BASE58_ALPHABET, payout.lengths[0] - payout.prefixes[0].length)}`,
    access: spec.access,
    addedAt: now - randomInt(random, PREVIEW_NODE_ADDED_AGE_MS),
  }
}

export function buildPreviewNodes(preset: MasternodePreviewPreset, seed: number, network: Network, now: number): MasternodeDto[] {
  const { base, copies } = MASTERNODE_PREVIEW_PRESETS[preset]
  const random = seededRandom(seed)
  return Array.from({ length: copies }, (_, copy) => base.map(spec => previewNode(spec, copyLabel(spec.label, copy), random, network, now))).flat()
}

export function previewStem(identities: PreviewIdentity[]): string {
  const username = byIdentityIndex(identities)[0]?.usernames[0]
  return username == null ? PREVIEW_FALLBACK_STEM : stripDpnsInput(username)
}

export function resolvePreviewLabel(template: string, stem: string): string {
  return template.replace(PREVIEW_STEM_TOKEN, stem)
}

function openTiming(progress: number, now: number, network: Network): PreviewContestTiming {
  const startedAt = Math.round(now - progress * VOTE_POLL_DURATION_MS[network])
  return {
    startedAt,
    joinClosesAt: startedAt + CONTEST_JOIN_WINDOW_MS[network],
    endsAt: startedAt + VOTE_POLL_DURATION_MS[network],
  }
}

function endedTiming(endedAgo: number, now: number, network: Network): PreviewContestTiming {
  const endsAt = now - endedAgo
  const startedAt = endsAt - VOTE_POLL_DURATION_MS[network]
  return { startedAt, joinClosesAt: startedAt + CONTEST_JOIN_WINDOW_MS[network], endsAt }
}

function phaseTiming(phase: PreviewContestPhase, random: PreviewRandom, now: number, network: Network): PreviewContestTiming {
  const joinShare = CONTEST_JOIN_WINDOW_MS[network] / VOTE_POLL_DURATION_MS[network]
  const soonShare = ENDING_SOON_MS[network] / VOTE_POLL_DURATION_MS[network]
  const margin = PREVIEW_PROGRESS_MARGIN
  switch (phase) {
    case PreviewContestPhase.JoinOpen:
      return openTiming(randomBetween(random, margin, joinShare - margin), now, network)
    case PreviewContestPhase.Running:
      return openTiming(randomBetween(random, joinShare + margin, 1 - soonShare - margin), now, network)
    case PreviewContestPhase.EndingSoon:
      return openTiming(1 - soonShare * randomBetween(random, margin, 1 - margin), now, network)
    default:
      return endedTiming(randomInt(random, PREVIEW_ENDED_AGE_MS), now, network)
  }
}

function requestedLabel(random: PreviewRandom, label: string): string {
  return random() < PREVIEW_CAPITALIZED_LABEL_RATE ? `${label.charAt(0).toUpperCase()}${label.slice(1)}` : label
}

function fixtureContender(
  random: PreviewRandom,
  label: string,
  name: string,
  votes: number,
  timing: PreviewContestTiming,
  now: number,
): ContestContenderDto {
  return {
    identifier: randomString(random, PREVIEW_BASE58_ALPHABET, PREVIEW_IDENTIFIER_LENGTH),
    displayName: random() < PREVIEW_UNNAMED_CONTENDER_RATE ? null : name,
    requestedLabel: requestedLabel(random, label),
    votes,
    requestedAt: randomInt(random, { min: timing.startedAt, max: Math.min(timing.joinClosesAt, now) }),
  }
}

function fixtureContenders(random: PreviewRandom, label: string, count: number, timing: PreviewContestTiming, now: number): ContestContenderDto[] {
  return shuffled(random, PREVIEW_CONTENDER_NAMES)
    .slice(0, count)
    .map(name => fixtureContender(random, label, name, randomInt(random, PREVIEW_CONTENDER_VOTES), timing, now))
}

function walletContender(identity: PreviewIdentity, label: string, votes: number, timing: PreviewContestTiming): ContestContenderDto {
  return {
    identifier: identity.identifier,
    displayName: identity.usernames[0] ?? null,
    requestedLabel: label,
    votes,
    requestedAt: timing.startedAt,
  }
}

function topContender(contenders: ContestContenderDto[]): ContestContenderDto | undefined {
  return contenders.reduce<ContestContenderDto | undefined>((top, contender) => (top == null || contender.votes > top.votes ? contender : top), undefined)
}

function awardTo(contest: NameContestDto, winner: ContestContenderDto): NameContestDto {
  const rival = Math.max(contest.votesLock, ...contest.contenders.filter(contender => contender !== winner).map(contender => contender.votes))
  const votes = Math.max(winner.votes, rival + 1)
  return {
    ...contest,
    winnerId: winner.identifier,
    contenders: contest.contenders.map(contender => (contender === winner ? { ...contender, votes } : contender)),
  }
}

function settleContest(contest: NameContestDto, winner: ContestContenderDto | undefined): NameContestDto {
  if (contest.status === ContestStatus.Awarded) return winner == null ? contest : awardTo(contest, winner)
  if (contest.status !== ContestStatus.Locked) return contest
  const top = Math.max(0, ...contest.contenders.map(contender => contender.votes))
  return { ...contest, votesLock: Math.max(contest.votesLock, top + 1) }
}

function namedContest(
  spec: PreviewNamedContestSpec,
  random: PreviewRandom,
  now: number,
  network: Network,
  stem: string,
  identities: PreviewIdentity[],
): NameContestDto {
  const label = resolvePreviewLabel(spec.label, stem)
  const timing = spec.status === ContestStatus.Open
    ? openTiming(PREVIEW_NAMED_OPEN_PROGRESS, now, network)
    : endedTiming(randomInt(random, PREVIEW_ENDED_AGE_MS), now, network)
  const index = spec.walletContenderIndex
  const own = index == null ? [] : [identities[index] == null
    ? fixtureContender(random, label, PREVIEW_CONTENDER_NAMES[index % PREVIEW_CONTENDER_NAMES.length], spec.walletVotes, timing, now)
    : walletContender(identities[index], label, spec.walletVotes, timing)]
  const others = fixtureContenders(random, label, spec.contenders - own.length, timing, now)
  return settleContest({
    normalizedLabel: normalizeDpnsLabel(label),
    label,
    status: spec.status,
    contenders: [...own, ...others],
    votesLock: spec.votesLock,
    votesAbstain: spec.votesAbstain,
    ...timing,
    winnerId: null,
  }, others[0] ?? own[0])
}

function generatedContest(label: string, phase: PreviewContestPhase, random: PreviewRandom, now: number, network: Network): NameContestDto {
  const timing = phaseTiming(phase, random, now, network)
  const count = randomInt(random, { min: PREVIEW_CONTEST_MIX.minContenders, max: PREVIEW_CONTEST_MIX.maxContenders })
  const contenders = fixtureContenders(random, label, count, timing, now)
  const votesLock = randomInt(random, PREVIEW_LOCK_VOTES)
  const votesAbstain = randomInt(random, PREVIEW_ABSTAIN_VOTES)
  const noWinner = phase === PreviewContestPhase.NoWinner
  return settleContest({
    normalizedLabel: normalizeDpnsLabel(label),
    label,
    status: PREVIEW_CONTEST_PHASE_STATUS[phase],
    contenders: noWinner ? [] : contenders,
    votesLock: noWinner ? 0 : votesLock,
    votesAbstain,
    ...timing,
    winnerId: null,
  }, topContender(contenders))
}

function settledContest(contest: NameContestDto): NameContestDto {
  const [top] = rankContenders(contest.contenders)
  if (top == null) return { ...contest, status: ContestStatus.NoWinner }
  if (contest.votesLock > top.votes) return { ...contest, status: ContestStatus.Locked }
  return { ...contest, status: ContestStatus.Awarded, winnerId: top.identifier }
}

export function settleExpiredContests(contests: NameContestDto[], now: number): NameContestDto[] {
  return contests.map(contest => (contest.status === ContestStatus.Open && contest.endsAt <= now ? settledContest(contest) : contest))
}

function generatedPhases(named: NameContestDto[], now: number, network: Network): PreviewContestPhase[] {
  const open = named.filter(contest => contest.status === ContestStatus.Open)
  const ended = (status: ContestStatus): number => named.filter(contest => contest.status === status).length
  const endingSoon = PREVIEW_CONTEST_MIX.endingSoon - open.filter(contest => isEndingSoon(contest, now, network)).length
  const joinOpen = PREVIEW_CONTEST_MIX.joinOpen - open.filter(contest => now < contest.joinClosesAt).length
  return [
    ...repeated(PreviewContestPhase.EndingSoon, endingSoon),
    ...repeated(PreviewContestPhase.JoinOpen, joinOpen),
    ...repeated(PreviewContestPhase.Running, PREVIEW_CONTEST_MIX.open - open.length - Math.max(0, endingSoon) - Math.max(0, joinOpen)),
    ...repeated(PreviewContestPhase.Awarded, PREVIEW_CONTEST_MIX.awarded - ended(ContestStatus.Awarded)),
    ...repeated(PreviewContestPhase.Locked, PREVIEW_CONTEST_MIX.locked - ended(ContestStatus.Locked)),
    ...repeated(PreviewContestPhase.NoWinner, PREVIEW_CONTEST_MIX.noWinner - ended(ContestStatus.NoWinner)),
  ]
}

function generatedLabels(random: PreviewRandom, count: number, taken: ReadonlySet<string>): string[] {
  const labels = PREVIEW_CONTEST_SUFFIXES.flatMap(suffix => PREVIEW_CONTEST_WORDS.map(word => `${word}${suffix}`))
  return shuffled(random, labels.filter(label => !taken.has(normalizeDpnsLabel(label)))).slice(0, count)
}

export function buildPreviewContests(seed: number, now: number, network: Network, identities: PreviewIdentity[]): NameContestDto[] {
  const random = seededRandom(seed)
  const ordered = byIdentityIndex(identities)
  const stem = previewStem(ordered)
  const named = PREVIEW_NAMED_CONTESTS.map(spec => namedContest(spec, random, now, network, stem, ordered))
  const phases = shuffled(random, generatedPhases(named, now, network))
  const labels = generatedLabels(random, phases.length, new Set(named.map(contest => contest.normalizedLabel)))
  return [...named, ...labels.map((label, index) => generatedContest(label, phases[index], random, now, network))]
}

function leaderChoice(contest: NameContestDto): VoteChoiceDto {
  const identifier = contest.winnerId ?? topContender(contest.contenders)?.identifier ?? null
  return identifier == null
    ? { kind: VoteChoiceKind.Abstain, identifier: null }
    : { kind: VoteChoiceKind.TowardsIdentity, identifier }
}

export function buildPreviewVotes(nodes: MasternodeDto[], contests: NameContestDto[], stem: string, now: number): MasternodeVoteDto[] {
  const voters = nodes.filter(canVote)
  if (voters.length === 0) return []
  const issueVoters = nodes.filter(node => node.access === MasternodeAccess.VotingKey && !canVote(node))
  const votes = new Map<string, MasternodeVoteDto>()
  const cast = (node: MasternodeDto, contest: NameContestDto, choice: VoteChoiceDto, votesUsed: number): void => {
    votes.set(`${node.proTxHash}:${contest.normalizedLabel}`, {
      proTxHash: node.proTxHash,
      normalizedLabel: contest.normalizedLabel,
      choice,
      votesUsed,
      castAt: Math.round((contest.startedAt + Math.min(now, contest.endsAt)) / 2),
    })
  }

  const targets = contests.filter(contest => contest.status === ContestStatus.Open).slice(0, PREVIEW_OUR_VOTE_MIX.open)
  const issueFrom = targets.length - PREVIEW_OUR_VOTE_MIX.openIssueNodeOnly
  const mixedFrom = issueFrom - PREVIEW_OUR_VOTE_MIX.openMixed
  targets.forEach((contest, index) => {
    const choice = leaderChoice(contest)
    if (index >= issueFrom) {
      issueVoters.slice(0, 1).forEach(node => cast(node, contest, choice, 1))
      return
    }
    rotation(voters, index * PREVIEW_OPEN_CONTEST_VOTERS, PREVIEW_OPEN_CONTEST_VOTERS).forEach((node, position) => {
      const lock = index >= mixedFrom && position === 0
      cast(node, contest, lock ? { kind: VoteChoiceKind.Lock, identifier: null } : choice, 1)
    })
  })

  contests
    .filter(contest => contest.status === ContestStatus.Awarded)
    .slice(0, PREVIEW_OUR_VOTE_MIX.ended)
    .forEach((contest, index) => {
      rotation(voters, index * PREVIEW_ENDED_CONTEST_VOTERS, PREVIEW_ENDED_CONTEST_VOTERS)
        .forEach(node => cast(node, contest, leaderChoice(contest), 1))
    })

  for (const spec of PREVIEW_NODE_VOTES) {
    const node = nodes.find(candidate => candidate.label === spec.node)
    const contest = contests.find(candidate => candidate.label === resolvePreviewLabel(spec.contest, stem))
    if (node != null && contest != null) cast(node, contest, leaderChoice(contest), spec.votesUsed)
  }

  return [...votes.values()]
}

export function buildPreviewWallet({ walletId, network, now, preset, identities }: PreviewWalletInput): PreviewWalletState {
  const nodes = buildPreviewNodes(preset, previewSeed(walletId, PREVIEW_SEED_SALTS.nodes), network, now)
  const contests = buildPreviewContests(previewSeed(walletId, PREVIEW_SEED_SALTS.contests), now, network, identities)
  const failing = new Set(MASTERNODE_PREVIEW_PRESETS[preset].base.filter(spec => spec.failNextVote).map(spec => spec.label))
  return {
    walletId,
    network,
    seededAt: now,
    nodes,
    contests,
    votes: buildPreviewVotes(nodes, contests, previewStem(identities), now),
    failNextVote: nodes.filter(node => failing.has(node.label)).map(node => node.proTxHash),
  }
}

function keyCandidates(state: PreviewWalletState): MasternodeDto[] {
  const random = seededRandom(previewSeed(state.walletId, PREVIEW_SEED_SALTS.keyNodes))
  return PREVIEW_FIND_BY_KEY_NODES.map(spec => previewNode(spec, spec.label, random, state.network, state.seededAt))
}

export function findPreviewNodesByVotingKey(state: PreviewWalletState, votingKey: string, expectedProTxHash?: string): MasternodeDto[] {
  const value = votingKey.trim()
  if (classifyVotingKeyInput(value, state.network) !== VotingKeyInputKind.Valid) return []
  if (value.endsWith(PREVIEW_NO_MATCH_WIF_SUFFIX)) return []
  const candidates = keyCandidates(state)
  const expected = state.nodes.find(node => node.proTxHash === expectedProTxHash)
  return expected == null ? candidates : [expected, ...candidates.filter(node => node.proTxHash !== expected.proTxHash)]
}

export function findPreviewNode(state: PreviewWalletState, proTxHash: string): MasternodeDto | null {
  const hash = proTxHash.trim().toLowerCase()
  const known = state.nodes.find(node => node.proTxHash === hash) ?? keyCandidates(state).find(node => node.proTxHash === hash)
  if (known != null) return known
  if (!isProTxHash(hash) || hash.endsWith(PREVIEW_NO_MATCH_PROTX_SUFFIX)) return null
  const node = previewNode(PREVIEW_WATCHED_NODE, PREVIEW_WATCHED_NODE.label, seededRandom(hashSeed(hash)), state.network, state.seededAt)
  return { ...node, proTxHash: hash }
}

export function addPreviewNodes(state: PreviewWalletState, proTxHashes: string[], withVotingKey: boolean, now: number): PreviewWalletState {
  const access = withVotingKey ? MasternodeAccess.VotingKey : MasternodeAccess.WatchOnly
  const requested = new Set(proTxHashes.map(hash => hash.trim().toLowerCase()))
  const existing = new Set(state.nodes.map(node => node.proTxHash))
  const added = [...requested]
    .filter(hash => !existing.has(hash))
    .flatMap(hash => {
      const node = findPreviewNode(state, hash)
      return node == null ? [] : [{ ...node, access, addedAt: now }]
    })
  return {
    ...state,
    nodes: [
      ...state.nodes.map(node => (withVotingKey && requested.has(node.proTxHash) ? { ...node, access } : node)),
      ...added,
    ],
  }
}

export function removePreviewNode(state: PreviewWalletState, proTxHash: string): PreviewWalletState {
  return {
    ...state,
    nodes: state.nodes.filter(node => node.proTxHash !== proTxHash),
    votes: state.votes.filter(vote => vote.proTxHash !== proTxHash),
    failNextVote: state.failNextVote.filter(hash => hash !== proTxHash),
  }
}

function previewVoteResult(
  state: PreviewWalletState,
  contest: NameContestDto,
  choice: VoteChoiceDto,
  proTxHash: string,
  now: number,
): MasternodeVoteResultDto {
  const node = state.nodes.find(candidate => candidate.proTxHash === proTxHash)
  const eligibility = node == null
    ? NodeVoteEligibility.NotListed
    : nodeVoteEligibility(node, nodeVoteOn(state.votes, proTxHash, contest.normalizedLabel), choice, contest, now)
  if (eligibility !== NodeVoteEligibility.Eligible) return { proTxHash, ok: false, error: NODE_ELIGIBILITY_LABELS[eligibility] }
  if (state.failNextVote.includes(proTxHash)) return { proTxHash, ok: false, error: PREVIEW_BACKEND_ERRORS.voteRejected }
  return { proTxHash, ok: true, error: null }
}

export function castPreviewVotes(
  state: PreviewWalletState,
  normalizedLabel: string,
  choice: VoteChoiceDto,
  proTxHashes: string[],
  now: number,
): PreviewUpdate<MasternodeVoteResultDto[]> | null {
  const contest = state.contests.find(candidate => candidate.normalizedLabel === normalizedLabel)
  if (contest == null) return null
  const results = proTxHashes.map(proTxHash => previewVoteResult(state, contest, choice, proTxHash, now))
  const succeeded = new Set(results.filter(result => result.ok).map(result => result.proTxHash))
  const rejected = new Set(results.filter(result => result.error === PREVIEW_BACKEND_ERRORS.voteRejected).map(result => result.proTxHash))
  const tallied = state.nodes
    .filter(node => succeeded.has(node.proTxHash))
    .reduce((current, node) => applyChoiceToContest(
      current,
      nodeVoteOn(state.votes, node.proTxHash, normalizedLabel)?.choice ?? null,
      choice,
      MASTERNODE_VOTE_WEIGHT[node.type],
    ), contest)
  return {
    state: {
      ...state,
      contests: state.contests.map(candidate => (candidate === contest ? tallied : candidate)),
      votes: applyVoteResults(state.votes, results, normalizedLabel, choice, now),
      failNextVote: state.failNextVote.filter(hash => !rejected.has(hash)),
    },
    result: results,
  }
}
