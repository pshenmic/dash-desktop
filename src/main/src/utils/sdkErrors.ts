import {ALREADY_IN_CHAIN} from '../constants/credits'

export function isAlreadyInChain(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '')
  return message.toLowerCase().includes(ALREADY_IN_CHAIN)
}