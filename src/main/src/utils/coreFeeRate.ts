import {Input, Output, Script, Transaction} from 'dash-core-sdk'
import {CORE_FEE_PER_BYTE} from '../constants/chain'
import {getCompactVariableSize} from "dash-core-sdk/src/utils.js";

// Consensus rejects a withdrawal whose coreFeePerByte is not a non-zero
// Fibonacci number, so a multiplied rate has to be snapped onto the sequence.
export function coreFeePerByte(multiplier: number): number {
  const target = CORE_FEE_PER_BYTE * multiplier

  let rate = 1
  let next = 1
  while (rate < target) {
    const sum = rate + next
    rate = next
    next = sum
  }

  return rate
}

export function coreFeeDuffsFor(multiplier: number, inputsCount: number, outputsCount: number, withChange: boolean, payloadBytes = 0): bigint {
  const feePerByte = coreFeePerByte(multiplier)

  // dummy script which bigger than 99% of sigs
  const dummyScript = new Script(`OP_PUSHDATA1 ${'0'.repeat(288)}`)


  const dummyInput = new Input('0'.repeat(64), 1, dummyScript, 0)
  const dummyOutput = new Output(1n, dummyScript)

  const tx = new Transaction(
    [dummyInput],
    [dummyOutput],
    0,
    0,
  )

  if(withChange) {
    tx.outputs.push(Output.createP2PKH(1n, '111111111111111111111111133izVn'))
  }

  // one already in tx
  const inputsSize = dummyInput.bytes().length * (inputsCount - 1) + getCompactVariableSize(inputsCount) - 1
  const outputsSize = dummyOutput.bytes().length * (outputsCount - 1) + getCompactVariableSize(outputsCount) - 1

  return BigInt((tx.bytes().length + inputsSize + outputsSize + payloadBytes) * feePerByte)
}
