import { Text } from '@renderer/components/dash-ui-kit-enxtended'
import { SEGMENTED_CONTROL_APPEARANCE_STYLES } from '@renderer/constants/segmentedControl'
import { SegmentedControlAppearance } from '@renderer/enums/SegmentedControlAppearance'
import type { SegmentedControlProps } from '@renderer/types/SegmentedControl'

export default function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className = '',
  appearance = SegmentedControlAppearance.Boxed,
  ariaLabel,
  disabled = false,
}: SegmentedControlProps<T>): React.JSX.Element {
  const styles = SEGMENTED_CONTROL_APPEARANCE_STYLES[appearance]
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={`inline-flex items-center ${styles.group} ${disabled ? 'opacity-50' : ''} ${className}`}
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={`cursor-pointer disabled:cursor-default ${styles.option} ${active ? styles.active : styles.inactive}`}
          >
            <Text
              size={styles.textSize}
              weight="medium"
              color={styles.textColor}
              className={active ? styles.activeText : styles.inactiveText}
            >
              {option.label}
            </Text>
          </button>
        )
      })}
    </div>
  )
}
