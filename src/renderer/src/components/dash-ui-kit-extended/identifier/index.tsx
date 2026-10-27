import type { HighlightedIdentifierProps } from '@renderer/types/HighlightedIdentifier'

export function HighlightedIdentifier({ children, className = '' }: HighlightedIdentifierProps): React.JSX.Element {
  return (
    <div className={`flex items-center font-dash-grotesque text-sm font-normal break-all text-gray-900 dark:text-white ${className}`}>
      <div className={'flex-1 leading-[1rem]'}>{children}</div>
    </div>
  )
}

export default HighlightedIdentifier
