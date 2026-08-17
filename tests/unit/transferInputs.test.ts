import {describe, it, expect} from 'vitest'
import {Script} from 'dash-core-sdk'
import {Address} from '../../src/main/src/types/Address'
import {GroupedAddresses} from '../../src/main/src/types/GroupedAddresses'
import {UTXO} from '../../src/main/src/types/UTXO'
import {
  pickChangeAddress,
  pickCreditChangeAddress,
  selectTransferInputs,
} from '../../src/main/src/utils/transferInputs'

const SCRIPT_HEX = '76a9143a2d4145a4f098523b3e8127f1da87cfc55b8e7988ac'
// No derivation path in the wallet, so nothing here can be signed.
const FOREIGN = 'yPx8DNt1oQt3yubB2Sh73vAQRQ1AoyyLCS'

const address = (name: string, index: number, isChange: boolean, isUsed = false): Address => ({
  walletId: 'w1',
  accountId: 0,
  address: name,
  derivationPath: `m/44'/1'/0'/${isChange ? 1 : 0}/${index}`,
  index,
  isChange,
  isUsed,
  label: null,
})

const utxo = (owner: string, satoshis: bigint, txId: string): UTXO =>
  ({address: owner, satoshis, txId, vOut: 0, script: Script.fromHex(SCRIPT_HEX)})

const grouped = (receiving: Address[], change: Address[]): GroupedAddresses => ({receiving, change})

const wallet = grouped(
  [address('recv-0', 0, false), address('recv-1', 1, false)],
  [address('chg-0', 0, true), address('chg-1', 1, true)],
)

describe('selecting transfer inputs from a wallet-wide utxo set', () => {
  // Selecting one would fail at signing time, after the spend was built.
  it('ignores outputs on addresses the wallet cannot sign for', () => {
    const {transferInputs} = selectTransferInputs(
      wallet,
      [utxo(FOREIGN, 900_000_000n, 'aa'), utxo('recv-0', 50_000_000n, 'bb')],
      1_000_000n,
    )

    expect(transferInputs.map(i => i.txId)).toEqual(['bb'])
  })

  it('refuses the spend when every output is unsignable', () => {
    expect(() => selectTransferInputs(wallet, [utxo(FOREIGN, 900_000_000n, 'aa')], 1_000_000n))
      .toThrow('No spendable funds')
  })

  it('honours fromAddress against the wallet-wide set', () => {
    const {transferInputs} = selectTransferInputs(
      wallet,
      [utxo('recv-0', 50_000_000n, 'aa'), utxo('recv-1', 50_000_000n, 'bb')],
      1_000_000n,
      'recv-1',
    )

    expect(transferInputs.map(i => i.txId)).toEqual(['bb'])
  })

  it('carries the derivation path of the address each input pays', () => {
    const {transferInputs} = selectTransferInputs(wallet, [utxo('recv-1', 50_000_000n, 'aa')], 1_000_000n)

    expect(transferInputs[0].derivationPath).toBe("m/44'/1'/0'/0/1")
  })
})

describe('choosing where the leftovers go', () => {
  it('takes the first unused change address', () => {
    const used = grouped(wallet.receiving, [address('chg-0', 0, true, true), address('chg-1', 1, true)])

    expect(pickChangeAddress(used)).toBe('chg-1')
  })

  it('reuses the last change address rather than leaking to a receiving one', () => {
    const allUsed = grouped(wallet.receiving, [address('chg-0', 0, true, true), address('chg-1', 1, true, true)])

    expect(pickChangeAddress(allUsed)).toBe('chg-1')
  })

  it('falls back to a receiving address when the wallet has no change chain', () => {
    expect(pickChangeAddress(grouped(wallet.receiving, []))).toBe('recv-0')
  })

  it('throws when there is nowhere in the wallet to send change', () => {
    expect(() => pickChangeAddress(grouped([], []))).toThrow('no change address')
  })
})

describe('choosing the asset lock credit address', () => {
  it('avoids the address the same transaction already pays change to', () => {
    expect(pickCreditChangeAddress(wallet, 'chg-0').address).toBe('chg-1')
  })

  it('takes a used address over none when the change chain is exhausted', () => {
    const allUsed = grouped(wallet.receiving, [address('chg-0', 0, true, true)])

    expect(pickCreditChangeAddress(allUsed, 'chg-0').address).toBe('chg-0')
  })

  it('throws when the wallet has no change chain at all', () => {
    expect(() => pickCreditChangeAddress(grouped(wallet.receiving, []), 'chg-0'))
      .toThrow('no change address for the asset lock credit output')
  })
})
