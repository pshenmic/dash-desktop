import {PlatformOperations} from '../../types/messages'
import {OperationContext, OperationError} from '../types'
import {CONTEST_JOIN_WINDOW_MS, DPNS_PARENT_DOMAIN, VOTE_POLL_DURATION_MS} from '../../constants'
import {usernameRegisterFee} from '../fee'
import {signingKey} from '../identity/signingKey'
import {usernameStatus} from './status'
import {Logger} from '../../../src/utils/logger'

const log = new Logger('platform')

type Payload = PlatformOperations['usernameRegister']['payload']
type Result = PlatformOperations['usernameRegister']['result']

// The SDK pays for the preorder before Drive can refuse the domain, so every
// refusal it can foresee is made here first.
export async function usernameRegister(payload: Payload, ctx: OperationContext): Promise<Result> {
  const {sdk, network} = ctx
  const {seed, identifier, identityIndex, label} = payload
  const name = `${label}.${DPNS_PARENT_DOMAIN}`

  const check = await usernameStatus({identifier, label}, ctx)
  if (check.status !== 'missing') {
    throw new OperationError(`${name} is ${check.status}`, 'internal')
  }
  // A missing name whose vote has yet to end is in someone else's contest. One
  // that ended with no winner reopens, so registering it starts a new contest.
  const now = Date.now()
  const voteEndsAt = check.voteEndsAt ?? 0
  const joinClosesAt = voteEndsAt - VOTE_POLL_DURATION_MS[network] + CONTEST_JOIN_WINDOW_MS[network]
  if (voteEndsAt > now && now > joinClosesAt) {
    throw new OperationError(`The contest for ${name} no longer accepts contenders`, 'internal')
  }
  const [cost, balance] = await Promise.all([usernameRegisterFee(ctx, label, identifier), sdk.identities.getIdentityBalance(identifier)])
  const fixedCredits = cost.fixedCredits ?? 0n
  log.info(`${name}: free, contested=${check.isContested}, costs ${cost.feeCredits} + ${fixedCredits} of ${balance} credits`)
  if (balance < cost.feeCredits + fixedCredits) {
    throw new OperationError(`The identity cannot afford to register ${name}`, 'insufficientFunds')
  }

  const {privateKey} = await signingKey(sdk, seed, network, identifier, identityIndex, 'AUTHENTICATION', 'HIGH')
  ctx.progress('broadcasting', 0, 0)
  await sdk.names.registerName(name, identifier, privateKey)
  return usernameStatus({identifier, label}, ctx)
}
