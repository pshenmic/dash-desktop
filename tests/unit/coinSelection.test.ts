import { describe, it, expect } from 'vitest'
import {
  selectCoins,
  SelectableUtxo,
  DEFAULT_SELECTION_PARAMS,
} from '../../src/main/src/utils/coinSelection'

const ONE_DASH = 100_000_000n

function utxo(satoshis: bigint, n = 0): SelectableUtxo {
  return { txid: `tx${n}`, vout: n, satoshis, address: `addr${n}` }
}

describe('selectCoins', () => {
  it('selects a single sufficient utxo and returns change', () => {
    const res = selectCoins([utxo(ONE_DASH)], ONE_DASH / 2n)
    expect(res.inputs).toHaveLength(1)
    expect(res.inputTotal).toBe(ONE_DASH)
    expect(res.fee).toBeGreaterThanOrEqual(DEFAULT_SELECTION_PARAMS.minFee)
    expect(res.inputTotal).toBe(ONE_DASH / 2n + res.fee + res.change)
  })

  it('accumulates multiple utxos until the target plus fee is covered', () => {
    const utxos = [utxo(30_000n, 0), utxo(30_000n, 1), utxo(30_000n, 2)]
    const res = selectCoins(utxos, 50_000n)
    expect(res.inputs.length).toBeGreaterThan(1)
    expect(res.inputTotal).toBe(50_000n + res.fee + res.change)
  })

  it('prefers larger utxos first (fewer inputs)', () => {
    const utxos = [utxo(10_000n, 0), utxo(ONE_DASH, 1), utxo(10_000n, 2)]
    const res = selectCoins(utxos, ONE_DASH / 2n)
    expect(res.inputs).toHaveLength(1)
    expect(res.inputs[0].satoshis).toBe(ONE_DASH)
  })

  it('conserves value: inputTotal === target + fee + change', () => {
    const res = selectCoins([utxo(5n * ONE_DASH)], 3n * ONE_DASH)
    expect(res.inputTotal).toBe(3n * ONE_DASH + res.fee + res.change)
  })

  it('throws on zero or negative target', () => {
    expect(() => selectCoins([utxo(ONE_DASH)], 0n)).toThrow('greater than zero')
    expect(() => selectCoins([utxo(ONE_DASH)], -5n)).toThrow('greater than zero')
  })

  it('throws when funds cannot cover amount + fee', () => {
    expect(() => selectCoins([utxo(10_000n)], 50_000n)).toThrow('Insufficient funds')
  })

  it('throws when funds cover amount but not the fee', () => {
    expect(() => selectCoins([utxo(50_500n)], 50_000n)).toThrow('Insufficient funds')
  })

  it('throws on an empty utxo set', () => {
    expect(() => selectCoins([], ONE_DASH)).toThrow('Insufficient funds')
  })

  it('produces a fee at least the minimum relay fee', () => {
    const res = selectCoins([utxo(ONE_DASH)], 1000n)
    expect(res.fee).toBeGreaterThanOrEqual(1000n)
  })

  it('folds a sub-minFee remainder into the fee instead of making dust change', () => {
    // total leaves room for the amount + no-change fee, but the leftover after a
    // with-change fee would be below minFee — so no change output is created and
    // the remainder is absorbed into the fee.
    const target = 50_000n
    const total = target + 1_500n
    const res = selectCoins([utxo(total)], target)
    expect(res.change).toBe(0n)
    expect(res.fee).toBe(1_500n)
    expect(res.inputTotal).toBe(target + res.fee)
  })
})
