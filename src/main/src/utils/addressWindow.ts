import {GapEntry} from '../types/AddressDiscovery'
import {
  AddressDeriver,
  DerivedAddress,
  UsageOracle,
  AddressWindowPlan,
  AddressWindowPolicy,
  AddressWindowStore,
} from '../types/AddressWindow'

function highestIndex(entries: GapEntry[], predicate: (entry: GapEntry) => boolean): number {
  let max = -1
  for (const entry of entries) {
    if (predicate(entry) && entry.index > max) max = entry.index
  }
  return max
}

// `known` is what the store has materialised; `usage` is what an oracle just
// observed, which may reach past it. So the frontier grows from observed usage
// while contiguity is judged against what actually exists.
//
// `batch` widens an extension past the gap limit once one is needed at all. The
// limit is a floor on how far to look, so overshooting it only widens the watch
// set — but landing exactly on it means the next used address exhausts the gap
// again, and for the cfilter scan each of those costs a rewind.
export function planWindow(known: GapEntry[], usage: GapEntry[], policy: AddressWindowPolicy): AddressWindowPlan {
  const maxIndex = highestIndex(known, () => true)
  const lastUsed = Math.max(
    highestIndex(known, entry => entry.isUsed),
    highestIndex(usage, entry => entry.isUsed),
  )

  const frontier = maxIndex >= lastUsed + policy.gapLimit
    ? maxIndex
    : Math.max(lastUsed + policy.gapLimit, maxIndex + policy.batch)

  const present = new Set(known.map(entry => entry.index))
  const refill: number[] = []
  for (let index = 0; index <= maxIndex; index++) {
    if (!present.has(index)) refill.push(index)
  }

  const extend: number[] = []
  for (let index = maxIndex + 1; index <= frontier; index++) extend.push(index)

  return {refill, extend}
}

// Derives whatever the plan asks for and hands it to the store in one write.
async function reveal(
  deriver: AddressDeriver,
  store: AddressWindowStore,
  plan: AddressWindowPlan,
): Promise<DerivedAddress[]> {
  const indexes = [...plan.refill, ...plan.extend]
  if (indexes.length === 0) return []

  const addresses = indexes.map(index => deriver.derive(index))
  await store.reveal(addresses)
  return addresses
}

async function markNewlyUsed(store: AddressWindowStore, known: GapEntry[], usage: GapEntry[]): Promise<void> {
  const stored = new Map(known.map(entry => [entry.index, entry.isUsed]))
  const indexes = usage
    .filter(entry => entry.isUsed && stored.get(entry.index) !== true)
    .map(entry => entry.index)
  if (indexes.length > 0) await store.markUsed(indexes)
}

// The scan already walked the gap to the frontier, so one pass replaces the
// widening rounds. Revealing before marking is what lets it mark a used index
// that sat past the old frontier.
async function applyScan(
  deriver: AddressDeriver,
  store: AddressWindowStore,
  policy: AddressWindowPolicy,
  usage: GapEntry[],
): Promise<DerivedAddress[]> {
  const known = await store.known()
  const revealed = await reveal(deriver, store, planWindow(known, usage, policy))
  await markNewlyUsed(store, known, usage)
  return revealed
}

async function widen(
  deriver: AddressDeriver,
  oracle: UsageOracle,
  store: AddressWindowStore,
  policy: AddressWindowPolicy,
): Promise<DerivedAddress[]> {
  const added: DerivedAddress[] = []

  for (let round = 0; round < policy.maxRounds; round++) {
    const known = await store.known()
    const unused = known.filter(entry => !entry.isUsed).map(entry => deriver.derive(entry.index))
    const usage = unused.length > 0 ? await oracle.probe(unused) : []
    await markNewlyUsed(store, known, usage)

    const plan = planWindow(known, usage, policy)
    if (plan.refill.length === 0 && plan.extend.length === 0) break
    added.push(...await reveal(deriver, store, plan))
  }

  return added
}

// One gap walk for one chain of one key class. Everything that differs between
// L1, platform and any future class is behind the three collaborators.
export async function runAddressWindow(
  deriver: AddressDeriver,
  oracle: UsageOracle,
  store: AddressWindowStore,
  policy: AddressWindowPolicy,
): Promise<DerivedAddress[]> {
  const scanned = await oracle.scan(policy.gapLimit)
  return scanned != null
    ? applyScan(deriver, store, policy, scanned)
    : widen(deriver, oracle, store, policy)
}
