import {setTimeout as delay} from 'node:timers/promises'
import {DashPlatformSDK} from 'dash-platform-sdk'
import {StateTransitionWASM} from 'pshenmic-dpp'
import {Logger} from '../../src/utils/logger'
import {isAlreadyInChain} from '../../src/utils/sdkErrors'
import {consensusMessage} from './consensusMessage'
import {BroadcastOptions, OperationContext, OperationError, throwIfAborted} from './types'
import {CORE_HEIGHT_POLL_MS, CORE_HEIGHT_WAIT_MS} from '../constants'

const log = new Logger('platform')

// A transition an asset lock funds can only ever be accepted once; only those
// pass `idempotent`, since a nonce conflict can belong to a different transition.
export async function broadcast(
  sdk: DashPlatformSDK,
  st: StateTransitionWASM,
  ctx: OperationContext,
  options: BroadcastOptions = {},
): Promise<string> {
  const stHash = st.hash(false)

  if (options.requiredCoreHeight != null) {
    await waitForCoreHeight(sdk, options.requiredCoreHeight, ctx)
  }
  throwIfAborted(ctx.signal)

  ctx.progress('broadcasting', 0, 0)
  try {
    await sdk.stateTransitions.broadcast(st)
  } catch (e) {
    const message = consensusMessage(e)
    log.error(`failed broadcast (${message}) ${stHash}`)
    log.debug(`st hex: ${st.hex()}`)
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

async function waitForCoreHeight(
  sdk: DashPlatformSDK,
  requiredHeight: number,
  ctx: OperationContext,
): Promise<void> {
  const deadline = Date.now() + CORE_HEIGHT_WAIT_MS
  ctx.progress('fetching', 0, requiredHeight)
  while (Date.now() < deadline) {
    throwIfAborted(ctx.signal)
    const status = await sdk.node.status().catch(() => null)
    throwIfAborted(ctx.signal)
    const height = status?.chain?.coreChainLockedHeight
    ctx.progress('fetching', height ?? 0, requiredHeight)
    if (Date.now() >= deadline) break
    if (height != null && height >= requiredHeight) return
    await delay(Math.min(CORE_HEIGHT_POLL_MS, deadline - Date.now()), undefined, {signal: ctx.signal})
  }
  throwIfAborted(ctx.signal)
  throw new OperationError(`Timed out waiting for Platform consensus Core height to reach ${requiredHeight}`, 'network')
}
