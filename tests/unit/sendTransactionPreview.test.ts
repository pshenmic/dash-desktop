import {describe, expect, it} from 'vitest'
import type {PreviewEntry, TransactionPreview} from '../../src/renderer/src/api/types'
import {SEND_PREVIEW_INITIAL_STATE} from '../../src/renderer/src/constants/sendTransactionPreview'
import {TransferOperation} from '../../src/renderer/src/enums/TransferOperation'
import {mapSendTransactionPreview, sendPreviewParams, sendPreviewReducer, sendPreviewRequestKey} from '../../src/renderer/src/utils/sendTransactionPreview'
import {duffsToCredits} from '../../src/renderer/src/utils/balance'

function entry(role: PreviewEntry['role'], amount: bigint, unit: PreviewEntry['unit'] = 'credits', address = 'address', reference: string | null = null): PreviewEntry {
  return {role, address, amount, unit, reference}
}

function preview(overrides: Partial<TransactionPreview> = {}): TransactionPreview {
  return {
    inputs: [entry('input', 102000n)], outputs: [entry('recipient', 100000n)],
    feeDuffs: null, feeCredits: 2000n, unsignedHex: 'aabb', ...overrides,
  }
}

describe('send preview request parameters', () => {
  it.each([
    [TransferOperation.CoreSend, true],
    [TransferOperation.AssetLockFunding, true],
    [TransferOperation.AssetLockShield, true],
    [TransferOperation.IdentityRegister, true],
    [TransferOperation.IdentityTopUpL1, true],
    [TransferOperation.AddressFundsTransfer, false],
    [TransferOperation.IdentityTopUp, false],
    [TransferOperation.IdentityCreate, false],
    [TransferOperation.AddressWithdrawal, false],
    [TransferOperation.Shield, false],
    [TransferOperation.IdentityToAddress, false],
    [TransferOperation.IdentityToIdentity, false],
    [TransferOperation.IdentityWithdrawal, false],
    [TransferOperation.ShieldedTransfer, false],
    [TransferOperation.Unshield, false],
    [TransferOperation.ShieldedWithdrawal, false],
    [TransferOperation.IdentityCreateFromShielded, false],
  ] as const)('uses the send amount unit for %s', (operation, core) => {
    const params = sendPreviewParams({operation, recipients: [{address: 'recipient', amountDuffs: 123n}]})
    expect(params.recipients[0].amount).toBe(core ? 123n : duffsToCredits(123n))
    expect(params.amountDuffs).toBe(core ? 123n : null)
    expect(params.amountCredits).toBe(core ? 0n : duffsToCredits(123n))
  })

  it('preserves duplicate Core outputs, manual outpoints and custom change', () => {
    const params = sendPreviewParams({
      operation: TransferOperation.CoreSend,
      recipients: [{address: 'same', amountDuffs: 10n}, {address: 'same', amountDuffs: 20n}],
      coreSource: {kind: 'outpoints', outpoints: [{txid: 'tx', vout: 3}]}, changeTo: 'custom-change',
    })
    expect(params.recipients).toEqual([{address: 'same', amount: 10n}, {address: 'same', amount: 20n}])
    expect(params.amountDuffs).toBe(30n)
    expect(params.coreSource).toEqual({kind: 'outpoints', outpoints: [{txid: 'tx', vout: 3}]})
    expect(params.changeTo).toBe('custom-change')
  })

  it('keeps Platform recipient ordering and the selected output fee index aligned', () => {
    const params = sendPreviewParams({
      operation: TransferOperation.AddressFundsTransfer,
      recipients: [{address: 'first', amountDuffs: 10n}, {address: 'second', amountDuffs: 20n}],
      platformSource: {
        kind: 'inputs', inputs: [{address: 'source', credits: 30000n}],
        feeStrategy: [{kind: 'reduceOutput', index: 1}],
      },
    })
    expect(params.recipients).toEqual([{address: 'first', amount: 10000n}, {address: 'second', amount: 20000n}])
    expect(params.platformSource).toEqual({
      kind: 'inputs', inputs: [{address: 'source', credits: 30000n}], feeStrategy: [{kind: 'reduceOutput', index: 1}],
    })
  })

  it('passes a fixed Shield source through fromAddress instead of Platform coin control', () => {
    const params = sendPreviewParams({
      operation: TransferOperation.Shield, recipients: [{address: 'shielded', amountDuffs: 5n}],
      fromAddress: 'fixed-source', platformSource: {kind: 'address', address: 'old-source'},
    })
    expect(params.fromAddress).toBe('fixed-source')
    expect(params.platformSource).toBeUndefined()
  })

  it('passes the selected identity and shielded note indexes only on their own routes', () => {
    const common = {recipients: [{address: 'destination', amountDuffs: 5n}], identityId: 'identity', shieldedSource: {kind: 'notes' as const, noteIndexes: [2, 7]}}
    const identity = sendPreviewParams({...common, operation: TransferOperation.IdentityToIdentity})
    expect(identity.identityId).toBe('identity')
    expect(identity.shieldedSource).toBeUndefined()
    const shielded = sendPreviewParams({...common, operation: TransferOperation.ShieldedTransfer})
    expect(shielded.identityId).toBeUndefined()
    expect(shielded.shieldedSource).toEqual({kind: 'notes', noteIndexes: [2, 7]})
  })

  it.each([TransferOperation.IdentityRegister, TransferOperation.IdentityCreate, TransferOperation.IdentityCreateFromShielded])('does not reuse a previous destination for %s', operation => {
    const params = sendPreviewParams({operation, recipients: [{address: 'previous-destination', amountDuffs: 100n}]})
    expect(params.recipients[0].address).toBe('')
  })

  it('does not pass a Core change address to an asset lock', () => {
    const params = sendPreviewParams({operation: TransferOperation.AssetLockFunding, recipients: [{address: 'recipient', amountDuffs: 10n}], changeTo: 'old-change'})
    expect(params.changeTo).toBeUndefined()
  })
})

