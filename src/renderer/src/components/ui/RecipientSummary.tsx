import { Text } from '../dash-ui-kit-enxtended'
import CreditsAmount from './CreditsAmount'
import type { RecipientSummaryProps } from '@renderer/types/RecipientSummary'
import { davToDash } from '@renderer/utils/balance'

export default function RecipientSummary({
  recipients,
  feeOutputIndex,
  feeCredits,
}: RecipientSummaryProps): React.JSX.Element {
  return (
    <div className="min-w-0">
      <Text size={12} weight="medium" color="brand" opacity={50}>
        Recipients ({recipients.length})
      </Text>
      <ol className="mt-2 max-h-52 overflow-y-auto overscroll-contain space-y-3 pr-1" aria-label="Transaction recipients" tabIndex={0}>
        {recipients.map((recipient, index) => (
          <li key={`${index}-${recipient.address}`} className="flex flex-col gap-1 border-b border-dash-primary-dark-blue/10 pb-3 last:border-0 last:pb-0 dark:border-white/10">
            <Text size={12} weight="medium" color="brand" className="font-mono break-all">
              {index + 1}. {recipient.address}
            </Text>
            <div className="flex items-start justify-between gap-3">
              <Text size={12} weight="medium" color="brand" opacity={50}>
                {feeOutputIndex === index ? 'Entered amount' : 'Receives'}
              </Text>
              <Text size={12} weight="extrabold" color="brand" className="text-right">
                {'amountCredits' in recipient
                  ? <CreditsAmount credits={recipient.amountCredits} exact align="end" />
                  : `${davToDash(recipient.amountDuffs)} Dash`}
              </Text>
            </div>
            {feeOutputIndex === index && 'amountCredits' in recipient && (
              <div className="flex flex-col gap-1">
                <Text size={12} weight="medium" color="brand" opacity={50}>
                  Fee deducted from this recipient; final amount depends on the actual fee.
                </Text>
                {feeCredits != null && (
                  <div className="flex items-start justify-between gap-3">
                    <Text size={12} weight="medium" color="brand" opacity={50}>Estimated receives</Text>
                    <Text size={12} weight="extrabold" color="brand" className="text-right">
                      <CreditsAmount credits={recipient.amountCredits - feeCredits} exact align="end" />
                    </Text>
                  </div>
                )}
              </div>
            )}
          </li>
        ))}
      </ol>
    </div>
  )
}
