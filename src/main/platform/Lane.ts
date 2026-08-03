// Serialised execution. A single global queue would put a credit-balance read
// behind a 30-second Halo2 proof, so work is split across lanes instead: one
// exclusive lane for prover work, keyed lanes for nonce-bearing transitions,
// and no lane at all for reads.
export class Lane {
  private tail: Promise<unknown> = Promise.resolve()
  private depth = 0

  get size(): number {
    return this.depth
  }

  get idle(): boolean {
    return this.depth === 0
  }

  // The returned promise is the task's own. The tail deliberately swallows
  // rejections: one failed task must not wedge the lane for every task behind
  // it.
  run<T>(task: () => Promise<T>): Promise<T> {
    this.depth++
    const next = this.tail.catch(() => undefined).then(task)
    this.tail = next.then(
      () => { this.depth-- },
      () => { this.depth-- },
    )
    return next
  }
}

// Lanes by key, dropped once idle so the map does not grow with every signer
// the wallet ever used.
export class KeyedLane {
  private readonly lanes = new Map<string, Lane>()

  get size(): number {
    let total = 0
    for (const lane of this.lanes.values()) total += lane.size
    return total
  }

  get keys(): number {
    return this.lanes.size
  }

  run<T>(key: string, task: () => Promise<T>): Promise<T> {
    const existing = this.lanes.get(key)
    const lane = existing ?? new Lane()
    if (existing == null) this.lanes.set(key, lane)
    const result = lane.run(task)
    const release = (): void => {
      if (lane.idle && this.lanes.get(key) === lane) this.lanes.delete(key)
    }
    result.then(release, release)
    return result
  }
}