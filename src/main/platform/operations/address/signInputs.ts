import {DashPlatformSDK} from 'dash-platform-sdk'
import {AddressWitnessWASM, InputAddressWASM, AddressFundsFeeStrategyStepWASM} from 'dash-platform-sdk/types.js'
import {Network} from '../../../src/types/Network'
import {PLATFORM_ACCOUNT} from '../../../src/constants'
import {AddressInput} from '../../types/messages'

// Fees come out of the first input for every address-funded transition.
export const DEDUCT_FROM_FIRST = [AddressFundsFeeStrategyStepWASM.DeductFromInput(0)]

export const toInputAddresses = (inputs: AddressInput[]): InputAddressWASM[] =>
  inputs.map(input => new InputAddressWASM(input.platformAddress, input.nonce + 1, input.credits))

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
