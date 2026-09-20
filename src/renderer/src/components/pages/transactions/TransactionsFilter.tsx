import { useRef, useState } from 'react'
import { Text, FilterIcon, Input, SearchIcon } from '@renderer/components/dash-ui-kit-enxtended'
import { transactionsPage } from '@renderer/constants'
import { useClickOutside } from '@renderer/hooks/useClickOutside'
import { isDefaultTxFilter, transactionTypeOptions } from '@renderer/utils/transactionFilters'
import type { FilterSectionProps, TransactionsFilterProps } from '@renderer/types/WalletTransaction'
import { TX_DIRECTION_OPTIONS, TX_STATUS_OPTIONS } from '@renderer/constants/transactionFilters'

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

export default function TransactionsFilter(props: TransactionsFilterProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useClickOutside(ref, () => setOpen(false))

  const { filter: filterLabel, filters } = transactionsPage.transactions
  const active = !isDefaultTxFilter(props.filter)

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
        <div className={"absolute right-0 top-[calc(100%+.375rem)] z-30 w-64 max-h-[65vh] overflow-y-auto flex flex-col gap-2 p-[.375rem] rounded-[.875rem] bg-white dark:bg-white/12 dark:backdrop-blur-[2rem] shadow-[0_0_35px_0_rgba(0,0,0,0.15)]"}>
          <Input
            type={"search"}
            size={"sm"}
            colorScheme={"light"}
            variant={"filled"}
            value={props.filter.search}
            onChange={(event) => props.onChange({ ...props.filter, search: event.target.value })}
            placeholder={filters.search.placeholder}
            aria-label={filters.search.label}
            prefix={<SearchIcon size={14} color={"currentColor"} className={"dash-text-default"} />}
          />
          <FilterSection
            label={filters.direction.label}
            options={TX_DIRECTION_OPTIONS}
            selected={props.filter.direction}
            onSelect={(direction) => props.onChange({ ...props.filter, direction })}
          />
          <FilterSection
            label={filters.type.label}
            options={transactionTypeOptions(props.transactions)}
            selected={props.filter.type}
            onSelect={(type) => props.onChange({ ...props.filter, type })}
          />
          <FilterSection
            label={'Status'}
            options={TX_STATUS_OPTIONS}
            selected={props.filter.status}
            onSelect={(status) => props.onChange({ ...props.filter, status })}
          />
        </div>
      )}
    </div>
  )
}
