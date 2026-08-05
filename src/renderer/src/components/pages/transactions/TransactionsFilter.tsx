import { useRef, useState } from 'react'
import { Text, FilterIcon } from '@renderer/components/dash-ui-kit-enxtended'
import { transactionsPage } from '@renderer/constants'
import { useClickOutside } from '@renderer/hooks/useClickOutside'
import { TxDirectionFilter } from '@renderer/enums/TxDirectionFilter'
import { TxTypeFilter } from '@renderer/enums/TxTypeFilter'
import { TxFilter, isDefaultTxFilter } from '@renderer/utils/transactionFilters'

interface FilterOption<T extends string> {
  value: T
  label: string
}

interface FilterSectionProps<T extends string> {
  label: string
  options: Array<FilterOption<T>>
  selected: T
  onSelect: (value: T) => void
}

function FilterSection<T extends string>({ label, options, selected, onSelect }: FilterSectionProps<T>): React.JSX.Element {
  return (
    <div className={"flex flex-col gap-[.125rem]"}>
      <Text size={10} weight={"medium"} color={"brand"} opacity={40} transform={"uppercase"} className={"tracking-[.08em] px-[.625rem] py-1"}>
        {label}
      </Text>
      {options.map((option) => (
        <button
          key={option.value}
          type={"button"}
          onClick={() => onSelect(option.value)}
          className={`
            w-full flex items-center p-[.625rem] rounded-[.625rem] cursor-pointer text-left
            hover:dash-block-accent-10 transition-colors duration-150
            ${option.value === selected ? 'dash-block-accent-5' : ''}
          `}
        >
          <Text size={12} weight={"medium"} color={"brand"}>{option.label}</Text>
        </button>
      ))}
    </div>
  )
}

interface TransactionsFilterProps {
  filter: TxFilter
  onChange: (filter: TxFilter) => void
}

export default function TransactionsFilter({ filter, onChange }: TransactionsFilterProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useClickOutside(ref, () => setOpen(false))

  const { filter: filterLabel, filters } = transactionsPage.transactions
  const active = !isDefaultTxFilter(filter)

  const directionOptions: Array<FilterOption<TxDirectionFilter>> = [
    { value: TxDirectionFilter.All, label: filters.direction.all },
    { value: TxDirectionFilter.Received, label: filters.direction.received },
    { value: TxDirectionFilter.Sent, label: filters.direction.sent },
  ]
  const typeOptions: Array<FilterOption<TxTypeFilter>> = [
    { value: TxTypeFilter.All, label: filters.type.all },
    { value: TxTypeFilter.Transfer, label: filters.type.transfer },
    { value: TxTypeFilter.AssetLock, label: filters.type.assetLock },
  ]

  return (
    <div className={"relative"} ref={ref}>
      <button
        type={"button"}
        onClick={() => setOpen((v) => !v)}
        className={"flex items-center gap-2 px-3 py-2 rounded-[.625rem] dash-block dash-black-border cursor-pointer hover:opacity-80 transition-opacity duration-200"}
      >
        <FilterIcon size={12} color={"currentColor"} className={"dash-text-primary"} />
        <Text size={12} weight={"medium"} color={"brand"}>{filterLabel}</Text>
        {active && <span className={"size-1.5 rounded-full bg-dash-brand dark:bg-dash-mint"} />}
      </button>

      {open && (
        <div className={"absolute right-0 top-[calc(100%+.375rem)] z-30 w-44 flex flex-col gap-2 p-[.375rem] rounded-[.875rem] bg-white dark:bg-white/12 dark:backdrop-blur-[2rem] shadow-[0_0_35px_0_rgba(0,0,0,0.15)]"}>
          <FilterSection
            label={filters.direction.label}
            options={directionOptions}
            selected={filter.direction}
            onSelect={(direction) => onChange({ ...filter, direction })}
          />
          <FilterSection
            label={filters.type.label}
            options={typeOptions}
            selected={filter.type}
            onSelect={(type) => onChange({ ...filter, type })}
          />
        </div>
      )}
    </div>
  )
}
