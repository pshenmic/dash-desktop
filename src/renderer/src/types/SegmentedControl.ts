import type { TextProps } from '../components/dash-ui-kit-extended/text'
import type { SegmentedControlAppearance } from '../enums/SegmentedControlAppearance'

export interface SegmentOption<T extends string> {
  value: T
  label: string
}

export interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
  appearance?: SegmentedControlAppearance
  ariaLabel?: string
  disabled?: boolean
}

export interface SegmentedControlAppearanceStyles {
  group: string
  option: string
  active: string
  inactive: string
  textSize: TextProps['size']
  textColor: TextProps['color']
  activeText: string
  inactiveText: string
}
