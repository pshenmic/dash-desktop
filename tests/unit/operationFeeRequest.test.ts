import { describe, expect, it } from 'vitest'
import type { IdentityKeyRequestDto, OperationFeeParams } from '../../src/renderer/src/api/types'
import { TransferOperation } from '../../src/renderer/src/enums/TransferOperation'
import { IdentityKeyPurpose, IdentityKeySecurityLevel } from '../../src/renderer/src/enums/IdentityKeys'
import { DASHPAY_KEY_BOUNDS } from '../../src/renderer/src/constants/dashPay'
import { operationFeeRequest } from '../../src/renderer/src/utils/operationFee'

const ENC_BOUND: IdentityKeyRequestDto = { purpose: IdentityKeyPurpose.Encryption, securityLevel: IdentityKeySecurityLevel.Medium, contractBounds: DASHPAY_KEY_BOUNDS }
const ENC_UNBOUND: IdentityKeyRequestDto = { ...ENC_BOUND, contractBounds: null }
const DEC_BOUND: IdentityKeyRequestDto = { ...ENC_BOUND, purpose: IdentityKeyPurpose.Decryption }

function params(overrides: Partial<OperationFeeParams> = {}): OperationFeeParams {
  return {
    destinationValid: false, recipient: [''], amountCredits: 0n, amountDuffs: 0n,
    coreSource: null, platformSource: null, identityId: null, shieldedSource: null,
    ...overrides,
  }
}

describe('operation fee requests', () => {
  it('prices every Core recipient block before its address or amount is entered', () => {
    const request = operationFeeRequest('wallet', TransferOperation.CoreSend, params({recipient: ['', '']}))
    expect(request).not.toBeNull()
    expect(request?.feeParams.recipient).toEqual(['', ''])
    expect(request?.feeParams).not.toHaveProperty('destinationValid')
    expect(request?.key).not.toBe(operationFeeRequest('wallet', TransferOperation.CoreSend, params())?.key)
  })

  it('does not invalidate a Core quote when addresses are typed, cleared or replaced', () => {
    const request = operationFeeRequest('wallet', TransferOperation.CoreSend, params())!
    for (const recipient of ['', 'partial', 'yPx8DNt1oQt3yubB2Sh73vAQRQ1AoyyLCS']) {
      for (const destinationValid of [false, true]) {
        const next = operationFeeRequest('wallet', TransferOperation.CoreSend, params({recipient: [recipient], destinationValid}))!
        expect(next.key).toBe(request.key)
        expect(next.maxKey).toBe(request.maxKey)
      }
    }
  })

  it('reuses the Core maximum while repricing a different amount', () => {
    const initial = operationFeeRequest('wallet', TransferOperation.CoreSend, params())!
    const changed = operationFeeRequest('wallet', TransferOperation.CoreSend, params({amountDuffs: 100_000_000n}))!
    expect(changed.key).not.toBe(initial.key)
    expect(changed.maxKey).toBe(initial.maxKey)
  })

  it('invalidates the maximum when the wallet, source or number of outputs changes', () => {
    const initial = operationFeeRequest('wallet', TransferOperation.CoreSend, params())!
    const changes = [
      operationFeeRequest('other-wallet', TransferOperation.CoreSend, params()),
      operationFeeRequest('wallet', TransferOperation.CoreSend, params({coreSource: {kind: 'address', address: 'source'}})),
      operationFeeRequest('wallet', TransferOperation.CoreSend, params({recipient: ['', '']})),
    ]
    for (const next of changes) expect(next?.maxKey).not.toBe(initial.maxKey)
  })

  it('invalidates a shield maximum when a source is picked or cleared', () => {
    const shield = (address: string | null) =>
      operationFeeRequest('wallet', TransferOperation.Shield, params({
        destinationValid: true, recipient: 'shielded', platformSource: address ? {kind: 'address', address} : null,
      }))!
    expect(shield('picked').maxKey).not.toBe(shield(null).maxKey)
    expect(shield('picked').feeParams.platformSource).toEqual({kind: 'address', address: 'picked'})
  })

  it('still requires a wallet, an operation and destinations for routes that need them', () => {
    expect(operationFeeRequest(null, TransferOperation.CoreSend, params())).toBeNull()
    expect(operationFeeRequest('wallet', null, params())).toBeNull()
    expect(operationFeeRequest('wallet', TransferOperation.IdentityWithdrawal, params())).toBeNull()
    const first = operationFeeRequest('wallet', TransferOperation.IdentityWithdrawal, params({destinationValid: true, recipient: 'first'}))!
    const second = operationFeeRequest('wallet', TransferOperation.IdentityWithdrawal, params({destinationValid: true, recipient: 'second'}))!
    expect(first.key).not.toBe(second.key)
  })

  it('re-quotes an identity key update whenever the key selection changes', () => {
    const createKeys = (keys: IdentityKeyRequestDto[] | null | undefined) =>
      operationFeeRequest('wallet', TransferOperation.IdentityUpdateKeys, params({destinationValid: true, recipient: '', identityId: 'IdentityA', keys}))!
    const selections = [createKeys([ENC_BOUND]), createKeys([ENC_UNBOUND]), createKeys([ENC_BOUND, DEC_BOUND]), createKeys([DEC_BOUND, ENC_BOUND]), createKeys([])]
    expect(new Set(selections.map(request => request.maxKey)).size).toBe(selections.length)
    expect(new Set(selections.map(request => request.key)).size).toBe(selections.length)
    expect(createKeys([ENC_BOUND, DEC_BOUND]).key).toBe(createKeys([{...ENC_BOUND}, {...DEC_BOUND}]).key)
    expect(createKeys(null).key).toBe(createKeys([]).key)
    const disableKeys = (keyIds: number[] | null) =>
      operationFeeRequest('wallet', TransferOperation.IdentityUpdateKeys, params({destinationValid: true, recipient: '', identityId: 'IdentityA', keyIds}))!
    expect(disableKeys([1]).maxKey).not.toBe(disableKeys([2]).maxKey)
    expect(disableKeys(null).maxKey).toBe(disableKeys([]).maxKey)
    expect(createKeys(undefined).key).toBe(createKeys([]).key)
    expect(createKeys([ENC_BOUND]).feeParams.keys).toEqual([ENC_BOUND])
  })
})
