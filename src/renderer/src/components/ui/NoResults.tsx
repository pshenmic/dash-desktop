import { Text } from "../dash-ui-kit-enxtended";
import type { NoResultsProps } from '@renderer/types/NoResults'

export default function NoResults({ noResults, title, action }: NoResultsProps): React.JSX.Element {
  return (
    <div className={"flex flex-col items-center justify-center py-12"}>
      {title && <Text reset as="h3" size={16} weight="medium" color="brand" className="mb-3 text-center">{title}</Text>}
      <Text size={14} color={"default"} opacity={50}>
        {noResults}
      </Text>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
