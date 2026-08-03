import { describe, it, expect } from 'vitest'
import { utxoKey, totalDuffs, buildSendSelectedUrl, isDustUtxo, UtxoRef } from '../../src/renderer/src/utils/utxo'
import { truncateMiddle } from '../../src/renderer/src/utils/truncate'

const utxos: UtxoRef[] = [
  { txid: 'a', vout: 0, satoshis: '100000000' },
  { txid: 'b', vout: 1, satoshis: '250000000' },
  { txid: 'c', vout: 2, satoshis: '1' },
]

describe('utxoKey', () => {
  it('joins txid and vout with a colon', () => {
    expect(utxoKey('deadbeef', 3)).toBe('deadbeef:3')
  })
})

describe('totalDuffs', () => {
  it('sums all satoshis as bigint', () => {
    expect(totalDuffs(utxos)).toBe(350000001n)
  })

  it('returns 0n for an empty list', () => {
    expect(totalDuffs([])).toBe(0n)
  })

  it('sums only the utxos it is given', () => {
    expect(totalDuffs(utxos.filter((utxo) => utxo.txid !== 'b'))).toBe(100000001n)
  })

  it('keeps precision above Number.MAX_SAFE_INTEGER', () => {
    const big: UtxoRef[] = [
      { txid: 'x', vout: 0, satoshis: '9007199254740993' },
      { txid: 'y', vout: 0, satoshis: '9007199254740993' },
    ]
    expect(totalDuffs(big)).toBe(18014398509481986n)
  })
})

describe('buildSendSelectedUrl', () => {
  it('builds a url for a single key', () => {
    expect(buildSendSelectedUrl(['a:0'])).toBe('/send?from=core&utxos=a:0')
  })

  it('joins multiple keys with commas', () => {
    expect(buildSendSelectedUrl(['a:0', 'b:1'])).toBe('/send?from=core&utxos=a:0,b:1')
  })
})

describe('truncateMiddle', () => {
  it('shortens long values keeping both edges', () => {
    expect(truncateMiddle('abcdef0123456789', 4)).toBe('abcd…6789')
  })

  it('returns short values unchanged', () => {
    expect(truncateMiddle('abcdefgh', 4)).toBe('abcdefgh')
  })

  it('supports asymmetric head and tail', () => {
    expect(truncateMiddle('abcdef0123456789', 6, 2)).toBe('abcdef…89')
  })
})

describe('isDustUtxo', () => {
  it('returns true below the threshold', () => {
    expect(isDustUtxo({ txid: 'a', vout: 0, satoshis: '545' })).toBe(true)
  })

  it('returns false at the threshold', () => {
    expect(isDustUtxo({ txid: 'a', vout: 0, satoshis: '546' })).toBe(false)
  })

  it('returns false above the threshold', () => {
    expect(isDustUtxo({ txid: 'a', vout: 0, satoshis: '547' })).toBe(false)
  })

  it('handles values above Number.MAX_SAFE_INTEGER', () => {
    expect(isDustUtxo({ txid: 'a', vout: 0, satoshis: '9007199254740993' })).toBe(false)
  })
})
