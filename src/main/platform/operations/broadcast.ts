import {DashPlatformSDK} from 'dash-platform-sdk'
import {StateTransitionWASM} from 'pshenmic-dpp'
import {Logger} from '../../src/utils/logger'
import {isAlreadyInCache, isAlreadyInChain} from '../../src/utils/sdkErrors'
import {consensusMessage} from './consensusMessage'
import {OperationContext, OperationError} from './types'

const log = new Logger('platform')

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
    if (isAlreadyInCache(message)) log.debug(`failed broadcast (tx already in cache) ${stHash}: ${message}`)
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
    throw new OperationError(consensusMessage(e), 'network', stHash)
  }

  return stHash
}
