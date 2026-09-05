import {DashPlatformSDK} from 'dash-platform-sdk'
import {
  OrchardAddressWASM,
  ShieldedMemoWASM,
  ShieldedOutputWASM,
  SpendableNoteWASM,
  StateTransitionWASM,
} from 'pshenmic-dpp'
import {Network} from '../../../../src/types/Network'
import {coreAddressToScript} from '../../../../src/utils/coreScript'
import {PlatformOperations} from '../../../types/messages'
import {COIN_TYPE, SHIELDED_ACCOUNT} from '../../../../src/constants/addresses'
import {identityKeys} from './identityKeys'

type Payload = PlatformOperations['spend']['payload']
type ShieldedAddress = ReturnType<DashPlatformSDK['keyPair']['deriveShieldedAddress']>

export async function buildTransition(
  sdk: DashPlatformSDK,
  network: Network,
  payload: Payload,
  spends: SpendableNoteWASM[],
  anchor: Uint8Array,
  changeAddress: ShieldedAddress,
): Promise<StateTransitionWASM> {
  const {seed, recipients} = payload
  const spendInputs = {
    spends,
    changeAddress,
    seed,
    coinType: COIN_TYPE[network],
    account: SHIELDED_ACCOUNT,
    anchor,
  }
  // A multi-output bundle carries a memo per output instead of one for the
  // transition, so the memo is not part of what every spend shares.
  const base = {...spendInputs, memo: ShieldedMemoWASM.empty() as unknown as string}

  switch (payload.kind) {
    case 'shieldedTransfer':
      if (recipients.length > 1) {
        return sdk.shielded.createStateTransition('shieldedTransferMulti', {
          ...spendInputs,
          outputs: recipients.map(recipient => new ShieldedOutputWASM(
            OrchardAddressWASM.fromBech32m(recipient.address),
            recipient.amountCredits,
            ShieldedMemoWASM.empty(),
          )),
        })
      }
      return sdk.shielded.createStateTransition('shieldedTransfer', {
        ...base,
        recipient: OrchardAddressWASM.fromBech32m(recipients[0].address),
        transferAmount: recipients[0].amountCredits,
      })

    case 'unshield':
      return sdk.shielded.createStateTransition('unshield', {
        ...base,
        outputAddress: recipients[0].address,
        unshieldAmount: recipients[0].amountCredits,
      })

    case 'identityCreateFromShielded': {
      if (payload.identityIndex == null || payload.failureAddress == null) {
        throw new Error('Identity creation needs an identity index and a failure refund address')
      }
      const keys = identityKeys(sdk, seed, network, payload.identityIndex)
      return sdk.shielded.createStateTransition('identityCreateFromShieldedPool', {
        ...base,
        publicKeys: keys.publicKeys,
        privateKeys: keys.privateKeys,
        denomination: payload.amountCredits,
        sendToAddressOnCreationFailure: payload.failureAddress,
      })
    }

    case 'shieldedWithdrawal':
      return sdk.shielded.createStateTransition('shieldedWithdrawal', {
        ...base,
        withdrawalAmount: recipients[0].amountCredits,
        outputScript: coreAddressToScript(recipients[0].address, network),
        coreFeePerByte: payload.coreFeePerByte,
        pooling: 'Never',
      })
  }
}
