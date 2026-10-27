import {PlatformOperations} from '../../types/messages'
import {OperationContext} from '../types'
import {contest} from './status'

type Payload = PlatformOperations['aliasContests']['payload']
type Result = PlatformOperations['aliasContests']['result']

// Which of the running contests the identities are contenders in, by the proved
// vote state: the list of contests comes from an unproven index.
export async function aliasContests({labels, identifiers}: Payload, ctx: OperationContext): Promise<Result> {
  const votes = await Promise.all(labels.map(async label => ({label, vote: await contest(ctx, label)})))

  return {
    contests: votes.flatMap(({label, vote}) => (vote?.contenders ?? [])
      .filter(contender => identifiers.includes(contender.identifier))
      .map(contender => ({identifier: contender.identifier, label}))),
  }
}
