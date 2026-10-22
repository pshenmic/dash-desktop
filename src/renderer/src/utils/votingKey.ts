import type { Network } from '@renderer/api/types'
import { BASE58_PATTERN } from '@renderer/constants/identifierFormat'
import { ADDRESS_RULES, HEX_32_BYTE_PATTERN, OTHER_NETWORK, VOTING_KEY_MESSAGES, WIF_RULES } from '@renderer/constants/masternodes'
import { VotingKeyInputKind } from '@renderer/enums/Masternodes'
import type { WifRule } from '@renderer/types/Masternodes'

function matchesRule(value: string, rule: WifRule): boolean {
  return rule.lengths.includes(value.length) && rule.prefixes.some(prefix => value.startsWith(prefix))
}

export function classifyVotingKeyInput(input: string, network: Network): VotingKeyInputKind {
  const value = input.trim()
  if (value === '') return VotingKeyInputKind.Empty
  if (HEX_32_BYTE_PATTERN.test(value)) return VotingKeyInputKind.Hex
  if (!BASE58_PATTERN.test(value)) return VotingKeyInputKind.Invalid
  if (matchesRule(value, WIF_RULES[network])) return VotingKeyInputKind.Valid
  if (matchesRule(value, WIF_RULES[OTHER_NETWORK[network]])) return VotingKeyInputKind.WrongNetwork
  if (matchesRule(value, ADDRESS_RULES[network]) || matchesRule(value, ADDRESS_RULES[OTHER_NETWORK[network]])) {
    return VotingKeyInputKind.Address
  }
  return VotingKeyInputKind.Invalid
}

export function votingKeyMessage(kind: VotingKeyInputKind, network: Network): string {
  if (kind !== VotingKeyInputKind.WrongNetwork) return VOTING_KEY_MESSAGES[kind]
  return `${VOTING_KEY_MESSAGES[kind]} ${OTHER_NETWORK[network]}`
}

export function isProTxHash(value: string): boolean {
  return HEX_32_BYTE_PATTERN.test(value.trim())
}
