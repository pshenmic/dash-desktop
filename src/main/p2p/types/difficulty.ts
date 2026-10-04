// All any retarget era reads of a block. Kept apart from PersistedHeader so the
// seed below the chain anchor, which has no stored header, is the same shape.
export interface DifficultyBlock {
  height: number
  time: number
  nBits: number
}

// Reads the chain below the header being checked. Undefined once the window
// runs out, which is what tells the rule it cannot judge this header.
export type DifficultyLookup = (height: number) => DifficultyBlock | undefined
