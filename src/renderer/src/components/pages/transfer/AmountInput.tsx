import { Text } from '@renderer/components/dash-ui-kit-enxtended'
import { Input } from '@renderer/components/dash-ui-kit-enxtended/input'

interface AmountInputProps {
  value: string
  onChange: (value: string) => void
  onMax: () => void
  balanceLabel: string
  fiatPreview?: string
  overBalance?: boolean
}

export default function AmountInput({
  value,
  onChange,
  onMax,
  balanceLabel,
  fiatPreview,
  overBalance = false,
}: AmountInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const val = e.target.value.replace(/[^0-9.]/g, '')
    const parts = val.split('.')
    if (parts.length > 2) return
    if (parts[1] && parts[1].length > 8) return
    onChange(val)
  }

  return (
    <div className={"flex flex-col items-center gap-[.5rem]"}>
      <div className={"relative w-full"}>
        <Input
          type={"text"}
          value={value}
          onChange={handleChange}
          variant={"border-bottom"}
          colorScheme={"transparent"}
          size={"2xl"}
          className={"!text-[2rem] font-bold leading-[120%] pr-13 text-center"}
          placeholder={"0"}
        />
        <button
          onClick={onMax}
          className={"absolute right-[.75rem] top-1/2 -translate-y-1/2 px-[.5rem] py-[.25rem] rounded-[.25rem] dash-block-accent-5 flex cursor-pointer hover:opacity-80 transition-opacity"}
        >
          <Text size={12} weight={"medium"} color={"blue-mint"} className={"leading-[120%]"}>
            Max
          </Text>
        </button>
      </div>

      <div className={"flex items-center justify-between w-full px-1"}>
        <Text size={12} weight={"medium"} color={overBalance ? "red" : "brand"} opacity={overBalance ? 100 : 50}>
          {overBalance ? 'Amount exceeds balance' : balanceLabel}
        </Text>
        {fiatPreview && (
          <Text size={12} weight={"medium"} color={"blue-mint"}>
            ≈ {fiatPreview}
          </Text>
        )}
      </div>
    </div>
  )
}
