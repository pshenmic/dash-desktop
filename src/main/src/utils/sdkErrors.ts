import {ALREADY_IN_CHAIN, STALE_INSTANT_LOCK_PROOF} from '../constants/credits'

function messageOf(error: unknown): string {
  return (error instanceof Error ? error.message : String(error ?? '')).toLowerCase()
}

export function isAlreadyInChain(error: unknown): boolean {
  return messageOf(error).includes(ALREADY_IN_CHAIN)
}

export function isStaleInstantLockProof(error: unknown): boolean {
  return messageOf(error).includes(STALE_INSTANT_LOCK_PROOF)
}