import {DashPlatformSDK} from 'dash-platform-sdk'
import {StateTransitionWASM} from 'pshenmic-dpp'
import {consensusMessage} from './consensusMessage'
import {OperationContext, OperationError} from './types'

// Broadcast and wait, with the hash attached to anything that goes wrong after
// the transition reached the network so main can tell "retry is safe" from
// "this may already be in a block".
export async function broadcast(
  sdk: DashPlatformSDK,
  st: StateTransitionWASM,
  ctx: OperationContext,
): Promise<string> {
  const stHash = st.hash(false)

  ctx.progress('broadcasting', 0, 0)
  try {
    await sdk.stateTransitions.broadcast(st)
  } catch (e) {
    const message = consensusMessage(e)
    const code = /already in chain|already exists/i.test(message) ? 'alreadyInChain' : 'network'
    throw new OperationError(message, code, code === 'alreadyInChain' ? stHash : null)
  }

  ctx.progress('awaitingResult', 0, 0)
  try {
    await sdk.stateTransitions.waitForStateTransitionResult(st)
  } catch (e) {
    throw new OperationError(consensusMessage(e), 'network', stHash)
  }

  return stHash
}