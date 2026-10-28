import { ChevronIcon } from '@renderer/components/dash-ui-kit-extended'
import type { DropdownChevronProps } from '@renderer/types/DropdownChevron'

export default function DropdownChevron({ open = false, className = '' }: DropdownChevronProps): React.JSX.Element {
  return (
    <ChevronIcon
      size={12}
      color={"currentColor"}
      className={`shrink-0 dash-text-default transition-transform duration-200 ${open ? 'rotate-180' : ''} ${className}`}
    />
  )
}
