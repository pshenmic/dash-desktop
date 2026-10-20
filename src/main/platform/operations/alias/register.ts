import {PlatformOperations} from '../../types/messages'
import {OperationContext, OperationError} from '../types'
import {CONTEST_FUND_CREDITS, CONTEST_JOIN_WINDOW_MS, DPNS_PARENT_DOMAIN, VOTE_POLL_DURATION_MS} from '../../constants'
import {signingKey} from '../identity/signingKey'
import {aliasStatus} from './status'

type Payload = PlatformOperations['aliasRegister']['payload']
type Result = PlatformOperations['aliasRegister']['result']

// The SDK pays for the preorder before Drive can refuse the domain, so every
// refusal it can foresee is made here first.
export async function aliasRegister(payload: Payload, ctx: OperationContext): Promise<Result> {
  const {sdk, network} = ctx
  const {seed, identifier, identityIndex, label} = payload
  const name = `${label}.${DPNS_PARENT_DOMAIN}`

  const check = await aliasStatus({identifier, label}, ctx)
  if (check.status !== 'missing') {
    throw new OperationError(`${name} is ${check.status}`, 'internal')
  }
  // A missing name with an end date is in someone else's contest.
  if (check.voteEndsAt != null && Date.now() > check.voteEndsAt - VOTE_POLL_DURATION_MS[network] + CONTEST_JOIN_WINDOW_MS[network]) {
    throw new OperationError(`The contest for ${name} no longer accepts contenders`, 'internal')
  }
  if (check.isContested && await sdk.identities.getIdentityBalance(identifier) < CONTEST_FUND_CREDITS) {
    throw new OperationError(`${name} is contested and needs 0.2 DASH of identity credits for the vote`, 'insufficientFunds')
  }

  const {privateKey} = await signingKey(sdk, seed, network, identifier, identityIndex, 'AUTHENTICATION', 'HIGH')
  ctx.progress('broadcasting', 0, 0)
  await sdk.names.registerName(name, identifier, privateKey)
  return check
}
