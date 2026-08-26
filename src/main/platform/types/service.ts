import type {RecoveredNoteWASM} from 'pshenmic-dpp'

export interface InFlight {
  controller: AbortController
  settled: boolean
}

export interface CheckedNote {
  recoveredNote: RecoveredNoteWASM
  spent: boolean
}
