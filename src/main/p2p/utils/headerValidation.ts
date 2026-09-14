import {MAX_FUTURE_BLOCK_TIME, POW_LIMIT_TARGET} from '../constants'
import {bitsToTarget, hashHeaderRaw, headerWork, rawPrevHash} from './pow'
import {bitsAccepted, expectedBits, expectedBitsForRange} from './difficulty'
import {Network} from '../../src/types/Network'
import type {PersistedHeader} from '../types/chainStore'
import type {DifficultyBlock, DifficultyLookup} from '../types/difficulty'
import type {ValidatedHeaders} from '../types/headerSync'
import {Logger} from '../../src/utils/logger'

const log = new Logger('p2p')

// All-or-nothing: a batch that fails anywhere is rejected whole, because a peer
// that sent one bad header has not earned the ones before it.
export function validateHeaders(
  rawHeaders: Uint8Array[],
  startHeight: number,
  startHash: string,
  network: Network,
  committed: DifficultyLookup,
): ValidatedHeaders | null {
  // Read up front so the whole batch's difficulty can be answered in one call.
  const batch: DifficultyBlock[] = []
  for (const raw of rawHeaders) {
    const height = startHeight + batch.length + 1
    if (raw.length < 80) {
      log.warn(`reject ~h=${height} short header (${raw.length} bytes)`)
      return null
    }
    const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength)
    batch.push({height, time: view.getUint32(68, true), nBits: view.getUint32(72, true)})
  }
  // Every context block sits below the batch, so the committed window answers it
  // even on a fork, where the heights above belong to another branch.
  const ranged = expectedBitsForRange(network, startHeight, batch, committed)

  const futureLimit = Math.floor(Date.now() / 1000) + MAX_FUTURE_BLOCK_TIME
  let prevHash = startHash
  let h = startHeight
  let work = 0n
  const accepted: PersistedHeader[] = []
  const pending = new Map<number, DifficultyBlock>()
  const at: DifficultyLookup = height => pending.get(height) ?? committed(height)

  for (let i = 0; i < rawHeaders.length; i++) {
    const raw = rawHeaders[i]!
    const header = batch[i]!
    const {time, nBits} = header
    const incomingPrev = rawPrevHash(raw)

    if (incomingPrev !== prevHash) {
      log.warn(`reject ~h=${h + 1} prev mismatch got=${incomingPrev} want=${prevHash}`)
      return null
    }
    if (time > futureLimit) {
      log.warn(`reject ~h=${h + 1} time too far in future: ${time}`)
      return null
    }

    const target = bitsToTarget(nBits)
    if (target <= 0n || target > POW_LIMIT_TARGET) {
      log.warn(`reject ~h=${h + 1} bad nBits=0x${nBits.toString(16)}`)
      return null
    }

    const hashHex = hashHeaderRaw(raw)
    if (BigInt('0x' + hashHex) > target) {
      log.warn(`reject ~h=${h + 1} PoW fail hash=${hashHex.slice(0, 16)}`)
      return null
    }

    const required = ranged?.[i] ?? expectedBits(network, h, time, at)
    if (required != null && !bitsAccepted(network, h + 1, nBits, required)) {
      log.warn(`reject ~h=${h + 1} nBits=0x${nBits.toString(16)} want=0x${required.toString(16)}`)
      return null
    }

    h++
    accepted.push({height: h, hash: hashHex, prevHash, time, nBits, raw})
    pending.set(h, header)
    work += headerWork(nBits)
    prevHash = hashHex
  }

  return accepted.length > 0 ? {accepted, work} : null
}
