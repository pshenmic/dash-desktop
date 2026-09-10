import {describe, expect, it} from 'vitest'
import type {CoinControlFunds} from '../../src/renderer/src/types/CoinControl'
import {sendPreviewInputs, sendPreviewOutputs, sendPreviewSourceKey, sendPreviewTotals} from '../../src/renderer/src/utils/sendTransactionPreview'
import {duffsToCredits} from '../../src/renderer/src/utils/balance'

function funds(): CoinControlFunds {
  return {coreAddresses: [], utxos: [], platformAddresses: [], shieldedNotes: []}
}

describe('send transaction preview', () => {
  it('preserves duplicate recipient outputs and deducts the fee only from its selected output', () => {
    const outputs = sendPreviewOutputs({
      recipients: [{address: 'same', amountDuffs: 10n}, {address: 'same', amountDuffs: 20n}],
      feeCredits: 1001n,
      feeOutputIndex: 1,
      newIdentity: false,
    })
    expect(outputs).toEqual([
      {address: 'same', amountCredits: duffsToCredits(10n), label: undefined},
      {address: 'same', amountCredits: duffsToCredits(20n) - 1001n, label: 'Fee deducted'},
    ])
  })

  it('does not invent an address for an identity that has not been created', () => {
    expect(sendPreviewOutputs({
      recipients: [{address: '', amountDuffs: 100n}], feeCredits: 0n, newIdentity: true,
    })).toEqual([{address: '', amountCredits: duffsToCredits(100n), label: 'New Platform identity'}])
  })

  it('shows only manually selected Core outpoints', () => {
    const inventory = funds()
    inventory.utxos = [
      {txid: 'a', vout: 1, address: 'A', satoshis: 10n, height: 1},
      {txid: 'b', vout: 2, address: 'B', satoshis: 20n, height: 1},
    ]
    expect(sendPreviewInputs({selection: {kind: 'coreOutpoints', outpoints: ['b:2']}, funds: inventory}))
      .toEqual([{address: 'B', amountCredits: duffsToCredits(20n), reference: 'b:2'}])
  })

  it('does not present all available coins as the automatic spend set', () => {
    const inventory = funds()
    inventory.utxos = [{txid: 'a', vout: 0, address: 'A', satoshis: 10n, height: 1}]
    expect(sendPreviewInputs({selection: {kind: 'automatic'}, funds: inventory})).toEqual([])
  })

  it('keeps Platform input amounts exact and identifies the fee source', () => {
    const selection = {kind: 'platformInputs' as const, inputs: [{address: 'A', credits: 1001n}], feeAddress: 'A'}
    expect(sendPreviewInputs({selection, funds: funds()})).toEqual([{address: 'A', amountCredits: 1001n, label: 'Fee input'}])
    expect(sendPreviewInputs({selection, funds: funds(), feeFromOutput: true})).toEqual([{address: 'A', amountCredits: 1001n, label: undefined}])
  })

  it('omits spent and unselected shielded notes', () => {
    const inventory = funds()
    inventory.shieldedNotes = [
      {index: 1, address: 'A', amount: 1001n, spent: false},
      {index: 2, address: 'B', amount: 2001n, spent: true},
      {index: 3, address: 'C', amount: 3001n, spent: false},
    ]
    expect(sendPreviewInputs({selection: {kind: 'shieldedNotes', noteIndexes: [1, 2]}, funds: inventory}))
      .toEqual([{address: 'A', amountCredits: 1001n, reference: 'Note 1'}])
  })

  it('shows the actual fixed identity source rather than an automatic selection', () => {
    expect(sendPreviewInputs({selection: {kind: 'automatic'}, funds: funds(), fixedAddress: 'identity', fixedCredits: 4001n}))
      .toEqual([{address: 'identity', amountCredits: 4001n}])
  })

  it('counts a fee deducted from a denomination once in the total debit', () => {
    const outputs = sendPreviewOutputs({
      recipients: [{address: '', amountDuffs: 100_000n}], feeCredits: 1001n, feeOutputIndex: 0, newIdentity: true,
    })
    expect(sendPreviewTotals(outputs, 1001n)).toEqual({
      amountCredits: duffsToCredits(100_000n) - 1001n, feeCredits: 1001n, totalDebitCredits: duffsToCredits(100_000n),
    })
  })

  it('adds the fee to recipients that receive their full entered amount', () => {
    const outputs = sendPreviewOutputs({recipients: [{address: 'A', amountDuffs: 100n}], feeCredits: 2001n, newIdentity: false})
    expect(sendPreviewTotals(outputs, 2001n).totalDebitCredits).toBe(duffsToCredits(100n) + 2001n)
  })

  it('tracks effective source changes without depending on refreshed object identity', () => {
    const first = sendPreviewSourceKey({network: 'testnet', shieldedSource: {kind: 'address', noteIndexes: [1, 2]}})
    expect(sendPreviewSourceKey({network: 'testnet', shieldedSource: {kind: 'address', noteIndexes: [1, 2]}})).toBe(first)
    expect(sendPreviewSourceKey({network: 'testnet', shieldedSource: {kind: 'address', noteIndexes: [1, 3]}})).not.toBe(first)
    expect(sendPreviewSourceKey({network: 'testnet', fixedAddress: 'identity-a'}))
      .not.toBe(sendPreviewSourceKey({network: 'testnet', fixedAddress: 'identity-b'}))
  })
})
