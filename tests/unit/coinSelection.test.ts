import { describe, it, expect } from 'vitest'
import {maxSelectableAmount, selectCoins} from '../../src/main/src/utils/coinSelection'
import {SelectableUtxo} from '../../src/main/src/types/CoinSelection'
import {coreFeeDuffsFor} from '../../src/main/src/utils/coreFeeRate'

const FEE = (inputsCount: number): bigint => coreFeeDuffsFor(1, inputsCount, 1, true)
const ONE_DASH = 100_000_000n

function utxo(satoshis: bigint, n = 0): SelectableUtxo {
  return { txid: `tx${n}`, vout: n, satoshis, address: `addr${n}` }
}

describe('selectCoins', () => {
  it('selects a single sufficient utxo and returns change', () => {
    const res = selectCoins([utxo(ONE_DASH)], ONE_DASH / 2n, FEE)
    expect(res.inputs).toHaveLength(1)
    expect(res.inputTotal).toBe(ONE_DASH)
    expect(res.fee).toBe(FEE(1))
    expect(res.inputTotal).toBe(ONE_DASH / 2n + res.fee + res.change)
  })

  it('accumulates multiple utxos until the target plus fee is covered', () => {
    const utxos = [utxo(30_000n, 0), utxo(30_000n, 1), utxo(30_000n, 2)]
    const res = selectCoins(utxos, 50_000n, FEE)
    expect(res.inputs.length).toBeGreaterThan(1)
    expect(res.inputTotal).toBe(50_000n + res.fee + res.change)
  })

  it('prefers larger utxos first (fewer inputs)', () => {
    const utxos = [utxo(10_000n, 0), utxo(ONE_DASH, 1), utxo(10_000n, 2)]
    const res = selectCoins(utxos, ONE_DASH / 2n, FEE)
    expect(res.inputs).toHaveLength(1)
    expect(res.inputs[0].satoshis).toBe(ONE_DASH)
  })

  it('conserves value: inputTotal === target + fee + change', () => {
    const res = selectCoins([utxo(5n * ONE_DASH)], 3n * ONE_DASH, FEE)
    expect(res.inputTotal).toBe(3n * ONE_DASH + res.fee + res.change)
  })

  it('throws on zero or negative target', () => {
    expect(() => selectCoins([utxo(ONE_DASH)], 0n, FEE)).toThrow('greater than zero')
    expect(() => selectCoins([utxo(ONE_DASH)], -5n, FEE)).toThrow('greater than zero')
  })

  it('throws when funds cannot cover amount + fee', () => {
    expect(() => selectCoins([utxo(10_000n)], 50_000n, FEE)).toThrow('Insufficient funds')
  })

  it('throws when funds cover amount but not the fee', () => {
    expect(() => selectCoins([utxo(50_000n + FEE(1) - 1n)], 50_000n, FEE)).toThrow('Insufficient funds')
  })

  it('throws on an empty utxo set', () => {
    expect(() => selectCoins([], ONE_DASH, FEE)).toThrow('Insufficient funds')
  })

  it('uses the fixed Core network fee', () => {
    const res = selectCoins([utxo(ONE_DASH)], 1000n, FEE)
    expect(res.fee).toBe(FEE(1))
  })

  // A flat fee let the selection sign more inputs than it had paid for.
  it('charges all 100 inputs when it spends the whole balance', () => {
    const utxos = Array.from({length: 100}, (_, index) => utxo(20_000n, index))
    const balance = utxos.reduce((sum, input) => sum + input.satoshis, 0n)

    const res = selectCoins(utxos, balance - FEE(100), FEE)

    expect(res.inputs).toHaveLength(100)
    expect(res.inputTotal).toBe(balance)
    expect(res.fee).toBe(FEE(100))
    expect(res.fee).toBeGreaterThan(FEE(1))
    expect(res.change).toBe(0n)
  })

  it('returns change smaller than the fixed fee', () => {
    const target = 50_000n
    const total = target + FEE(1) + 1_500n
    const res = selectCoins([utxo(total)], target, FEE)
    expect(res.change).toBe(1_500n)
    expect(res.fee).toBe(FEE(1))
    expect(res.inputTotal).toBe(target + res.fee + res.change)
  })
})

describe('maxSelectableAmount', () => {
  it('answers zero for a wallet with nothing to spend', () => {
    expect(maxSelectableAmount([], FEE)).toBe(0n)
    expect(maxSelectableAmount([utxo(100n)], FEE)).toBe(0n)
  })

  it('stops before an input worth less than the bytes it adds', () => {
    const dust = Array.from({length: 20}, (_, index) => utxo(10n, index + 1))
    const max = maxSelectableAmount([utxo(ONE_DASH, 0), ...dust], FEE)

    expect(max).toBe(ONE_DASH - FEE(1))
  })

  it('spends every input that pays for itself', () => {
    const utxos = Array.from({length: 5}, (_, index) => utxo(ONE_DASH, index))
    expect(maxSelectableAmount(utxos, FEE)).toBe(5n * ONE_DASH - FEE(5))
  })

  // What Max offers has to be an amount the send can still fund.
  it('offers an amount the selection settles on exactly', () => {
    const utxos = Array.from({length: 8}, (_, index) => utxo(20_000n, index))
    const max = maxSelectableAmount(utxos, FEE)

    const res = selectCoins(utxos, max, FEE)

    expect(res.change).toBe(0n)
    expect(res.inputTotal).toBe(max + res.fee)
  })
})
