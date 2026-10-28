export interface AllocationSlider {
  percent: number
  onPercentChange: (percent: number) => void
  disabled: boolean
  label: string
  valueText: string
  title?: string
  onMax: () => void
  maxDisabled: boolean
  maxTitle?: string
}

export interface AllocationAmountRowProps {
  id?: string
  value: string
  onChange: (value: string) => void
  fiatDuffs: bigint
  ariaLabel?: string
  amountTooltip?: string
  invalid?: boolean
  disabled?: boolean
  centered?: boolean
  slider?: AllocationSlider
}

export interface FiatFieldParts {
  value: string
  symbol: string
}
