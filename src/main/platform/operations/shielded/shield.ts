import {AddressFundsFeeStrategyStepWASM, InputAddressWASM} from 'dash-platform-sdk/types.js'
import {OrchardAddressWASM, ShieldedMemoWASM} from 'pshenmic-dpp'
import {PlatformOperations} from '../../types/messages'
import {OperationContext} from '../types'
import {broadcast} from '../broadcast'
import {PLATFORM_ACCOUNT, SHIELDED_ACCOUNT} from '../../../src/constants'

type Payload = PlatformOperations['shield']['payload']
type Result = PlatformOperations['shield']['result']

export async function shield(payload: Payload, ctx: OperationContext): Promise<Result> {
  const {sdk, network} = ctx
  const {seed, source} = payload

  const privateKey = await sdk.keyPair.derivePlatformAddressPrivateKey(seed, network, PLATFORM_ACCOUNT, source.index)
  const senderOvk = sdk.keyPair.deriveShieldedOutgoingViewingKey(seed, network, SHIELDED_ACCOUNT)

  ctx.progress('proving', 0, 0)
  const stateTransition = await sdk.shielded.createStateTransition('shield', {
    recipient: OrchardAddressWASM.fromBech32m(payload.recipient),
    shieldAmount: payload.amountCredits,
    inputs: [new InputAddressWASM(source.platformAddress, source.nonce + 1, source.balanceCredits)],
    privateKeys: [privateKey],
    feeStrategy: [AddressFundsFeeStrategyStepWASM.DeductFromInput(0)],
    userFeeIncrease: 0,
    memo: ShieldedMemoWASM.empty() as unknown as string,
    senderOvk,
  })

  return {stHash: await broadcast(sdk, stateTransition, ctx)}
}