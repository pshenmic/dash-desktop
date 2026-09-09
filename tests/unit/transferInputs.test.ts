import {describe, it, expect} from 'vitest'
import {Script} from 'dash-core-sdk'
import {Address} from '../../src/main/src/types/Address'
import {GroupedAddresses} from '../../src/main/src/types/GroupedAddresses'
import {UTXO} from '../../src/main/src/types/UTXO'
import {
  pickChangeAddress,
  pickCreditChangeAddress,
  requireCoreRecipients,
  selectTransferInputs,
} from '../../src/main/src/utils/transferInputs'
import {coreFeeDuffsFor} from '../../src/main/src/utils/coreFeeRate'
import {DUST_THRESHOLD_DUFFS, MAX_CORE_RECIPIENTS} from '../../src/main/src/constants/chain'

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
  ({address: owner, satoshis, txId, vOut: 0, script: Script.fromHex(SCRIPT_HEX), height: 1})

const grouped = (receiving: Address[], change: Address[]): GroupedAddresses => ({receiving, change})

const wallet = grouped(
  [address('recv-0', 0, false), address('recv-1', 1, false)],
  [address('chg-0', 0, true), address('chg-1', 1, true)],
)

const FEE = (inputsCount: number): bigint => coreFeeDuffsFor(1, inputsCount, 1, true)

describe('selecting transfer inputs from a wallet-wide utxo set', () => {
  // Selecting one would fail at signing time, after the spend was built.
  it('ignores outputs on addresses the wallet cannot sign for', () => {
    const {transferInputs} = selectTransferInputs(
      wallet,
      [utxo(FOREIGN, 900_000_000n, 'aa'), utxo('recv-0', 50_000_000n, 'bb')],
      1_000_000n,
      FEE,
    )

    expect(transferInputs.map(i => i.txId)).toEqual(['bb'])
  })

  it('refuses the spend when every output is unsignable', () => {
    expect(() => selectTransferInputs(wallet, [utxo(FOREIGN, 900_000_000n, 'aa')], 1_000_000n, FEE))
      .toThrow('No spendable funds')
  })

  it('honours an address source against the wallet-wide set', () => {
    const {transferInputs} = selectTransferInputs(
      wallet,
      [utxo('recv-0', 50_000_000n, 'aa'), utxo('recv-1', 50_000_000n, 'bb')],
      1_000_000n,
      FEE,
      {kind: 'address', address: 'recv-1'},
    )

    expect(transferInputs.map(i => i.txId)).toEqual(['bb'])
  })

  // The automatic selection would have stopped at the first coin that covered
  // the amount, which is the one thing a picked set must not do.
  it('spends every picked coin even when one of them would have covered the amount', () => {
    const {transferInputs, inputTotal, feeDuffs} = selectTransferInputs(
      wallet,
      [utxo('recv-0', 50_000_000n, 'aa'), utxo('recv-1', 50_000_000n, 'bb')],
      1_000_000n,
      FEE,
      {kind: 'outpoints', outpoints: [{txid: 'aa', vout: 0}, {txid: 'bb', vout: 0}]},
    )

    expect(transferInputs.map(i => i.txId)).toEqual(['aa', 'bb'])
    expect(inputTotal).toBe(100_000_000n)
    expect(feeDuffs).toBe(FEE(2))
  })

  it('leaves a picked coin the wallet cannot sign for out of the spend', () => {
    expect(() => selectTransferInputs(
      wallet,
      [utxo('recv-0', 50_000_000n, 'aa'), utxo(FOREIGN, 50_000_000n, 'bb')],
      1_000_000n,
      FEE,
      {kind: 'outpoints', outpoints: [{txid: 'aa', vout: 0}, {txid: 'bb', vout: 0}]},
    )).toThrow('Selected UTXO no longer available')
  })

  it('refuses the spend when a picked coin was spent since it was picked', () => {
    expect(() => selectTransferInputs(
      wallet,
      [utxo('recv-0', 50_000_000n, 'aa')],
      1_000_000n,
      FEE,
      {kind: 'outpoints', outpoints: [{txid: 'aa', vout: 0}, {txid: 'bb', vout: 0}]},
    )).toThrow('Selected UTXO no longer available')
  })

  it('refuses a picked set that cannot cover the amount and its fee', () => {
    expect(() => selectTransferInputs(
      wallet,
      [utxo('recv-0', 10_000n, 'aa'), utxo('recv-1', 900_000_000n, 'bb')],
      1_000_000n,
      FEE,
      {kind: 'outpoints', outpoints: [{txid: 'aa', vout: 0}]},
    )).toThrow('Insufficient funds')
  })

  it('carries the derivation path of the address each input pays', () => {
    const {transferInputs} = selectTransferInputs(wallet, [utxo('recv-1', 50_000_000n, 'aa')], 1_000_000n, FEE)

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

describe('the recipients a send is allowed to pay', () => {
  const recipient = (address: string, amountDuffs: bigint): {address: string; amountDuffs: bigint} =>
    ({address, amountDuffs})

  it('funds the sum of every output', () => {
    expect(requireCoreRecipients([
      recipient('recv-0', 10_000n),
      recipient('recv-1', 25_000n),
    ])).toBe(35_000n)
  })

  it('refuses a send with nothing to pay', () => {
    expect(() => requireCoreRecipients([])).toThrow(/between 1 and/)
  })

  it('refuses more outputs than a standard transaction carries', () => {
    const many = Array.from({length: MAX_CORE_RECIPIENTS + 1}, () => recipient('recv-0', 10_000n))
    expect(() => requireCoreRecipients(many)).toThrow(/between 1 and/)
  })

  // An output under the dust threshold makes the whole transaction non-standard,
  // so it is refused here rather than by every peer it is offered to.
  it('refuses an output below the dust threshold', () => {
    expect(() => requireCoreRecipients([recipient('recv-0', DUST_THRESHOLD_DUFFS - 1n)]))
      .toThrow(/Minimum amount per recipient/)
    expect(requireCoreRecipients([recipient('recv-0', DUST_THRESHOLD_DUFFS)])).toBe(DUST_THRESHOLD_DUFFS)
  })

  // Nothing on L1 is keyed by address, so the same address twice is two
  // payments rather than one merged one.
  it('lets one address be paid twice', () => {
    expect(requireCoreRecipients([
      recipient('recv-0', 10_000n),
      recipient('recv-0', 10_000n),
    ])).toBe(20_000n)
  })
})
