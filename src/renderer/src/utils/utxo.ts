import { SourceKind } from '../enums/SourceKind'
import { DUST_THRESHOLD_DUFFS } from '../constants/utxosPage'

export interface UtxoRef {
  txid: string
  vout: number
  satoshis: string
}

export function utxoKey(txid: string, vout: number): string {
  return `${txid}:${vout}`
}

export function totalDuffs(utxos: readonly UtxoRef[]): bigint {
  return utxos.reduce((sum, utxo) => sum + BigInt(utxo.satoshis), 0n)
}

export function isDustUtxo(utxo: UtxoRef): boolean {
  return BigInt(utxo.satoshis) < DUST_THRESHOLD_DUFFS
}

export function buildSendSelectedUrl(selectedKeys: string[]): string {
  return `/send?from=${SourceKind.Core}&utxos=${selectedKeys.join(',')}`
}