describe('backend preview display mapping', () => {
  it('uses returned automatic Core inputs, actual change and dust-inclusive fee', () => {
    const data = mapSendTransactionPreview({operation: TransferOperation.CoreSend, from: 'Core', preview: preview({
      inputs: [entry('input', 10000n, 'duffs', 'source', 'tx:2')],
      outputs: [entry('recipient', 9500n, 'duffs', 'recipient')], feeDuffs: 500n, feeCredits: null, unsignedHex: 'deadbeef',
    })})
    expect(data.inputs[0]).toMatchObject({amount: 10000n, unit: 'duffs', reference: 'tx:2'})
    expect(data.outputGroups[0].rows).toHaveLength(1)
    expect(data.amountCredits).toBe(duffsToCredits(9500n))
    expect(data.totalDebitCredits).toBe(duffsToCredits(10000n))
    expect(data.feeDuffs).toBe(500n)
    expect(data.unsignedHex).toBe('deadbeef')
  })

  it('keeps actual change separate from recipients and total debit', () => {
    const data = mapSendTransactionPreview({operation: TransferOperation.CoreSend, from: 'Core', preview: preview({
      inputs: [entry('input', 20000n, 'duffs')],
      outputs: [entry('recipient', 10000n, 'duffs'), entry('change', 9500n, 'duffs', 'custom-change')],
      feeDuffs: 500n, feeCredits: null,
    })})
    expect(data.amountCredits).toBe(10000000n)
    expect(data.totalDebitCredits).toBe(10500000n)
    expect(data.outputGroups[0].rows[1]).toMatchObject({role: 'change', address: 'custom-change', amount: 9500n})
  })

  it('does not double count asset lock credit or reconstruct debit from rounded L2 fees', () => {
    const data = mapSendTransactionPreview({operation: TransferOperation.AssetLockFunding, from: 'Core', preview: preview({
      inputs: [entry('input', 20000n, 'duffs')],
      outputs: [entry('recipient', 10000n, 'duffs', 'platform'), entry('credit', 10002n, 'duffs', 'credit'), entry('change', 9498n, 'duffs', 'change')],
      feeDuffs: 500n, feeCredits: 1001n,
    })})
    expect(data.amountCredits).toBe(10000000n)
    expect(data.totalDebitCredits).toBe(10502000n)
    expect(data.fees).toEqual([
      {label: 'L1 network fee', amount: 500n, unit: 'duffs'},
      {label: 'Platform network fee', amount: 1001n, unit: 'credits'},
    ])
    expect(data.outputGroups.map(group => group.rows.map(row => row.role))).toEqual([['credit', 'change'], ['recipient']])
    expect(data.unsignedLabel).toBe('Unsigned L1 asset lock')
  })

  it('uses Platform debits including feeInput and preserves already reduced recipients', () => {
    const data = mapSendTransactionPreview({operation: TransferOperation.AddressFundsTransfer, from: 'Platform', preview: preview({
      inputs: [entry('feeInput', 51000n), entry('input', 49000n)],
      outputs: [entry('recipient', 10000n, 'credits', 'same'), entry('recipient', 88000n, 'credits', 'same')],
      feeCredits: 2000n,
    })})
    expect(data.amountCredits).toBe(98000n)
    expect(data.totalDebitCredits).toBe(100000n)
    expect(data.outputGroups[0].rows.map(row => row.amount)).toEqual([10000n, 88000n])
    expect(data.inputs[0].role).toBe('feeInput')
  })

  it('keeps exact credit amounts and unnamed shielded change without inventing unsigned bytes', () => {
    const data = mapSendTransactionPreview({operation: TransferOperation.ShieldedTransfer, from: 'Shielded', preview: preview({
      inputs: [entry('input', 100005n, 'credits', 'shielded-source', 'note 7')],
      outputs: [entry('recipient', 50000n, 'credits', 'shielded-recipient'), entry('change', 48004n, 'credits', '')],
      feeCredits: 2001n, unsignedHex: null,
    })})
    expect(data.totalDebitCredits).toBe(52001n)
    expect(data.outputGroups[0].rows[1]).toMatchObject({address: '', addressLabel: 'Your shielded balance', role: 'change', amount: 48004n})
    expect(data.unsignedHex).toBeNull()
  })

  it('uses the backend net identity credit, leaving the denomination fee counted once', () => {
    const data = mapSendTransactionPreview({operation: TransferOperation.IdentityCreateFromShielded, from: 'Shielded', preview: preview({
      inputs: [entry('input', 120000n)], outputs: [entry('recipient', 98000n, 'credits', ''), entry('change', 20000n, 'credits', '')],
      feeCredits: 2000n, unsignedHex: null,
    })})
    expect(data.amountCredits).toBe(98000n)
    expect(data.totalDebitCredits).toBe(100000n)
    expect(data.outputGroups[0].rows[0].addressLabel).toBe('New Platform identity')
  })

  it('keeps a shielded note reference when its stored address is unavailable', () => {
    const data = mapSendTransactionPreview({operation: TransferOperation.ShieldedTransfer, from: 'Shielded', preview: preview({
      inputs: [entry('input', 102000n, 'credits', '', 'note 3')], unsignedHex: null,
    })})
    expect(data.inputs[0]).toMatchObject({address: '', addressLabel: 'Address unavailable', reference: 'note 3'})
  })
})

