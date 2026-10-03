import {ALREADY_IN_CHAIN, STALE_INSTANT_LOCK_PROOF} from '../constants/credits'
import {GRPC_NOT_FOUND} from '../constants/chain'

function messageOf(error: unknown): string {
  return (error instanceof Error ? error.message : String(error ?? '')).toLowerCase()
}

export function isAlreadyInChain(error: unknown): boolean {
  return messageOf(error).includes(ALREADY_IN_CHAIN)
}

export function isGrpcNotFound(error: unknown): boolean {
  return (error as {code?: unknown} | null)?.code === GRPC_NOT_FOUND
}

export function isStaleInstantLockProof(error: unknown): boolean {
  return messageOf(error).includes(STALE_INSTANT_LOCK_PROOF)
}
