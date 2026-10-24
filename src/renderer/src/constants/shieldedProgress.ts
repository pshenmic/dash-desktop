import { ShieldedSpendPhase } from '../enums/ShieldedSpendPhase'

export const SHIELDED_PROVING_LABEL = 'Generating proof'

export const SHIELDED_SPEND_STEPS = [
  { key: ShieldedSpendPhase.Syncing, label: 'Syncing notes' },
  { key: ShieldedSpendPhase.Proving, label: SHIELDED_PROVING_LABEL },
  { key: ShieldedSpendPhase.Broadcasting, label: 'Broadcasting' },
] as const
