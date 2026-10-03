import {createHash} from 'node:crypto'

export function doubleSHA256(data: Uint8Array): Uint8Array {
  const once = createHash('sha256').update(data).digest()
  return new Uint8Array(createHash('sha256').update(once).digest())
}
