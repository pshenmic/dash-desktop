import { Text } from '../dash-ui-kit-enxtended'
import type { RecipientSummaryProps } from '@renderer/types/RecipientSummary'

export default function RecipientSummary({
  recipients,
}: RecipientSummaryProps): React.JSX.Element {
  return (
    <div className="min-w-0 flex justify-between items-baseline gap-4">
      <Text size={12} weight="medium" color="brand" opacity={50} className="shrink-0">To</Text>
      <div className="min-w-0 flex flex-col gap-3 text-right">
        {recipients.map((recipient, index) => (
          <Text key={`${index}-${recipient.address}`} size={12} weight="medium" color="brand" className="break-all select-all">
            {recipient.address}
          </Text>
        ))}
      </div>
    </div>
  )
}
