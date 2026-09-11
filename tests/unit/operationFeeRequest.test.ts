import { describe, expect, it } from 'vitest'
import type { OperationFeeParams } from '../../src/renderer/src/api/types'
import { TransferOperation } from '../../src/renderer/src/enums/TransferOperation'
import { operationFeeRequest } from '../../src/renderer/src/utils/operationFee'

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

  it('still requires a wallet, an operation and destinations for routes that need them', () => {
    expect(operationFeeRequest(null, TransferOperation.CoreSend, params())).toBeNull()
    expect(operationFeeRequest('wallet', null, params())).toBeNull()
    expect(operationFeeRequest('wallet', TransferOperation.IdentityWithdrawal, params())).toBeNull()
    const first = operationFeeRequest('wallet', TransferOperation.IdentityWithdrawal, params({destinationValid: true, recipient: 'first'}))!
    const second = operationFeeRequest('wallet', TransferOperation.IdentityWithdrawal, params({destinationValid: true, recipient: 'second'}))!
    expect(first.key).not.toBe(second.key)
  })
})
