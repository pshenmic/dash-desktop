export const WITHDRAWAL_CORE_FEE_PER_BYTE = 1
export const SHIELD_FUNDING_DUMMY_OUTPUTS = 1

// Platform caps state transitions at ~20KB and the Halo2 proof grows with the
// number of Orchard actions.
export const MAX_SPEND_NOTES = 6

// An Orchard bundle carries at least two actions, so a single-note spend is
// still charged for two.
export const MIN_BUNDLE_ACTIONS = 2