import { Text } from '@renderer/components/dash-ui-kit-enxtended'
import CreditsAmount from '@renderer/components/ui/CreditsAmount'
import { ADD_KEYS_COPY, KEYS_FACT_DIVIDER_CLASS, KEYS_FACT_ROW_CLASS, KEYS_SIGNED_COPY } from '@renderer/constants/identityKeys'
import { SURFACE_SECTION } from '@renderer/constants/surfaces'
import { TX_SUMMARY_PENDING_VALUE } from '@renderer/constants/txSummary'
import type { AddKeysConfirmStepProps } from '@renderer/types/IdentityKeys'
import { projectedKeyLabel } from '@renderer/utils/identityKeySetup'
import { identityLabel } from '@renderer/utils/identifierFormat'
import { keyRequestLabel, projectedKeyIds } from '@renderer/utils/identityKeyRequests'

export default function AddKeysConfirmStep({ identity, requests, feeCredits }: AddKeysConfirmStepProps): React.JSX.Element {
  const ids = projectedKeyIds(identity.keys, requests.length)
  const balance = identity.balance.amount
  return (
    <div className={`flex flex-col gap-3 ${SURFACE_SECTION}`}>
      <div className={KEYS_FACT_ROW_CLASS}>
        <Text size={12} weight={"medium"} color={"brand"} opacity={50}>{ADD_KEYS_COPY.identity}</Text>
        <Text size={14} weight={"medium"} color={"brand"} className={"min-w-0 break-all text-right"}>{identityLabel(identity)}</Text>
      </div>
      <div className={"flex items-start justify-between gap-4"}>
        <Text size={12} weight={"medium"} color={"brand"} opacity={50}>{ADD_KEYS_COPY.keys}</Text>
        <div className={"flex min-w-0 flex-col items-end gap-1"}>
          {requests.map((request, index) => (
            <Text key={ids[index]} size={14} weight={"medium"} color={"brand"} className={"text-right"}>
              {projectedKeyLabel(ids[index], keyRequestLabel(request))}
            </Text>
          ))}
        </div>
      </div>
      <div className={KEYS_FACT_ROW_CLASS}>
        <Text size={12} weight={"medium"} color={"brand"} opacity={50}>{ADD_KEYS_COPY.fee}</Text>
        <Text size={14} weight={"medium"} color={"brand"}>
          {feeCredits == null ? TX_SUMMARY_PENDING_VALUE : <CreditsAmount credits={feeCredits} exact showFiat={false} align={"end"} />}
        </Text>
      </div>
      <div className={KEYS_FACT_DIVIDER_CLASS} />
      <div className={KEYS_FACT_ROW_CLASS}>
        <Text size={12} weight={"medium"} color={"brand"} opacity={50}>{KEYS_SIGNED_COPY.balanceAfter}</Text>
        <Text size={16} weight={"extrabold"} color={"brand"}>
          {feeCredits == null ? TX_SUMMARY_PENDING_VALUE : <CreditsAmount credits={balance - feeCredits} exact showFiat={false} align={"end"} />}
        </Text>
      </div>
    </div>
  )
}
