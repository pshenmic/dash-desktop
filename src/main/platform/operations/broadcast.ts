import {DashPlatformSDK} from 'dash-platform-sdk'
import {StateTransitionWASM} from 'pshenmic-dpp'
import {isAlreadyInChain} from '../../src/utils/sdkErrors'
import {consensusMessage} from './consensusMessage'
import {OperationContext, OperationError} from './types'

// Broadcast and wait, with the hash attached to anything that goes wrong after
// the transition reached the network so main can tell "retry is safe" from
// "this may already be in a block".
// A transition an asset lock funds can only ever be accepted once, so a replay
// that comes back "already in chain" achieved what the caller asked for. Only
// those pass `idempotent` — for a nonce-bearing transition the same answer can
// mean a different transition consumed the nonce.
export async function broadcast(
  sdk: DashPlatformSDK,
  st: StateTransitionWASM,
  ctx: OperationContext,
  options: {idempotent?: boolean} = {},
): Promise<string> {
  const stHash = st.hash(false)

  ctx.progress('broadcasting', 0, 0)
  try {
    await sdk.stateTransitions.broadcast(st)
  } catch (e) {
    const message = consensusMessage(e)
    console.error(`[platform] broadcast failed ${stHash}: ${message}\n[platform] transition hex: ${st.hex()}`)
    const alreadyInChain = isAlreadyInChain(message)
    if (alreadyInChain && options.idempotent === true) return stHash
    throw new OperationError(
      message,
      alreadyInChain ? 'alreadyInChain' : 'network',
      alreadyInChain ? stHash : null,
    )
  }

  ctx.progress('awaitingResult', 0, 0)
  try {
    await sdk.stateTransitions.waitForStateTransitionResult(st)
  } catch (e) {
    const message = consensusMessage(e)
    console.error(`[platform] result failed ${stHash}: ${message}\n[platform] transition hex: ${st.hex()}`)
    throw new OperationError(message, 'network', stHash)
  }

  return stHash
}