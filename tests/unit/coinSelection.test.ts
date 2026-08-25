import { describe, it, expect } from 'vitest'
import {selectCoins} from '../../src/main/src/utils/coinSelection'
import {SelectableUtxo} from '../../src/main/src/types/CoinSelection'
import {CORE_TRANSFER_FEE_DUFFS} from '../../src/main/src/constants'

const PARAMS = {fee: CORE_TRANSFER_FEE_DUFFS}
const ONE_DASH = 100_000_000n

function utxo(satoshis: bigint, n = 0): SelectableUtxo {
  return { txid: `tx${n}`, vout: n, satoshis, address: `addr${n}` }
}

describe('selectCoins', () => {
  it('selects a single sufficient utxo and returns change', () => {
    const res = selectCoins([utxo(ONE_DASH)], ONE_DASH / 2n, PARAMS)
    expect(res.inputs).toHaveLength(1)
    expect(res.inputTotal).toBe(ONE_DASH)
    expect(res.fee).toBe(PARAMS.fee)
    expect(res.inputTotal).toBe(ONE_DASH / 2n + res.fee + res.change)
  })

  it('accumulates multiple utxos until the target plus fee is covered', () => {
    const utxos = [utxo(30_000n, 0), utxo(30_000n, 1), utxo(30_000n, 2)]
    const res = selectCoins(utxos, 50_000n, PARAMS)
    expect(res.inputs.length).toBeGreaterThan(1)
    expect(res.inputTotal).toBe(50_000n + res.fee + res.change)
  })

  it('prefers larger utxos first (fewer inputs)', () => {
    const utxos = [utxo(10_000n, 0), utxo(ONE_DASH, 1), utxo(10_000n, 2)]
    const res = selectCoins(utxos, ONE_DASH / 2n, PARAMS)
    expect(res.inputs).toHaveLength(1)
    expect(res.inputs[0].satoshis).toBe(ONE_DASH)
  })

  it('conserves value: inputTotal === target + fee + change', () => {
    const res = selectCoins([utxo(5n * ONE_DASH)], 3n * ONE_DASH, PARAMS)
    expect(res.inputTotal).toBe(3n * ONE_DASH + res.fee + res.change)
  })

  it('throws on zero or negative target', () => {
    expect(() => selectCoins([utxo(ONE_DASH)], 0n, PARAMS)).toThrow('greater than zero')
    expect(() => selectCoins([utxo(ONE_DASH)], -5n, PARAMS)).toThrow('greater than zero')
  })

  it('throws when funds cannot cover amount + fee', () => {
    expect(() => selectCoins([utxo(10_000n)], 50_000n, PARAMS)).toThrow('Insufficient funds')
  })

  it('throws when funds cover amount but not the fee', () => {
    expect(() => selectCoins([utxo(50_500n)], 50_000n, PARAMS)).toThrow('Insufficient funds')
  })

  it('throws on an empty utxo set', () => {
    expect(() => selectCoins([], ONE_DASH, PARAMS)).toThrow('Insufficient funds')
  })

  it('uses the fixed Core network fee', () => {
    const res = selectCoins([utxo(ONE_DASH)], 1000n, PARAMS)
    expect(res.fee).toBe(PARAMS.fee)
  })

  it('sends the maximum balance minus the fixed fee with many inputs', () => {
    const utxos = Array.from({length: 100}, (_, index) => utxo(20_000n, index))
    const balance = utxos.reduce((sum, input) => sum + input.satoshis, 0n)

    const res = selectCoins(utxos, balance - PARAMS.fee, PARAMS)

    expect(res.inputs).toHaveLength(100)
    expect(res.inputTotal).toBe(balance)
    expect(res.fee).toBe(PARAMS.fee)
    expect(res.change).toBe(0n)
  })

  it('returns change smaller than the fixed fee', () => {
    const target = 50_000n
    const total = target + PARAMS.fee + 1_500n
    const res = selectCoins([utxo(total)], target, PARAMS)
    expect(res.change).toBe(1_500n)
    expect(res.fee).toBe(PARAMS.fee)
    expect(res.inputTotal).toBe(target + res.fee + res.change)
  })
})
