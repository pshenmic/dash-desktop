import { Text } from '@renderer/components/dash-ui-kit-enxtended'
import { creditsToDuffs, davToDash } from '@renderer/utils/balance'
import type { DenominationChipsProps } from '@renderer/types/DenominationChips'

export default function DenominationChips({
  denominations,
  selected,
  onSelect,
  className = '',
}: DenominationChipsProps): React.JSX.Element {
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {denominations.map(denomination => {
        const active = denomination === selected
        return (
          <button
            key={denomination.toString()}
            type={"button"}
            aria-pressed={active}
            onClick={() => onSelect(denomination)}
            className={`px-4 py-2 rounded-[.75rem] cursor-pointer transition-opacity hover:opacity-90 ${active ? 'dash-bg-inverse' : 'dash-block-3'}`}
          >
            <Text size={12} weight={"extrabold"} color={active ? "blue-mint" : "brand"}>
              {davToDash(creditsToDuffs(denomination))}<span className={"font-normal"}> Dash</span>
            </Text>
          </button>
        )
      })}
    </div>
  )
}
