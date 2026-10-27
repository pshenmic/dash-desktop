import { describe, it, expect } from 'vitest'
import { simpleSendSubmit } from '../../src/renderer/src/utils/simpleSend'
import { SIMPLE_SEND_LABELS, SIMPLE_SEND_PROVER_ERROR } from '../../src/renderer/src/constants/simpleSend'
import { ShieldedProverState } from '../../src/renderer/src/enums/ShieldedProverState'
import { TransferOperation } from '../../src/renderer/src/enums/TransferOperation'
import type { SimpleSendSubmitInput } from '../../src/renderer/src/types/SimpleSend'

const PROVER_READY = { prover: ShieldedProverState.Ready, ready: true, error: null }
const PROVER_PREPARING = { prover: ShieldedProverState.Preparing, ready: false, error: null }

function input(overrides: Partial<SimpleSendSubmitInput> = {}): SimpleSendSubmitInput {
  return {
    operation: TransferOperation.CoreSend,
    sourceValid: true,
    password: 'secret',
    verifying: false,
    prover: PROVER_PREPARING,
    ...overrides,
  }
}

describe('simpleSendSubmit', () => {
  it('is ready with a typed password and a valid source, without waiting for the prover on a Core send', () => {
    expect(simpleSendSubmit(input())).toEqual({ ready: true, label: SIMPLE_SEND_LABELS.send, proverError: null })
  })

  it('is not ready while the password is empty', () => {
    expect(simpleSendSubmit(input({ password: '' })).ready).toBe(false)
  })

  it('is not ready when the signing source is no longer valid', () => {
    expect(simpleSendSubmit(input({ sourceValid: false })).ready).toBe(false)
  })

  it('shows the verifying label and blocks a second submit while verifying', () => {
    expect(simpleSendSubmit(input({ verifying: true }))).toEqual({
      ready: false,
      label: SIMPLE_SEND_LABELS.verifying,
      proverError: null,
    })
  })

  it('waits for the prover on shield and shielded spends', () => {
    for (const operation of [TransferOperation.Shield, TransferOperation.ShieldedTransfer, TransferOperation.IdentityCreateFromShielded]) {
      expect(simpleSendSubmit(input({ operation }))).toEqual({
        ready: false,
        label: SIMPLE_SEND_LABELS.preparing,
        proverError: null,
      })
      expect(simpleSendSubmit(input({ operation, prover: PROVER_READY }))).toEqual({
        ready: true,
        label: SIMPLE_SEND_LABELS.send,
        proverError: null,
      })
    }
  })

  it('prefers the verifying label over the preparing label', () => {
    expect(simpleSendSubmit(input({ operation: TransferOperation.Shield, verifying: true })).label).toBe(SIMPLE_SEND_LABELS.verifying)
  })

  it('reports a failed prover and stays blocked', () => {
    const failed = { prover: ShieldedProverState.Error, ready: false, error: 'params missing' }
    expect(simpleSendSubmit(input({ operation: TransferOperation.Unshield, prover: failed }))).toEqual({
      ready: false,
      label: SIMPLE_SEND_LABELS.send,
      proverError: `${SIMPLE_SEND_PROVER_ERROR.prefix} params missing`,
    })
    expect(simpleSendSubmit(input({ operation: TransferOperation.Shield, prover: { ...failed, error: null } })).proverError)
      .toBe(`${SIMPLE_SEND_PROVER_ERROR.prefix} ${SIMPLE_SEND_PROVER_ERROR.unknown}`)
  })

  it('ignores a failed prover for operations that do not prove', () => {
    const failed = { prover: ShieldedProverState.Error, ready: false, error: 'params missing' }
    expect(simpleSendSubmit(input({ operation: TransferOperation.AddressFundsTransfer, prover: failed }))).toEqual({
      ready: true,
      label: SIMPLE_SEND_LABELS.send,
      proverError: null,
    })
    expect(simpleSendSubmit(input({ operation: null, sourceValid: false, prover: failed }))).toEqual({
      ready: false,
      label: SIMPLE_SEND_LABELS.send,
      proverError: null,
    })
  })
})
