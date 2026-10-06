import type {ValidatorSet} from 'dash-platform-sdk/src/node/getCurrentQuorumsInfo.js'
import type {Evonode} from '../../platform/types/messages'

// One evonode sits in several validator sets at once.
export function quorumEvonodes(validatorSets: ValidatorSet[], port: number): Evonode[] {
  const evonodes = new Map<string, Evonode>()
  for (const member of validatorSets.flatMap(set => set.members)) {
    if (member.isBanned) continue
    evonodes.set(member.proTxHash, {proTxHash: member.proTxHash, dapiUrl: `https://${member.nodeIp}:${port}`})
  }
  return [...evonodes.values()]
}
