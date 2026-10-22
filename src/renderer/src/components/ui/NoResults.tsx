import { Text } from '@renderer/components/dash-ui-kit-enxtended'
import { NoResultsTone } from '@renderer/enums/NoResultsTone'
import type { NoResultsProps } from '@renderer/types/NoResults'

export default function NoResults({ noResults, title, description, action, tone = NoResultsTone.Neutral }: NoResultsProps): React.JSX.Element {
  const isError = tone === NoResultsTone.Error

  return (
    <div role={isError ? 'alert' : undefined} className={"flex flex-col items-center justify-center gap-2 py-12 text-center"}>
      <Text size={14} color={isError ? 'red' : 'default'} opacity={isError ? 100 : 50} className={"wrap-anywhere"}>
        {title ?? noResults}
      </Text>
      {description && (
        <Text size={12} weight={"medium"} color={"brand"} opacity={50}>
          {description}
        </Text>
      )}
      {action && <div className={"mt-1 flex justify-center"}>{action}</div>}
    </div>
  )
}
