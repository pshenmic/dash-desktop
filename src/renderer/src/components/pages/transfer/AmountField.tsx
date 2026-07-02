import { Text } from "@renderer/components/dash-ui-kit-enxtended";

interface AmountFieldProps {
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onMax: () => void
  unit: React.ReactNode
}

export default function AmountField({value, onChange, onMax, unit}: AmountFieldProps): React.JSX.Element {
  return (
    <div className={"dash-block rounded-[1rem] px-5 py-3.5"}>
      <Text size={12} weight={"medium"} color={"brand"} opacity={50}>Amount</Text>
      <div className={"mt-1.5 flex items-center gap-3"}>
        <input
          value={value}
          onChange={onChange}
          inputMode={"decimal"}
          placeholder={"0"}
          className={"flex-1 min-w-0 bg-transparent outline-none text-[2rem] font-bold leading-none dash-text-default placeholder:opacity-30"}
        />
        <div className={"shrink-0 flex items-center"}>{unit}</div>
        <button
          type={"button"}
          onClick={onMax}
          className={"shrink-0 px-3 py-1.5 rounded-[.625rem] dash-block-accent-5 hover:opacity-80 transition-opacity cursor-pointer"}
        >
          <Text size={12} weight={"medium"} color={"blue-mint"}>Max</Text>
        </button>
      </div>
    </div>
  )
}
