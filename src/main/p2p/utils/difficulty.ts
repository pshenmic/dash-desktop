import {dgwNextBitsRange} from 'crypto-toothpick'
import {Network} from '../../src/types/Network'
import {bitsToTarget, targetToCompact} from './pow'
import {
  ALLOW_MIN_DIFFICULTY,
  DGW_ACTIVATION_HEIGHT,
  DGW_PAST_BLOCKS,
  DGW_TOLERANCE,
  DGW_TOLERANCE_HEIGHT,
  DIFFICULTY_ADJUSTMENT_INTERVAL,
  KGW_ACTIVATION_HEIGHT,
  KGW_PAST_BLOCKS_MAX,
  KGW_PAST_BLOCKS_MIN,
  MIN_DIFFICULTY_RESET_S,
  POW_LIMIT_BITS,
  POW_LIMIT_TARGET,
  POW_TARGET_SPACING,
  POW_TARGET_TIMESPAN,
} from '../constants'
import type {DifficultyBlock, DifficultyLookup} from '../types/difficulty'

// Dash's three retarget eras, mirroring src/pow.cpp. Every arithmetic detail is
// consensus, down to the order of the truncating divisions.

// CalculateNextWorkRequired.
function retargetOver(last: DifficultyBlock, firstBlockTime: number): number {
  let timespan = last.time - firstBlockTime
  if (timespan < POW_TARGET_TIMESPAN / 4) timespan = POW_TARGET_TIMESPAN / 4
  if (timespan > POW_TARGET_TIMESPAN * 4) timespan = POW_TARGET_TIMESPAN * 4

  let next = (bitsToTarget(last.nBits) * BigInt(timespan)) / BigInt(POW_TARGET_TIMESPAN)
  if (next > POW_LIMIT_TARGET) next = POW_LIMIT_TARGET
  return targetToCompact(next)
}

// GetNextWorkRequiredBTC — Bitcoin's interval retarget, which Dash used before
// KGW. Its min-difficulty rule is its own, not the one in expectedBits.
function intervalRetarget(
  network: Network,
  last: DifficultyBlock,
  newBlockTime: number,
  at: DifficultyLookup,
): number | null {
  const height = last.height + 1

  if (height % DIFFICULTY_ADJUSTMENT_INTERVAL !== 0) {
    if (!ALLOW_MIN_DIFFICULTY[network]) return last.nBits
    if (newBlockTime > last.time + POW_TARGET_SPACING * 2) return POW_LIMIT_BITS

    // Back to the last block mined at real difficulty, whose nBits the run of
    // min-difficulty blocks above it inherits.
    let block = last
    while (
      block.height > 0
      && block.height % DIFFICULTY_ADJUSTMENT_INTERVAL !== 0
      && block.nBits === POW_LIMIT_BITS
    ) {
      const previous = at(block.height - 1)
      if (previous == null) return null
      block = previous
    }
    return block.nBits
  }

  // Litecoin's correction to Bitcoin's off-by-one, inherited with the codebase:
  // only the very first retarget spans interval-1 blocks.
  const back = height === DIFFICULTY_ADJUSTMENT_INTERVAL
    ? DIFFICULTY_ADJUSTMENT_INTERVAL - 1
    : DIFFICULTY_ADJUSTMENT_INTERVAL
  const first = at(last.height - back)
  return first == null ? null : retargetOver(last, first.time)
}

// KimotoGravityWell.
function kimotoGravityWell(last: DifficultyBlock, at: DifficultyLookup): number | null {
  if (last.height === 0 || last.height < KGW_PAST_BLOCKS_MIN) return POW_LIMIT_BITS

  let reading: DifficultyBlock = last
  let mass = 0
  let actualSeconds = 0
  let targetSeconds = 0
  let average = 0n
  let previousAverage = 0n

  for (let i = 1; reading.height > 0 && i <= KGW_PAST_BLOCKS_MAX; i++) {
    mass++

    average = bitsToTarget(reading.nBits)
    if (i > 1) {
      average = average >= previousAverage
        ? ((average - previousAverage) / BigInt(i)) + previousAverage
        : previousAverage - ((previousAverage - average) / BigInt(i))
    }
    previousAverage = average

    actualSeconds = last.time - reading.time
    targetSeconds = POW_TARGET_SPACING * mass
    if (actualSeconds < 0) actualSeconds = 0
    const rateRatio = actualSeconds !== 0 && targetSeconds !== 0
      ? targetSeconds / actualSeconds
      : 1

    // The event horizon narrows as the sample grows, so a short run has to
    // deviate further than a long one to end the walk here.
    const horizon = 1 + (0.7084 * Math.pow(mass / 28.2, -1.228))
    if (mass >= KGW_PAST_BLOCKS_MIN && (rateRatio <= 1 / horizon || rateRatio >= horizon)) break

    const previous = at(reading.height - 1)
    if (previous == null) return null
    reading = previous
  }

  let next = average
  if (actualSeconds !== 0 && targetSeconds !== 0) {
    next = (next * BigInt(actualSeconds)) / BigInt(targetSeconds)
  }
  if (next > POW_LIMIT_TARGET) next = POW_LIMIT_TARGET
  return targetToCompact(next)
}

