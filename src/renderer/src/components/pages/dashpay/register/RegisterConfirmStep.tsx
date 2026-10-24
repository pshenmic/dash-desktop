import { Text } from '@renderer/components/dash-ui-kit-enxtended'
import CreditsAmount from '@renderer/components/ui/CreditsAmount'
import IdentityAvatar from '@renderer/components/ui/IdentityAvatar'
import SensitiveValue from '@renderer/components/ui/SensitiveValue'
import { REGISTER_CONFIRM_COPY, REGISTER_USERNAME_COPY, USERNAME_DIVIDER_CLASS } from '@renderer/constants/dashPayUsernames'
import { SURFACE_SECTION } from '@renderer/constants/surfaces'
import { TX_SUMMARY_PENDING_VALUE } from '@renderer/constants/txSummary'
import { DpnsLabelKind } from '@renderer/enums/DashPay'
import { IdentityAvatarSize } from '@renderer/enums/IdentityAvatarSize'
import { useBalanceVisibility } from '@renderer/hooks/useBalanceVisibility'
import type { RegisterConfirmStepProps } from '@renderer/types/DashPayUsernames'
import { balanceAfterFee, usernameTypeLabel } from '@renderer/utils/dashPayUsernames'
import { fullDpnsName } from '@renderer/utils/dpnsLabel'
import { identityLabel } from '@renderer/utils/identifierFormat'

export default function RegisterConfirmStep({ check, identity, network, feeLabel, feeCredits }: RegisterConfirmStepProps): React.JSX.Element {
  const { isBalanceVisible } = useBalanceVisibility()
  const after = balanceAfterFee(identity.balance.amount, feeCredits)

  return (
    <div className={`flex flex-col gap-3 ${SURFACE_SECTION}`}>
      <div className={"flex items-center justify-between gap-4"}>
        <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"shrink-0"}>{REGISTER_CONFIRM_COPY.username}</Text>
        <Text size={14} weight={"medium"} color={"brand"} className={"min-w-0 break-all text-right"}>{fullDpnsName(check.label)}</Text>
      </div>
      <div className={"flex items-center justify-between gap-4"}>
        <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"shrink-0"}>{REGISTER_CONFIRM_COPY.savedAs}</Text>
        <Text size={12} weight={"medium"} color={"brand"} className={"min-w-0 break-all text-right font-mono"}>{check.normalized}</Text>
      </div>
      <div className={"flex items-center justify-between gap-4"}>
        <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"shrink-0"}>{REGISTER_CONFIRM_COPY.for}</Text>
        <span className={"flex min-w-0 items-center gap-2"}>
          <IdentityAvatar identifier={identity.identifier} size={IdentityAvatarSize.Xs} />
          <Text reset size={12} weight={"medium"} color={"brand"} className={"min-w-0 break-all text-right"}>{identityLabel(identity)}</Text>
        </span>
      </div>
      <div className={"flex items-center justify-between gap-4"}>
        <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"shrink-0"}>{REGISTER_CONFIRM_COPY.type}</Text>
        <Text size={12} weight={"medium"} color={"brand"} className={"text-right"}>
          {usernameTypeLabel(check.kind === DpnsLabelKind.Contested, network)}
        </Text>
      </div>
      <div className={"flex items-center justify-between gap-4"}>
        <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"shrink-0"}>{feeLabel}</Text>
        <Text size={14} weight={"medium"} color={"brand"}>
          {feeCredits == null ? TX_SUMMARY_PENDING_VALUE : <CreditsAmount credits={feeCredits} exact showFiat={false} align={"end"} />}
        </Text>
      </div>
      <div className={USERNAME_DIVIDER_CLASS} />
      <div className={"flex items-center justify-between gap-4"}>
        <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"shrink-0"}>{REGISTER_USERNAME_COPY.balanceAfter}</Text>
        <Text size={16} weight={"extrabold"} color={"brand"}>
          {after == null ? TX_SUMMARY_PENDING_VALUE : (
            <SensitiveValue hidden={!isBalanceVisible} size={"compact"}>
              <CreditsAmount credits={after} showFiat={false} align={"end"} />
            </SensitiveValue>
          )}
        </Text>
      </div>
    </div>
  )
}
