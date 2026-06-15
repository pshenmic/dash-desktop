import { Text } from '@renderer/components/dash-ui-kit-enxtended'

export interface SegmentOption<T extends string> {
  value: T
  label: string
}

export interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
}

export default function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className = '',
}: SegmentedControlProps<T>): React.JSX.Element {
  return (
    <div
      className={`
        inline-flex items-center gap-1 p-1
        rounded-[.75rem]
        dash-block-3 dash-black-border
        ${className}
      `}
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`
              px-3.5 py-1.5 rounded-[.5rem]
              cursor-pointer transition-colors duration-150
              ${active
                ? 'bg-dash-brand dark:bg-dash-mint/20'
                : 'hover:bg-dash-primary-dark-blue/5 dark:hover:bg-white/5'}
            `}
          >
            <Text
              size={12}
              weight="medium"
              className={active ? 'text-white! dark:text-dash-mint!' : 'dash-text-default'}
            >
              {option.label}
            </Text>
          </button>
        )
      })}
    </div>
  )
}
