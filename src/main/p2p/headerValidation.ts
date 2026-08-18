import {MAX_FUTURE_BLOCK_TIME} from './constants'
import {bitsToTarget, hashHeaderRaw, headerWork, POW_LIMIT_TARGET, rawPrevHash} from './pow'
import type {PersistedHeader} from './types/chainStore'
import type {ValidatedHeaders} from './types/headerSync'

// DGWv3 difficulty validation is intentionally off: replicating Dash testnet's
// early-chain edge cases (min-difficulty rule, encoded POW_LIMIT round-tripping)
// is out of scope until a recent checkpoint anchors trust.
//
// All-or-nothing: a batch that fails anywhere is rejected whole, because a peer
// that sent one bad header has not earned the ones before it.
export function validateHeaders(
  rawHeaders: Uint8Array[],
  startHeight: number,
  startHash: string,
): ValidatedHeaders | null {
  const futureLimit = Math.floor(Date.now() / 1000) + MAX_FUTURE_BLOCK_TIME
  let prevHash = startHash
  let h = startHeight
  let work = 0n
  const accepted: PersistedHeader[] = []

  for (const raw of rawHeaders) {
    if (raw.length < 80) {
      console.warn(`[p2p] reject ~h=${h + 1} short header (${raw.length} bytes)`)
      return null
    }
    const dv = new DataView(raw.buffer, raw.byteOffset, raw.byteLength)
    const time = dv.getUint32(68, true)
    const nBits = dv.getUint32(72, true)
    const incomingPrev = rawPrevHash(raw)

    if (incomingPrev !== prevHash) {
      console.warn(`[p2p] reject ~h=${h + 1} prev mismatch got=${incomingPrev} want=${prevHash}`)
      return null
    }
    if (time > futureLimit) {
      console.warn(`[p2p] reject ~h=${h + 1} time too far in future: ${time}`)
      return null
    }

    const target = bitsToTarget(nBits)
    if (target <= 0n || target > POW_LIMIT_TARGET) {
      console.warn(`[p2p] reject ~h=${h + 1} bad nBits=0x${nBits.toString(16)}`)
      return null
    }

    const hashHex = hashHeaderRaw(raw)
    if (BigInt('0x' + hashHex) > target) {
      console.warn(`[p2p] reject ~h=${h + 1} PoW fail hash=${hashHex.slice(0, 16)}`)
      return null
    }

    h++
    accepted.push({height: h, hash: hashHex, prevHash, time, nBits, raw})
    work += headerWork(nBits)
    prevHash = hashHex
  }

  return accepted.length > 0 ? {accepted, work} : null
}
