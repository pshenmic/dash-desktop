import type { HighlightedIdentifierProps } from '@renderer/types/HighlightedIdentifier'
import { identifierParts } from '@renderer/utils/identifierParts'

export function HighlightedIdentifier({ children, className = '' }: HighlightedIdentifierProps): React.JSX.Element {
  const { first, middle, last } = identifierParts(children)
  return (
    <div className={`flex items-center font-dash-grotesque text-sm font-normal break-all text-gray-900 dark:text-white ${className}`}>
      <div className={'flex-1 leading-[1rem]'}>
        <span className='flex-1 text-inherit'>{first}</span>
        <span className='flex-1 text-gray-500'>{middle}</span>
        <span className='flex-1 text-inherit'>{last}</span>
      </div>
    </div>
  )
}

export default HighlightedIdentifier
