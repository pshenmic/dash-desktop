import { Text } from "@renderer/components/dash-ui-kit-enxtended";
import type { AmountFieldProps } from "@renderer/types/Amount";

export default function AmountField({
  value, onChange, onMax, unit, disabled = false, ariaLabel = 'Amount', maxLabel = 'Max', maxDisabled = false,
  compact = false, caption,
}: AmountFieldProps): React.JSX.Element {
  return (
    <div className={`dash-block ${compact ? 'rounded-xl px-3 py-2' : 'rounded-[1rem] px-5 py-3.5'}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <Text size={12} weight={"medium"} color={"brand"} opacity={50}>Amount</Text>
        {caption}
      </div>
      <div className={`flex items-center gap-3 ${compact ? 'mt-0.5' : 'mt-1.5'}`}>
        <input
          aria-label={ariaLabel}
          value={value}
          onChange={onChange}
          disabled={disabled}
          inputMode={"decimal"}
          placeholder={"0"}
          className={`flex-1 min-w-0 bg-transparent outline-none font-bold leading-none dash-text-default placeholder:opacity-30 disabled:cursor-default ${compact ? 'text-2xl' : 'text-[2rem]'}`}
        />
        <div className={"shrink-0 flex items-center"}>{unit}</div>
        {!disabled && (
          <button
            type={"button"}
            onClick={onMax}
            disabled={maxDisabled}
            className={"shrink-0 px-3 py-1.5 rounded-[.625rem] dash-block-accent-5 hover:opacity-80 transition-opacity cursor-pointer disabled:opacity-40 disabled:cursor-default"}
          >
            <Text size={12} weight={"medium"} color={"blue-mint"}>{maxLabel}</Text>
          </button>
        )}
      </div>
    </div>
  )
}
