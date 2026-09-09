import {DashPlatformSDK} from 'dash-platform-sdk'
import {AddressWitnessWASM, InputAddressWASM, AddressFundsFeeStrategyStepWASM} from 'dash-platform-sdk/types.js'
import {Network} from '../../../src/types/Network'
import {PLATFORM_ACCOUNT} from '../../../src/constants/addresses'
import {AddressInput} from '../../types/messages'
import {FeeStrategyStep} from '../../../src/types/PlatformTransfer'

// What a quote charges, and the wallet's default: the fee comes out of the
// first input. A priced transition has no strategy of its own to carry.
export const DEDUCT_FROM_FIRST = [AddressFundsFeeStrategyStepWASM.DeductFromInput(0)]

export const toInputAddresses = (inputs: AddressInput[]): InputAddressWASM[] =>
  inputs.map(input => new InputAddressWASM(input.platformAddress, input.nonce + 1, input.credits))

// Both indexes are positions in the inputs and outputs as this transition
// submits them, which main resolved them against.
export const toFeeStrategy = (steps: FeeStrategyStep[]): AddressFundsFeeStrategyStepWASM[] =>
  steps.map(step => step.kind === 'deductFromInput'
    ? AddressFundsFeeStrategyStepWASM.DeductFromInput(step.index)
    : AddressFundsFeeStrategyStepWASM.ReduceOutput(step.index))

export async function signInputs(
  sdk: DashPlatformSDK,
  signable: Uint8Array,
  inputs: AddressInput[],
  seed: Uint8Array,
  network: Network,
): Promise<AddressWitnessWASM[]> {
  const witnesses: AddressWitnessWASM[] = []
  for (const input of inputs) {
    const privateKey = await sdk.keyPair.derivePlatformAddressPrivateKey(seed, network, PLATFORM_ACCOUNT, input.index)
    witnesses.push(AddressWitnessWASM.P2PKH(privateKey.sign(signable)))
  }
  return witnesses
}
