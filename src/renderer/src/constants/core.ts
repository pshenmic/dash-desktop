// Not consensus: a standard transaction may not exceed 100 kB, and at 34 bytes
// per output this keeps a send well inside what peers relay.
export const CORE_RECIPIENT_LIMIT = 1_000
