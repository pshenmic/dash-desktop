import {OrchardAddressWASM, ShieldedMemoWASM} from 'pshenmic-dpp'
import {PlatformOperations} from '../../types/messages'
import {OperationContext, OperationError} from '../types'
import {broadcast} from '../broadcast'
import {shieldPoolFee} from '../fee'
import {platformVersion} from '../platformVersion'
import {DEDUCT_FROM_FIRST, toInputAddresses} from '../address/signInputs'
import {PLATFORM_ACCOUNT, SHIELDED_ACCOUNT} from '../../../src/constants/addresses'

type Payload = PlatformOperations['shield']['payload']
type Result = PlatformOperations['shield']['result']

export async function shield(payload: Payload, ctx: OperationContext): Promise<Result> {
  const {sdk, network} = ctx
  const {seed, inputs} = payload
  if (inputs.length === 0) throw new OperationError('A shield needs at least one input', 'internal')

  const privateKeys = await Promise.all(inputs.map(input =>
    sdk.keyPair.derivePlatformAddressPrivateKey(seed, network, PLATFORM_ACCOUNT, input.index)))
  const senderOvk = sdk.keyPair.deriveShieldedOutgoingViewingKey(seed, network, SHIELDED_ACCOUNT)

  // Input 0 also claims the pool fee, which the structure check requires the
  // claims to cover; the metered fee comes out of what input 0 leaves unclaimed.
  const version = await platformVersion(ctx)
  const [first, ...rest] = inputs
  const claims = [{...first, credits: first.credits + shieldPoolFee(version)}, ...rest]

  ctx.progress('proving', 0, 0)
  const stateTransition = await sdk.shielded.createStateTransition('shield', {
    recipient: OrchardAddressWASM.fromBech32m(payload.recipient),
    shieldAmount: payload.amountCredits,
    inputs: toInputAddresses(claims),
    privateKeys,
    feeStrategy: DEDUCT_FROM_FIRST,
    userFeeIncrease: 0,
    memo: ShieldedMemoWASM.empty() as unknown as string,
    senderOvk,
    platformVersion: version,
  })

  return {stHash: await broadcast(sdk, stateTransition, ctx)}
}
