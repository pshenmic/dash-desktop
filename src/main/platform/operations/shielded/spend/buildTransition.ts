import {DashPlatformSDK} from 'dash-platform-sdk'
import {OrchardAddressWASM, ShieldedMemoWASM, SpendableNoteWASM, StateTransitionWASM} from 'pshenmic-dpp'
import {Network} from '../../../../src/types/Network'
import {coreAddressToScript} from '../../../../src/utils/coreScript'
import {PlatformOperations} from '../../../types/messages'
import {COIN_TYPE, SHIELDED_ACCOUNT} from '../../../../src/constants'
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
  const {seed, recipient} = payload
  const amount = payload.amountCredits
  const base = {
    spends,
    changeAddress,
    seed,
    coinType: COIN_TYPE[network],
    account: SHIELDED_ACCOUNT,
    anchor,
    memo: ShieldedMemoWASM.empty() as unknown as string,
  }

  switch (payload.kind) {
    case 'shieldedTransfer':
      return sdk.shielded.createStateTransition('shieldedTransfer', {
        ...base,
        recipient: OrchardAddressWASM.fromBech32m(recipient),
        transferAmount: amount,
      })

    case 'unshield':
      return sdk.shielded.createStateTransition('unshield', {
        ...base,
        outputAddress: recipient,
        unshieldAmount: amount,
      })

    case 'identityCreateFromPool': {
      if (payload.identityIndex == null || payload.failureAddress == null) {
        throw new Error('Identity creation needs an identity index and a failure refund address')
      }
      const keys = identityKeys(sdk, seed, network, payload.identityIndex)
      return sdk.shielded.createStateTransition('identityCreateFromShieldedPool', {
        ...base,
        publicKeys: keys.publicKeys,
        privateKeys: keys.privateKeys,
        denomination: amount,
        sendToAddressOnCreationFailure: payload.failureAddress,
      })
    }

    case 'shieldedWithdrawal':
      return sdk.shielded.createStateTransition('shieldedWithdrawal', {
        ...base,
        withdrawalAmount: amount,
        outputScript: coreAddressToScript(recipient, network),
        coreFeePerByte: payload.coreFeePerByte,
        pooling: 'Never',
      })
  }
}
