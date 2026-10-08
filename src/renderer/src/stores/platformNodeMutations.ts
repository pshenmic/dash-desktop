import type {PlatformNodeMutation, PlatformNodeMutationSnapshot} from '@renderer/types/connection'

let snapshot: PlatformNodeMutationSnapshot = {pending: null, revision: 0}
const listeners = new Set<() => void>()

export function getPlatformNodeMutationSnapshot(): PlatformNodeMutationSnapshot {
  return snapshot
}

export function subscribePlatformNodeMutations(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export async function runPlatformNodeMutation(
  mutation: PlatformNodeMutation,
  revision: number,
  action: () => Promise<void>,
): Promise<void> {
  if (snapshot.pending !== null) throw new Error('Another Platform setting is still being applied.')
  if (snapshot.revision !== revision) throw new Error('Wait for Platform node settings to load before editing them.')
  snapshot = {pending: mutation, revision}
  for (const listener of listeners) listener()
  try {
    await action()
  } finally {
    snapshot = {pending: null, revision: revision + 1}
    for (const listener of listeners) listener()
  }
}
