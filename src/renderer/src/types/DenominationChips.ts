export interface DenominationChipsProps {
  denominations: readonly bigint[]
  selected: bigint | null
  onSelect: (denomination: bigint) => void
  className?: string
}
