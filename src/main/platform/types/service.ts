import type {PlatformVersionWASM, RecoveredNoteWASM} from 'pshenmic-dpp'

export interface InFlight {
  controller: AbortController
  settled: boolean
}

export interface CheckedNote {
  recoveredNote: RecoveredNoteWASM
  spent: boolean
}

// A lookup in flight is shared, and a failed one is kept briefly so an offline
// quote does not wait on the network every keystroke.
export interface ResolvedPlatformVersion {
  version: Promise<PlatformVersionWASM>
  expiresAt: number
}

// answered is false when the network could not be asked and the version is our
// newest one standing in.
export interface PlatformVersionLookup {
  version: PlatformVersionWASM
  answered: boolean
}