describe('preview request identity and asynchronous results', () => {
  it('matches equivalent refreshed params and changes for a recipient, wallet, network or change address', () => {
    const params = sendPreviewParams({operation: TransferOperation.CoreSend, recipients: [{address: 'to', amountDuffs: 123n}], changeTo: 'change'})
    const request = {walletId: 'wallet', network: 'testnet' as const, operation: TransferOperation.CoreSend, params}
    const key = sendPreviewRequestKey(request)
    expect(sendPreviewRequestKey({...request, params: {...params, recipients: params.recipients.map(recipient => ({...recipient}))}})).toBe(key)
    expect(sendPreviewRequestKey({...request, walletId: 'other'})).not.toBe(key)
    expect(sendPreviewRequestKey({...request, network: 'mainnet'})).not.toBe(key)
    expect(sendPreviewRequestKey({...request, params: {...params, changeTo: 'other-change'}})).not.toBe(key)
    expect(sendPreviewRequestKey({...request, params: {...params, recipients: [{address: 'other', amount: 123n}]}})).not.toBe(key)
    expect(params.recipients[0].amount).toBe(123n)
  })

  it('rejects a late success or failure from the previous request', () => {
    const data = mapSendTransactionPreview({operation: TransferOperation.AddressFundsTransfer, from: 'Platform', preview: preview()})
    const first = sendPreviewReducer(SEND_PREVIEW_INITIAL_STATE, {type: 'start', requestId: 1})
    const second = sendPreviewReducer(first, {type: 'start', requestId: 2})
    expect(sendPreviewReducer(second, {type: 'loaded', requestId: 1, data})).toBe(second)
    expect(sendPreviewReducer(second, {type: 'failed', requestId: 1, error: 'old error'})).toBe(second)
    expect(sendPreviewReducer(second, {type: 'loaded', requestId: 2, data})).toMatchObject({requestId: 2, loading: false, error: null, data})
  })

  it('tracks selected input amounts and fee strategy without depending on object identity', () => {
    const params = sendPreviewParams({
      operation: TransferOperation.AddressFundsTransfer, recipients: [{address: 'to', amountDuffs: 20n}],
      platformSource: {kind: 'inputs', inputs: [{address: 'source', credits: 22000n}], feeStrategy: [{kind: 'deductFromInput', address: 'source'}]},
    })
    const request = {walletId: 'wallet', network: 'testnet' as const, operation: TransferOperation.AddressFundsTransfer, params}
    const key = sendPreviewRequestKey(request)
    expect(sendPreviewRequestKey({...request, params: {...params, platformSource: {
      kind: 'inputs', inputs: [{address: 'source', credits: 22000n}], feeStrategy: [{kind: 'deductFromInput', address: 'source'}],
    }}})).toBe(key)
    expect(sendPreviewRequestKey({...request, params: {...params, platformSource: {
      kind: 'inputs', inputs: [{address: 'source', credits: 20000n}], feeStrategy: [{kind: 'reduceOutput', index: 0}],
    }}})).not.toBe(key)
  })

  it('clears a failed result for retry and ignores completion after closing', () => {
    const data = mapSendTransactionPreview({operation: TransferOperation.AddressFundsTransfer, from: 'Platform', preview: preview()})
    const pending = sendPreviewReducer(SEND_PREVIEW_INITIAL_STATE, {type: 'start', requestId: 1})
    const failed = sendPreviewReducer(pending, {type: 'failed', requestId: 1, error: 'network error'})
    expect(failed).toMatchObject({loading: false, error: 'network error', data: null})
    const retry = sendPreviewReducer(failed, {type: 'start', requestId: 2})
    expect(retry).toMatchObject({loading: true, error: null, data: null})
    const closed = sendPreviewReducer(retry, {type: 'reset'})
    expect(sendPreviewReducer(closed, {type: 'loaded', requestId: 2, data})).toBe(closed)
  })
})
