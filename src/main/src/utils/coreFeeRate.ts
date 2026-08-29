import {Input, Output, Script, Transaction} from 'dash-core-sdk'
import {CORE_FEE_PER_BYTE} from '../constants/chain'

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

export function coreFeeDuffsFor(multiplier: number, inputsCount: number, outputsCount: number, withChange: boolean): bigint {
  const feePerByte = coreFeePerByte(multiplier)

  // dummy script which bigger than 99% of sigs
  const dummyScript = new Script(`OP_PUSHDATA1 ${'0'.repeat(288)}`)

  const dummyInputs: Input[] = []
  const dummyOutputs: Output[] = []

  for(let i = 0; i < inputsCount; i++) {
    dummyInputs.push(new Input('0'.repeat(64), 1, dummyScript, 0))
  }

  for(let i = 0; i < outputsCount; i++) {
    dummyOutputs.push(new Output(1n, dummyScript))
  }

  const tx = new Transaction(
    dummyInputs,
    dummyOutputs,
    0,
    0,
  )

  if(withChange) {
    tx.generateChange('111111111111111111111111133izVn', BigInt(tx.bytes().length)*4n)
  }

  return BigInt(tx.bytes().length * feePerByte)
}
