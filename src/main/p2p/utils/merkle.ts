import {HASH_LEN} from '../constants'
import {doubleSHA256} from './hash'

export function merkleRoot(txids: readonly Uint8Array[]): Uint8Array | null {
  if (txids.length === 0) return null

  let row = [...txids]
  const pair = new Uint8Array(HASH_LEN * 2)
  while (row.length > 1) {
    for (let i = 0; i + 1 < row.length; i += 2) {
      if (Buffer.compare(row[i]!, row[i + 1]!) === 0) return null
    }
    if (row.length % 2 === 1) row.push(row[row.length - 1]!)

    const next: Uint8Array[] = []
    for (let i = 0; i < row.length; i += 2) {
      pair.set(row[i]!, 0)
      pair.set(row[i + 1]!, HASH_LEN)
      next.push(doubleSHA256(pair))
    }
    row = next
  }
  return row[0]!
}