// DarkGravityWave — v3, the only version Dash Core still implements.
function darkGravityWave(last: DifficultyBlock, at: DifficultyLookup): number | null {
  if (last.height < DGW_PAST_BLOCKS) return POW_LIMIT_BITS

  let reading = last
  let average = 0n
  for (let counted = 1; counted <= DGW_PAST_BLOCKS; counted++) {
    const target = bitsToTarget(reading.nBits)
    average = counted === 1
      ? target
      : (average * BigInt(counted) + target) / BigInt(counted + 1)

    if (counted === DGW_PAST_BLOCKS) break
    const previous = at(reading.height - 1)
    if (previous == null) return null
    reading = previous
  }

  // Measured over DGW_PAST_BLOCKS-1 intervals but divided by the full span —
  // Core flags that as a possible bug and it is consensus regardless.
  const span = DGW_PAST_BLOCKS * POW_TARGET_SPACING
  let timespan = last.time - reading.time
  if (timespan < span / 3) timespan = span / 3
  if (timespan > span * 3) timespan = span * 3

  let next = (average * BigInt(timespan)) / BigInt(span)
  if (next > POW_LIMIT_TARGET) next = POW_LIMIT_TARGET
  return targetToCompact(next)
}

// GetNextWorkRequired's min-difficulty branch, which is checked ahead of both
// post-BTC eras. Null when neither threshold is crossed and the era rules.
function minDifficultyBits(
  network: Network,
  prevTime: number,
  prevBits: number,
  newBlockTime: number,
): number | null {
  if (!ALLOW_MIN_DIFFICULTY[network]) return null
  if (newBlockTime > prevTime + MIN_DIFFICULTY_RESET_S) return POW_LIMIT_BITS
  if (newBlockTime > prevTime + POW_TARGET_SPACING * 4) {
    const eased = bitsToTarget(prevBits) * 10n
    return eased > POW_LIMIT_TARGET ? POW_LIMIT_BITS : targetToCompact(eased)
  }
  return null
}

// GetNextWorkRequired. Null when the window does not reach far enough back to
// answer, which leaves the header on its PoW check alone.
export function expectedBits(
  network: Network,
  lastHeight: number,
  newBlockTime: number,
  at: DifficultyLookup,
): number | null {
  const last = at(lastHeight)
  if (last == null) return null

  if (last.height + 1 < KGW_ACTIVATION_HEIGHT[network]) {
    return intervalRetarget(network, last, newBlockTime, at)
  }

  const eased = minDifficultyBits(network, last.time, last.nBits, newBlockTime)
  if (eased != null) return eased

  return last.height + 1 < DGW_ACTIVATION_HEIGHT[network]
    ? kimotoGravityWell(last, at)
    : darkGravityWave(last, at)
}

// ConvertBitsToDouble. Pure IEEE-754 doubles — the 256 scaling is exact and the
// one division is correctly rounded, so this reproduces Core bit for bit.
function bitsToDifficulty(nBits: number): number {
  let shift = (nBits >>> 24) & 0xff
  let difficulty = 0x0000ffff / (nBits & 0x00ffffff)
  while (shift < 29) {
    difficulty *= 256.0
    shift++
  }
  while (shift > 29) {
    difficulty /= 256.0
    shift--
  }
  return difficulty
}

// Equality, except over the mainnet range DGW v1 and v2 produced: those two ran
// on x87 long double, so Dash Core itself only checks them within a band.
export function bitsAccepted(
  network: Network,
  height: number,
  nBits: number,
  expected: number,
): boolean {
  if (height > DGW_TOLERANCE_HEIGHT[network]) return nBits === expected
  const actual = bitsToDifficulty(nBits)
  return Math.abs(actual - bitsToDifficulty(expected)) <= actual * DGW_TOLERANCE
}

// A whole batch's v3 answers in one call. Null where v3 does not govern the
// range, or the window cannot seed the average, and expectedBits runs per header.
export function expectedBitsForRange(
  network: Network,
  startHeight: number,
  batch: readonly DifficultyBlock[],
  at: DifficultyLookup,
): Uint32Array | null {
  if (batch.length === 0) return null
  if (startHeight + 1 < DGW_ACTIVATION_HEIGHT[network]) return null

  const times = new Uint32Array(DGW_PAST_BLOCKS + batch.length)
  const nbits = new Uint32Array(times.length)
  for (let i = 0; i < DGW_PAST_BLOCKS; i++) {
    const block = at(startHeight - DGW_PAST_BLOCKS + 1 + i)
    if (block == null) return null
    times[i] = block.time
    nbits[i] = block.nBits
  }
  for (let i = 0; i < batch.length; i++) {
    times[DGW_PAST_BLOCKS + i] = batch[i]!.time
    nbits[DGW_PAST_BLOCKS + i] = batch[i]!.nBits
  }

  let required: Uint32Array
  try {
    required = dgwNextBitsRange(times, nbits, DGW_PAST_BLOCKS)
  } catch {
    // An nBits no target can encode reaches the binding before the per-header
    // checks run; let that path reject the header with its own message.
    return null
  }
  if (!ALLOW_MIN_DIFFICULTY[network]) return required

  // Min-difficulty is checked ahead of v3 and turns on each header's own gap,
  // which an averaged range knows nothing about.
  for (let i = 0; i < required.length; i++) {
    const self = DGW_PAST_BLOCKS + i
    const eased = minDifficultyBits(network, times[self - 1]!, nbits[self - 1]!, times[self]!)
    if (eased != null) required[i] = eased
  }
  return required
}
