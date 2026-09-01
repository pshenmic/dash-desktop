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
    case 'shieldedTransfer': {
      // The bundle builder is the only one that fans out, and it carries a memo
      // per output rather than one for the transition, so its arguments do not
      // fit createStateTransition's flat map.
      if (recipients.length > 1) {
        const builder = await sdk.shielded.getShieldedBuilder()
        const outputs = recipients.map(recipient => new ShieldedOutputWASM(
          OrchardAddressWASM.fromBech32m(recipient.address),
          recipient.amountCredits,
          ShieldedMemoWASM.empty(),
        ))
        const {stateTransition} = await builder.shieldedTransferMulti(
          spends, outputs, changeAddress, seed, COIN_TYPE[network], SHIELDED_ACCOUNT, anchor,
        )
        return stateTransition
      }
      return sdk.shielded.createStateTransition('shieldedTransfer', {
        ...base,
        recipient: OrchardAddressWASM.fromBech32m(recipients[0].address),
        transferAmount: amount,
      })
    }

    case 'unshield':
      return sdk.shielded.createStateTransition('unshield', {
        ...base,
        outputAddress: recipients[0].address,
        unshieldAmount: amount,
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
        denomination: amount,
        sendToAddressOnCreationFailure: payload.failureAddress,
      })
    }

    case 'shieldedWithdrawal':
      return sdk.shielded.createStateTransition('shieldedWithdrawal', {
        ...base,
        withdrawalAmount: amount,
        outputScript: coreAddressToScript(recipients[0].address, network),
        coreFeePerByte: payload.coreFeePerByte,
        pooling: 'Never',
      })
  }
}
